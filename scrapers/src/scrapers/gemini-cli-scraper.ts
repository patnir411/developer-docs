import { HttpClient } from '../utils/http-client';
import { RateLimiter } from '../utils/rate-limiter';
import { CacheManager } from '../utils/cache-manager';
import { HtmlParser, ParsedContent } from '../utils/html-parser';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface GeminiCLIScraperConfig {
  baseUrl: string;
  outputDir: string;
  httpClient: HttpClient;
  rateLimiter: RateLimiter;
  cacheManager: CacheManager;
}

interface CLICommandInfo {
  name: string;
  description: string;
  usage: string;
  options: CLIOption[];
  examples: string[];
  category: string;
}

interface CLIOption {
  name: string;
  shorthand?: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

export class GeminiCLIScraper {
  private config: GeminiCLIScraperConfig;
  private parser: HtmlParser;
  private commands: CLICommandInfo[] = [];

  constructor(config: GeminiCLIScraperConfig) {
    this.config = config;
    this.parser = new HtmlParser();
  }

  async scrapeAll(): Promise<CLICommandInfo[]> {
    console.log(chalk.bold.blue('\n🖥️  Starting Gemini CLI Documentation Scrape\n'));
    console.log(chalk.blue(`Base URL: ${this.config.baseUrl}`));

    try {
      // Scrape main documentation page
      const mainUrl = `${this.config.baseUrl}/docs`;
      console.log(chalk.blue(`Fetching main page: ${mainUrl}\n`));

      const response = await this.config.rateLimiter.schedule(() =>
        this.config.httpClient.get(mainUrl)
      );

      // Parse the documentation structure
      const $ = cheerio.load(response.data);

      // Extract navigation/sidebar to find all CLI command pages
      const commandLinks = await this.extractCommandLinks($);

      console.log(chalk.blue(`Found ${commandLinks.length} CLI command pages\n`));

      // Scrape each command page
      for (const link of commandLinks) {
        await this.scrapeCommandPage(link);
      }

      // Save index file
      await this.saveIndexFile();

      console.log(chalk.green(`\n✓ Scraped ${this.commands.length} Gemini CLI commands`));

      return this.commands;
    } catch (error) {
      console.error(chalk.red('Failed to scrape Gemini CLI documentation:'), error);
      throw error;
    }
  }

  private async extractCommandLinks($: cheerio.CheerioAPI): Promise<string[]> {
    const links: string[] = [];

    // Look for command links in navigation
    // geminicli.com likely uses a sidebar or navigation menu
    $('nav a, .sidebar a, .menu a, [role="navigation"] a').each((_, element) => {
      const $el = $(element);
      const href = $el.attr('href');

      if (href && (
        href.includes('/commands/') ||
        href.includes('/cli/') ||
        href.includes('/reference/')
      )) {
        const fullUrl = href.startsWith('http')
          ? href
          : `${this.config.baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;

        if (!links.includes(fullUrl)) {
          links.push(fullUrl);
        }
      }
    });

    // Also look for command pages in main content
    $('main a, .content a, article a').each((_, element) => {
      const $el = $(element);
      const href = $el.attr('href');
      const text = $el.text().toLowerCase();

      if (href && (
        text.includes('command') ||
        text.includes('cli') ||
        href.includes('/commands/')
      )) {
        const fullUrl = href.startsWith('http')
          ? href
          : `${this.config.baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;

        if (!links.includes(fullUrl)) {
          links.push(fullUrl);
        }
      }
    });

    // Fallback: scrape common CLI command pages
    if (links.length === 0) {
      const commonCommands = [
        'chat', 'generate', 'embed', 'count-tokens',
        'models', 'config', 'auth', 'version', 'help'
      ];

      for (const cmd of commonCommands) {
        links.push(`${this.config.baseUrl}/docs/commands/${cmd}`);
      }
    }

    return [...new Set(links)]; // Remove duplicates
  }

  private async scrapeCommandPage(url: string): Promise<void> {
    console.log(chalk.blue(`📄 Scraping: ${url}`));

    try {
      // Check cache first
      const cacheKey = CacheManager.generateKey('gemini-cli', url);
      let commandInfo = this.config.cacheManager.get<CLICommandInfo>(cacheKey);

      if (!commandInfo) {
        const response = await this.config.rateLimiter.schedule(() =>
          this.config.httpClient.get(url)
        );

        const $ = cheerio.load(response.data);

        // Parse command information
        commandInfo = this.parseCommandPage($, url);

        // Cache the result
        this.config.cacheManager.set(cacheKey, commandInfo);
      }

      if (commandInfo) {
        this.commands.push(commandInfo);

        // Save individual command file
        await this.saveCommandFile(commandInfo);

        console.log(chalk.green(`✓ Documented: ${commandInfo.name}`));
      }
    } catch (error) {
      console.error(chalk.yellow(`⚠️  Failed to scrape ${url}:`), error);
    }
  }

  private parseCommandPage($: cheerio.CheerioAPI, url: string): CLICommandInfo | null {
    // Extract command name
    const name = this.extractCommandName($);

    if (!name) {
      console.warn(chalk.yellow('Could not extract command name from page'));
      return null;
    }

    // Extract description
    const description = this.extractDescription($);

    // Extract usage
    const usage = this.extractUsage($);

    // Extract options/flags
    const options = this.extractOptions($);

    // Extract examples
    const examples = this.extractExamples($);

    // Determine category
    const category = this.determineCategory(name, url);

    return {
      name,
      description,
      usage,
      options,
      examples,
      category,
    };
  }

  private extractCommandName($: cheerio.CheerioAPI): string {
    // Try multiple selectors for command name
    const selectors = [
      'h1 code',
      'h1',
      '.command-name',
      '[data-command]',
      '.page-title',
    ];

    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length) {
        let text = element.text().trim();
        // Clean up command name
        text = text.replace(/^gemini-cli\s+/, '')
                   .replace(/^gemini\s+/, '')
                   .replace(/\s+command$/i, '')
                   .trim();
        if (text) return text;
      }
    }

