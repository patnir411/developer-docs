const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

// Initialize GCP clients
const storage = new Storage();
const firestore = new Firestore();

// Configuration
const CONFIG = {
  sources: {
    gemini: {
      baseUrl: 'https://ai.google.dev',
      paths: [
        '/gemini-api/docs',
        '/gemini-api/docs/models',
        '/gemini-api/docs/function-calling',
        '/gemini-api/docs/vision',
        '/gemini-api/docs/audio',
        '/gemini-api/docs/structured-output',
        '/gemini-api/docs/thinking',
        '/gemini-api/docs/caching',
        '/gemini-api/docs/tuning'
      ]
    },
    pythonSDK: {
      baseUrl: 'https://ai.google.dev/api/python/google/generativeai',
      paths: ['', '/models', '/types', '/client']
    },
    geminiCLI: {
      baseUrl: 'https://geminicli.com',
      paths: ['/docs']
    }
  },
  rateLimiting: {
    delayMs: 500,
    maxRetries: 3
  }
};

// Utility: Delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Utility: Retry wrapper
async function retry(fn, retries = CONFIG.rateLimiting.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}

// Utility: Fetch with retry
async function fetchWithRetry(url) {
  return retry(async () => {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Gemini-Docs-Tracker/1.0 (Educational Purpose)',
        'Accept': 'text/html'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  });
}

// Parse HTML to clean markdown-like content
function parseHTML(html, url) {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $('nav, footer, header, script, style, .cookie-banner, .sidebar').remove();

  // Extract main content
  const mainContent = $('main, article, .content, .documentation').first();
  const content = mainContent.length > 0 ? mainContent : $('body');

  // Extract title
  const title = $('h1').first().text().trim() || 'Untitled';

  // Extract text content
  const textContent = content.text();

  // Clean up whitespace
  const cleanText = textContent
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    title,
    content: cleanText,
    url,
    scrapedAt: new Date().toISOString(),
    wordCount: cleanText.split(/\s+/).length
  };
}

// Scrape a single source
async function scrapeSource(sourceName, sourceConfig) {
  console.log(`Scraping ${sourceName}...`);
  const results = [];

  for (const path of sourceConfig.paths) {
    const url = `${sourceConfig.baseUrl}${path}`;

    try {
      const html = await fetchWithRetry(url);
      const parsed = parseHTML(html, url);

      results.push({
        source: sourceName,
        path,
        ...parsed,
        success: true
      });

      // Rate limiting
      await delay(CONFIG.rateLimiting.delayMs);
    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error.message);
      results.push({
        source: sourceName,
        path,
        url,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

// Save results to Cloud Storage
async function saveToStorage(bucketName, results) {
  const bucket = storage.bucket(bucketName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  for (const result of results) {
    if (!result.success) continue;

    const fileName = `${result.source}/${result.path.replace(/\//g, '_') || 'index'}.json`;
    const file = bucket.file(fileName);

    await file.save(JSON.stringify(result, null, 2), {
      metadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=3600'
      }
    });

    console.log(`Saved: ${fileName}`);
  }

  // Save summary
  const summaryFile = bucket.file(`summaries/scrape-${timestamp}.json`);
  await summaryFile.save(JSON.stringify({
    timestamp,
    totalResults: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results: results.map(r => ({
      source: r.source,
      path: r.path,
      success: r.success,
      error: r.error || null
    }))
  }, null, 2));

  console.log(`Summary saved: summaries/scrape-${timestamp}.json`);
}

// Save metadata to Firestore
async function saveMetadataToFirestore(results) {
  const timestamp = new Date();
  const scrapeId = timestamp.toISOString();

  // Save scrape metadata
  await firestore.collection('scrapes').doc(scrapeId).set({
    timestamp,
    totalResults: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    sources: [...new Set(results.map(r => r.source))]
  });

  // Save individual results
  const batch = firestore.batch();

  results.forEach((result, index) => {
    const docRef = firestore.collection('scrapes').doc(scrapeId)
      .collection('results').doc(`${result.source}-${index}`);

    batch.set(docRef, {
      source: result.source,
      path: result.path,
      url: result.url,
      success: result.success,
      wordCount: result.wordCount || 0,
      error: result.error || null,
      timestamp
    });
  });

  await batch.commit();
  console.log(`Metadata saved to Firestore: ${scrapeId}`);
}

// Main scrape handler
async function scrapeHandler(req, res) {
  console.log('Scraper Cloud Function triggered');

  const startTime = Date.now();
  const requestedSource = req.body?.source || 'all';

  try {
    let allResults = [];

    // Determine which sources to scrape
    const sources = requestedSource === 'all'
      ? Object.keys(CONFIG.sources)
      : [requestedSource];

    // Scrape each source
    for (const sourceName of sources) {
      if (!CONFIG.sources[sourceName]) {
        console.warn(`Unknown source: ${sourceName}`);
        continue;
      }

      const results = await scrapeSource(sourceName, CONFIG.sources[sourceName]);
      allResults = allResults.concat(results);
    }

    // Get bucket name from environment or use default
    const bucketName = process.env.DOCS_BUCKET || `${process.env.GCP_PROJECT}-gemini-docs`;

    // Save to Cloud Storage
    await saveToStorage(bucketName, allResults);

    // Save metadata to Firestore
    await saveMetadataToFirestore(allResults);

    const duration = Date.now() - startTime;

    res.status(200).json({
      success: true,
      message: 'Scraping completed successfully',
      stats: {
        totalResults: allResults.length,
        successful: allResults.filter(r => r.success).length,
        failed: allResults.filter(r => !r.success).length,
        sources: sources.length,
        durationMs: duration
      }
    });
  } catch (error) {
    console.error('Scraping failed:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      durationMs: Date.now() - startTime
    });
  }
}

// Local testing
if (require.main === module) {
  scrapeHandler(
    { body: { source: 'all' } },
    {
      status: (code) => ({
        json: (data) => console.log(`Response ${code}:`, JSON.stringify(data, null, 2))
      })
    }
  );
}

module.exports = { scrapeHandler };
