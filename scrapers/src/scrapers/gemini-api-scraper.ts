import { HttpClient } from '../utils/http-client';
import { RateLimiter } from '../utils/rate-limiter';
import { CacheManager } from '../utils/cache-manager';
import { HtmlParser, ParsedContent } from '../utils/html-parser';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ScraperConfig {
  baseUrl: string;
  paths: string[];
  outputDir: string;
  httpClient: HttpClient;
  rateLimiter: RateLimiter;
  cacheManager: CacheManager;
  selectors: any;
  exclusions: string[];
}

export interface ScraperResult {
  url: string;
  filePath: string;
  success: boolean;
  error?: string;
  metadata?: any;
}

export class GeminiApiScraper {
  private config: ScraperConfig;
  private parser: HtmlParser;
  private results: ScraperResult[] = [];

  constructor(config: ScraperConfig) {
    this.config = config;
    this.parser = new HtmlParser();
  }

  async scrapeAll(): Promise<ScraperResult[]> {
    console.log(chalk.bold.blue('\n🚀 Starting Gemini API Documentation Scrape\n'));
    console.log(chalk.blue(`Base URL: ${this.config.baseUrl}`));
    console.log(chalk.blue(`Paths to scrape: ${this.config.paths.length}\n`));

    this.results = [];

    for (const urlPath of this.config.paths) {
      try {
        await this.scrapePath(urlPath);
      } catch (error) {
        console.error(chalk.red(`Failed to scrape ${urlPath}:`), error);
        this.results.push({
          url: `${this.config.baseUrl}${urlPath}`,
          filePath: '',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.printSummary();
    return this.results;
  }

  private async scrapePath(urlPath: string): Promise<void> {
    const fullUrl = `${this.config.baseUrl}${urlPath}`;
    console.log(chalk.bold(`\n📄 Scraping: ${urlPath}`));

    // Check cache first
    const cacheKey = CacheManager.generateKey('gemini', fullUrl);
    const cached = this.config.cacheManager.get<ParsedContent>(cacheKey);

    let parsed: ParsedContent;

    if (cached) {
      console.log(chalk.cyan('Using cached content'));
      parsed = cached;
    } else {
      // Fetch with rate limiting
      const response = await this.config.rateLimiter.schedule(() =>
        this.config.httpClient.get(fullUrl)
      );

      // Parse HTML
      parsed = this.parser.parse(
        response.data,
        this.config.selectors,
        this.config.exclusions
      );

      // Cache the result
      this.config.cacheManager.set(cacheKey, parsed);
    }

    // Save to file
    const filePath = await this.saveToFile(urlPath, parsed);

    this.results.push({
      url: fullUrl,
      filePath,
      success: true,
      metadata: parsed.metadata,
    });

    console.log(chalk.green(`✓ Saved to: ${filePath}`));
  }

  private async saveToFile(urlPath: string, content: ParsedContent): Promise<string> {
    // Generate file path from URL path
    const fileName = this.urlPathToFileName(urlPath);
    const filePath = path.join(this.config.outputDir, fileName);

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Prepare frontmatter
    const frontmatter = this.generateFrontmatter(content, urlPath);

    // Combine frontmatter and content
    const fileContent = `${frontmatter}\n${HtmlParser.sanitizeContent(content.markdown)}`;

    // Write markdown file
    await fs.writeFile(filePath, fileContent, 'utf-8');

    // Also save JSON metadata
    const jsonPath = filePath.replace('.md', '.json');
    await fs.writeFile(
      jsonPath,
      JSON.stringify({
        title: content.title,
        url: `${this.config.baseUrl}${urlPath}`,
        sections: content.sections,
        codeBlocks: content.codeBlocks.map(cb => ({
          language: cb.language,
          lines: cb.code.split('\n').length,
        })),
        links: content.links,
        metadata: content.metadata,
        scrapedAt: new Date().toISOString(),
      }, null, 2),
      'utf-8'
    );

    return filePath;
  }

  private urlPathToFileName(urlPath: string): string {
    // Convert URL path to file path
    // e.g., /gemini-api/docs/models -> models/README.md
    // e.g., /gemini-api/docs/function-calling -> function-calling.md

    let cleanPath = urlPath
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .replace(/^gemini-api\/docs\/?/, '');

    if (!cleanPath || cleanPath === '/') {
      return 'overview/README.md';
    }

    // If it's a directory-like path, use README.md
    if (!cleanPath.includes('.')) {
      const parts = cleanPath.split('/');
      const lastPart = parts[parts.length - 1];

      // Create a directory structure
      if (parts.length > 1) {
        return `${parts.slice(0, -1).join('/')}/${lastPart}.md`;
      }

      return `${cleanPath}/README.md`;
    }

    return cleanPath.endsWith('.md') ? cleanPath : `${cleanPath}.md`;
  }

  private generateFrontmatter(content: ParsedContent, urlPath: string): string {
    return `---
title: ${content.title}
description: ${content.sections[0]?.content.substring(0, 200) || 'Gemini API Documentation'}
url: ${this.config.baseUrl}${urlPath}
scrapedAt: ${new Date().toISOString()}
wordCount: ${content.metadata.wordCount}
codeBlocks: ${content.metadata.codeBlockCount}
lastUpdated: ${content.metadata.lastUpdated || 'N/A'}
---
`;
  }

  private printSummary(): void {
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    console.log(chalk.bold.blue('\n' + '='.repeat(60)));
    console.log(chalk.bold.blue('📊 Scraping Summary'));
    console.log(chalk.bold.blue('='.repeat(60)));
    console.log(chalk.green(`✓ Successful: ${successful}`));
    if (failed > 0) {
      console.log(chalk.red(`✗ Failed: ${failed}`));
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(chalk.red(`  - ${r.url}: ${r.error}`));
        });
    }
    console.log(chalk.blue('='.repeat(60) + '\n'));

    // Print cache stats
    const cacheStats = this.config.cacheManager.getStats();
    console.log(chalk.cyan(`💾 Cache Stats:`));
    console.log(chalk.cyan(`   Hits: ${cacheStats.hits}`));
    console.log(chalk.cyan(`   Misses: ${cacheStats.misses}`));
    console.log(chalk.cyan(`   Hit Rate: ${cacheStats.hitRate.toFixed(2)}%`));

    // Print rate limiter stats
    const rateLimitStats = this.config.rateLimiter.getStats();
    console.log(chalk.cyan(`\n⏱️  Rate Limiter Stats:`));
    console.log(chalk.cyan(`   Requests in last second: ${rateLimitStats.requestsInLastSecond}`));
  }

  getResults(): ScraperResult[] {
    return this.results;
  }
}
