#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs/promises';
import { HttpClient } from './utils/http-client';
import { RateLimiter } from './utils/rate-limiter';
import { CacheManager } from './utils/cache-manager';
import { GeminiApiScraper } from './scrapers/gemini-api-scraper';
import { PythonSDKScraper } from './scrapers/python-sdk-scraper';

// Load configuration
const configPath = path.join(__dirname, '../config/scraper-config.json');
let config: any;

async function loadConfig() {
  const configContent = await fs.readFile(configPath, 'utf-8');
  config = JSON.parse(configContent);
}

async function initializeServices() {
  // Initialize HTTP client
  const httpClient = new HttpClient({
    userAgent: config.scraping.userAgent,
    timeout: config.scraping.timeout,
    retryAttempts: config.scraping.rateLimiting.retryAttempts,
    retryDelay: config.scraping.rateLimiting.retryDelay,
    exponentialBackoff: config.scraping.rateLimiting.exponentialBackoff,
    followRedirects: config.scraping.followRedirects,
    maxRedirects: config.scraping.maxRedirects,
  });

  // Initialize rate limiter
  const rateLimiter = new RateLimiter({
    requestsPerSecond: config.scraping.rateLimiting.requestsPerSecond,
    maxConcurrent: config.scraping.rateLimiting.maxConcurrent,
  });

  // Initialize cache manager
  const cacheManager = new CacheManager({
    enabled: config.cache.enabled,
    ttl: config.cache.ttl,
    checkPeriod: config.cache.checkPeriod,
  });

  return { httpClient, rateLimiter, cacheManager };
}

async function scrapeGeminiAPI(services: any) {
  if (!config.sources.gemini.enabled) {
    console.log(chalk.yellow('⏭️  Gemini API scraping is disabled'));
    return;
  }

  const scraper = new GeminiApiScraper({
    baseUrl: config.sources.gemini.baseUrl,
    paths: config.sources.gemini.paths,
    outputDir: path.join(__dirname, '../../gemini-api'),
    httpClient: services.httpClient,
    rateLimiter: services.rateLimiter,
    cacheManager: services.cacheManager,
    selectors: config.parsing.selectors.gemini,
    exclusions: config.parsing.exclusions.selectors,
  });

  await scraper.scrapeAll();
  return scraper.getResults();
}

async function scrapePythonSDK(services: any) {
  if (!config.sources.pythonSDK.enabled) {
    console.log(chalk.yellow('⏭️  Python SDK scraping is disabled'));
    return;
  }

  const scraper = new PythonSDKScraper({
    baseUrl: config.sources.pythonSDK.baseUrl,
    outputDir: path.join(__dirname, '../../sdks/python'),
    httpClient: services.httpClient,
    rateLimiter: services.rateLimiter,
    cacheManager: services.cacheManager,
    selectors: config.parsing.selectors.pythonSDK,
  });

  await scraper.scrapeAll();
  return scraper.getMethods();
}

async function scrapeAll() {
  console.log(chalk.bold.cyan('\n' + '='.repeat(70)));
  console.log(chalk.bold.cyan('🚀 Gemini Documentation Tracker - Full Scrape'));
  console.log(chalk.bold.cyan('='.repeat(70) + '\n'));

  const startTime = Date.now();

  await loadConfig();
  const services = await initializeServices();

  // Run all scrapers
  const results: any = {
    gemini: null,
    pythonSDK: null,
    startTime: new Date().toISOString(),
    endTime: null,
    duration: null,
  };

  try {
    // Scrape Gemini API
    console.log(chalk.bold.blue('\n📚 Scraping Gemini API Documentation...\n'));
    results.gemini = await scrapeGeminiAPI(services);

    // Scrape Python SDK
    console.log(chalk.bold.blue('\n🐍 Scraping Python SDK Documentation...\n'));
    results.pythonSDK = await scrapePythonSDK(services);

    results.endTime = new Date().toISOString();
    results.duration = Date.now() - startTime;

    // Save results summary
    await saveSummary(results);

    // Print final summary
    printFinalSummary(results);
  } catch (error) {
    console.error(chalk.red('\n❌ Scraping failed:'), error);
    throw error;
  }
}

async function saveSummary(results: any) {
  const summaryPath = path.join(__dirname, '../../.scrape-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(chalk.green(`\n💾 Summary saved to: ${summaryPath}`));
}

function printFinalSummary(results: any) {
  console.log(chalk.bold.cyan('\n' + '='.repeat(70)));
  console.log(chalk.bold.cyan('✨ Scraping Complete!'));
  console.log(chalk.bold.cyan('='.repeat(70)));

  if (results.gemini) {
    const successfulGemini = results.gemini.filter((r: any) => r.success).length;
    console.log(chalk.green(`\n📚 Gemini API: ${successfulGemini} pages scraped`));
  }

  if (results.pythonSDK) {
    console.log(chalk.green(`🐍 Python SDK: ${results.pythonSDK.length} methods documented`));
  }

  const durationSeconds = (results.duration / 1000).toFixed(2);
  console.log(chalk.blue(`\n⏱️  Duration: ${durationSeconds} seconds`));
  console.log(chalk.blue(`📅 Completed: ${results.endTime}\n`));
  console.log(chalk.bold.cyan('='.repeat(70) + '\n'));
}

// CLI
const program = new Command();

program
  .name('gemini-docs-scraper')
  .description('Automated scraper for Gemini API documentation')
  .version('1.0.0');

program
  .command('scrape')
  .description('Scrape documentation from all sources')
  .option('--all', 'Scrape all sources')
  .option('--source <source>', 'Scrape specific source (gemini, python, vertex)')
  .action(async (options) => {
    try {
      await loadConfig();
      const services = await initializeServices();

      if (options.all || !options.source) {
        await scrapeAll();
      } else {
        switch (options.source) {
          case 'gemini':
            await scrapeGeminiAPI(services);
            break;
          case 'python':
            await scrapePythonSDK(services);
            break;
          default:
            console.error(chalk.red(`Unknown source: ${options.source}`));
            process.exit(1);
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('clear-cache')
  .description('Clear the scraping cache')
  .action(async () => {
    await loadConfig();
    const services = await initializeServices();
    services.cacheManager.flush();
    console.log(chalk.green('✓ Cache cleared'));
  });

// If no arguments provided, run scrapeAll
if (process.argv.length === 2) {
  scrapeAll().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
} else {
  program.parse(process.argv);
}