    return '';
  }

  private extractDescription($: cheerio.CheerioAPI): string {
    // Try to find description
    const selectors = [
      '.description',
      '.lead',
      'h1 + p',
      '.command-description',
      'p:first-of-type',
    ];

    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim()) {
        return element.text().trim();
      }
    }

    return 'No description available';
  }

  private extractUsage($: cheerio.CheerioAPI): string {
    // Look for usage section
    const usageHeader = $('h2, h3, h4').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('usage') || text.includes('syntax');
    }).first();

    if (usageHeader.length) {
      const usageCode = usageHeader.next('pre, code, .usage');
      if (usageCode.length) {
        return usageCode.text().trim();
      }
    }

    // Fallback: look for any code block near the top
    const firstCode = $('pre code, code.usage').first();
    if (firstCode.length) {
      return firstCode.text().trim();
    }

    return '';
  }

  private extractOptions($: cheerio.CheerioAPI): CLIOption[] {
    const options: CLIOption[] = [];

    // Look for options/flags section
    const optionsHeader = $('h2, h3, h4').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('option') || text.includes('flag') || text.includes('parameter');
    }).first();

    if (optionsHeader.length) {
      // Try to find table or list of options
      const optionsTable = optionsHeader.nextAll('table').first();

      if (optionsTable.length) {
        // Parse table
        optionsTable.find('tbody tr').each((_, row) => {
          const $row = $(row);
          const cells = $row.find('td');

          if (cells.length >= 2) {
            const nameCell = $(cells[0]).text().trim();
            const descCell = $(cells[1]).text().trim();

            // Parse option name (might include shorthand)
            const nameMatch = nameCell.match(/(-{1,2}\w+)/g);
            if (nameMatch) {
              const name = nameMatch.find(n => n.startsWith('--')) || nameMatch[0];
              const shorthand = nameMatch.find(n => n.startsWith('-') && !n.startsWith('--'));

              options.push({
                name: name.replace(/^--/, ''),
                shorthand: shorthand?.replace(/^-/, ''),
                description: descCell,
                required: nameCell.toLowerCase().includes('required'),
              });
            }
          }
        });
      } else {
        // Try to find list
        const optionsList = optionsHeader.nextAll('ul, dl').first();

        optionsList.find('li, dt').each((_, item) => {
          const $item = $(item);
          const text = $item.text();

          const match = text.match(/(-{1,2}[\w-]+)(.*)/);
          if (match) {
            const name = match[1].replace(/^--/, '');
            const description = match[2].trim();

            options.push({
              name,
              description,
              required: text.toLowerCase().includes('required'),
            });
          }
        });
      }
    }

    return options;
  }

  private extractExamples($: cheerio.CheerioAPI): string[] {
    const examples: string[] = [];

    // Look for examples section
    const examplesHeader = $('h2, h3, h4').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('example') || text.includes('sample');
    }).first();

    if (examplesHeader.length) {
      // Find all code blocks after the examples header
      let current = examplesHeader.next();

      while (current.length && !current.is('h1, h2, h3, h4')) {
        if (current.is('pre') || current.find('code').length) {
          const code = current.find('code').length
            ? current.find('code').text().trim()
            : current.text().trim();

          if (code) {
            examples.push(code);
          }
        }

        current = current.next();
      }
    }

    // Fallback: collect all code blocks
    if (examples.length === 0) {
      $('pre code, code.language-bash, code.language-shell').each((_, el) => {
        const code = $(el).text().trim();
        if (code.startsWith('gemini') || code.startsWith('$')) {
          examples.push(code);
        }
      });
    }

    return examples;
  }

  private determineCategory(name: string, url: string): string {
    const lowerName = name.toLowerCase();
    const lowerUrl = url.toLowerCase();

    if (lowerName.includes('chat') || lowerUrl.includes('/chat')) return 'Chat';
    if (lowerName.includes('generate') || lowerUrl.includes('/generate')) return 'Generation';
    if (lowerName.includes('embed') || lowerUrl.includes('/embed')) return 'Embeddings';
    if (lowerName.includes('model') || lowerUrl.includes('/model')) return 'Models';
    if (lowerName.includes('config') || lowerUrl.includes('/config')) return 'Configuration';
    if (lowerName.includes('auth') || lowerUrl.includes('/auth')) return 'Authentication';

    return 'General';
  }

  private async saveCommandFile(command: CLICommandInfo): Promise<void> {
    const fileName = `${command.name.replace(/\s+/g, '-').toLowerCase()}.md`;
    const filePath = path.join(this.config.outputDir, 'commands', fileName);

    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const content = this.generateCommandMarkdown(command);
    await fs.writeFile(filePath, content, 'utf-8');

    // Save JSON
    const jsonPath = filePath.replace('.md', '.json');
    await fs.writeFile(jsonPath, JSON.stringify(command, null, 2), 'utf-8');
  }

  private generateCommandMarkdown(command: CLICommandInfo): string {
    let md = `---
title: ${command.name}
description: ${command.description}
category: ${command.category}
type: cli-command
---

# ${command.name}

${command.description}

`;

    if (command.usage) {
      md += `## Usage

\`\`\`bash
${command.usage}
\`\`\`

`;
    }

    if (command.options.length > 0) {
      md += `## Options

| Option | Shorthand | Required | Description |
|--------|-----------|----------|-------------|
`;

      for (const option of command.options) {
        md += `| \`--${option.name}\` | ${option.shorthand ? `\`-${option.shorthand}\`` : '-'} | ${option.required ? '✓' : '✗'} | ${option.description} |\n`;
      }

      md += '\n';
    }

    if (command.examples.length > 0) {
      md += `## Examples

`;

      command.examples.forEach((example, idx) => {
        md += `### Example ${idx + 1}

\`\`\`bash
${example}
\`\`\`

`;
      });
    }

    md += `## Category

${command.category}
`;

    return md;
  }

  private async saveIndexFile(): Promise<void> {
    const indexPath = path.join(this.config.outputDir, 'README.md');

    let content = `---
title: Gemini CLI Reference
description: Complete command reference for the Gemini CLI
---

# Gemini CLI Reference

This documentation is automatically scraped from [geminicli.com](https://geminicli.com/docs/).

**Total Commands**: ${this.commands.length}

## Commands by Category

`;

    // Group by category
    const grouped = new Map<string, CLICommandInfo[]>();

    for (const command of this.commands) {
      if (!grouped.has(command.category)) {
        grouped.set(command.category, []);
      }
      grouped.get(command.category)!.push(command);
    }

    // Sort categories
    const sortedCategories = Array.from(grouped.keys()).sort();

    for (const category of sortedCategories) {
      const commands = grouped.get(category)!;
      content += `### ${category}\n\n`;

      for (const command of commands) {
        const fileName = `${command.name.replace(/\s+/g, '-').toLowerCase()}.md`;
        content += `- [\`${command.name}\`](commands/${fileName}) - ${command.description}\n`;
      }

      content += '\n';
    }

    content += `---

*Last updated: ${new Date().toISOString()}*

*Source: [geminicli.com/docs](https://geminicli.com/docs/)*
`;

    await fs.writeFile(indexPath, content, 'utf-8');
  }

  getCommands(): CLICommandInfo[] {
    return this.commands;
  }
}
