import { HttpClient } from '../utils/http-client';
import { RateLimiter } from '../utils/rate-limiter';
import { CacheManager } from '../utils/cache-manager';
import { HtmlParser, ParsedContent } from '../utils/html-parser';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PythonSDKScraperConfig {
  baseUrl: string;
  outputDir: string;
  httpClient: HttpClient;
  rateLimiter: RateLimiter;
  cacheManager: CacheManager;
  selectors: any;
}

export interface MethodInfo {
  name: string;
  description: string;
  parameters: Parameter[];
  returnType: string;
  examples: string[];
  url: string;
}

export interface Parameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: string;
}

export class PythonSDKScraper {
  private config: PythonSDKScraperConfig;
  private parser: HtmlParser;
  private methods: MethodInfo[] = [];

  constructor(config: PythonSDKScraperConfig) {
    this.config = config;
    this.parser = new HtmlParser();
  }

  async scrapeAll(): Promise<MethodInfo[]> {
    console.log(chalk.bold.blue('\n🐍 Starting Python SDK Documentation Scrape\n'));

    // Scrape main page to get all method links
    const mainUrl = this.config.baseUrl;
    console.log(chalk.blue(`Fetching main page: ${mainUrl}`));

    const response = await this.config.rateLimiter.schedule(() =>
      this.config.httpClient.get(mainUrl)
    );

    const $ = cheerio.load(response.data);

    // Extract all method links
    const methodLinks: string[] = [];
    $('.devsite-article-body h2').each((_, element) => {
      const $el = $(element);
      const id = $el.attr('id');
      if (id && !id.startsWith('__')) {
        methodLinks.push(`${mainUrl}#${id}`);
      }
    });

    console.log(chalk.blue(`Found ${methodLinks.length} methods to document\n`));

    // Scrape each method
    for (const link of methodLinks) {
      try {
        await this.scrapeMethod(link);
      } catch (error) {
        console.error(chalk.red(`Failed to scrape method ${link}:`), error);
      }
    }

    // Save index file
    await this.saveIndexFile();

    console.log(chalk.green(`\n✓ Scraped ${this.methods.length} Python SDK methods`));
    return this.methods;
  }

  private async scrapeMethod(url: string): Promise<void> {
    const methodId = url.split('#')[1];
    console.log(chalk.blue(`📦 Scraping method: ${methodId}`));

    // Check cache
    const cacheKey = CacheManager.generateKey('python-sdk', url);
    let methodInfo = this.config.cacheManager.get<MethodInfo>(cacheKey);

    if (!methodInfo) {
      const response = await this.config.rateLimiter.schedule(() =>
        this.config.httpClient.get(url.split('#')[0])
      );

      const $ = cheerio.load(response.data);

      // Find the method section
      const methodSection = $(`#${methodId}`).parent();

      // Extract method information
      methodInfo = this.parseMethodSection($, methodSection, url);

      // Cache the result
      this.config.cacheManager.set(cacheKey, methodInfo);
    }

    this.methods.push(methodInfo);

    // Save individual method file
    await this.saveMethodFile(methodInfo);

    console.log(chalk.green(`✓ Documented: ${methodInfo.name}`));
  }

  private parseMethodSection(
    $: cheerio.CheerioAPI,
    section: cheerio.Cheerio<any>,
    url: string
  ): MethodInfo {
    const name = section.find('h2').first().text().trim();
    const description = section.find('p').first().text().trim();

    // Extract parameters from table
    const parameters: Parameter[] = [];
    section.find('table.responsive tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length >= 3) {
        parameters.push({
          name: $(cells[0]).text().trim(),
          type: $(cells[1]).text().trim(),
          description: $(cells[2]).text().trim(),
          required: !$(cells[0]).text().includes('optional'),
        });
      }
    });

    // Extract return type
    const returnSection = section.find('h3:contains("Returns")').next();
    const returnType = returnSection.text().trim() || 'None';

    // Extract code examples
    const examples: string[] = [];
    section.find('pre.prettyprint').each((_, pre) => {
      examples.push($(pre).text().trim());
    });

    return {
      name,
      description,
      parameters,
      returnType,
      examples,
      url,
    };
  }

  private async saveMethodFile(method: MethodInfo): Promise<void> {
    const fileName = `${method.name.replace(/\./g, '_')}.md`;
    const filePath = path.join(this.config.outputDir, 'methods', fileName);

    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const content = this.generateMethodMarkdown(method);
    await fs.writeFile(filePath, content, 'utf-8');

    // Save JSON
    const jsonPath = filePath.replace('.md', '.json');
    await fs.writeFile(jsonPath, JSON.stringify(method, null, 2), 'utf-8');
  }

  private generateMethodMarkdown(method: MethodInfo): string {
    let md = `---
title: ${method.name}
description: ${method.description}
url: ${method.url}
type: method
---

# ${method.name}

${method.description}

## Parameters

`;

    if (method.parameters.length === 0) {
      md += 'No parameters.\n\n';
    } else {
      md += '| Parameter | Type | Required | Description |\n';
      md += '|-----------|------|----------|-------------|\n';

      for (const param of method.parameters) {
        md += `| \`${param.name}\` | \`${param.type}\` | ${param.required ? '✓' : '✗'} | ${param.description} |\n`;
      }
      md += '\n';
    }

    md += `## Returns

\`\`\`
${method.returnType}
\`\`\`

`;

    if (method.examples.length > 0) {
      md += `## Examples

`;
      method.examples.forEach((example, idx) => {
        md += `### Example ${idx + 1}

\`\`\`python
${example}
\`\`\`

`;
      });
    }

    md += `## Reference

[Official Documentation](${method.url})
`;

    return md;
  }

  private async saveIndexFile(): Promise<void> {
    const indexPath = path.join(this.config.outputDir, 'README.md');

    let content = `---
title: Python SDK Reference
description: Complete reference for the Google Generative AI Python SDK
---

# Google Generative AI Python SDK Reference

This documentation is automatically generated from the official Python SDK documentation.

**Total Methods**: ${this.methods.length}

## Methods

`;

    // Group by category (based on name prefix)
    const grouped = new Map<string, MethodInfo[]>();

    for (const method of this.methods) {
      const category = method.name.split('.')[0] || 'General';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(method);
    }

    for (const [category, methods] of grouped) {
      content += `### ${category}\n\n`;

      for (const method of methods) {
        const fileName = `${method.name.replace(/\./g, '_')}.md`;
        content += `- [\`${method.name}\`](methods/${fileName}) - ${method.description.substring(0, 100)}${method.description.length > 100 ? '...' : ''}\n`;
      }

      content += '\n';
    }

    content += `---

*Last updated: ${new Date().toISOString()}*
`;

    await fs.writeFile(indexPath, content, 'utf-8');
  }

  getMethods(): MethodInfo[] {
    return this.methods;
  }
}
