import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import fuzzy from 'fuzzy';
import ora from 'ora';

interface SearchResult {
  file: string;
  title: string;
  excerpt: string;
  score: number;
  type: 'method' | 'model' | 'guide' | 'other';
}

export class SearchCommand {
  private docsDir: string;

  constructor() {
    this.docsDir = path.join(__dirname, '../../../');
  }

  async execute(query: string, options: any) {
    const spinner = ora('Searching documentation...').start();

    try {
      // Find all documentation files
      const files = await this.findDocFiles(options.type);

      // Search through files
      const results = await this.searchFiles(files, query);

      spinner.stop();

      if (results.length === 0) {
        console.log(chalk.yellow(`\n❌ No results found for: ${chalk.bold(query)}\n`));
        return;
      }

      // Sort by score and limit
      results.sort((a, b) => b.score - a.score);
      const limited = results.slice(0, parseInt(options.limit));

      if (options.json) {
        console.log(JSON.stringify(limited, null, 2));
        return;
      }

      // Display results
      console.log(chalk.bold.cyan(`\n🔍 Search Results for: ${chalk.white(query)}\n`));
      console.log(chalk.dim(`Found ${results.length} results (showing top ${limited.length})\n`));

      for (let i = 0; i < limited.length; i++) {
        const result = limited[i];
        const icon = this.getTypeIcon(result.type);

        console.log(chalk.bold(`${i + 1}. ${icon} ${result.title}`));
        console.log(chalk.dim(`   ${result.file}`));
        console.log(chalk.gray(`   ${result.excerpt.substring(0, 200)}${result.excerpt.length > 200 ? '...' : ''}`));
        console.log('');
      }
    } catch (error) {
      spinner.fail('Search failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  private async findDocFiles(typeFilter?: string): Promise<string[]> {
    let pattern = '**/*.md';

    if (typeFilter) {
      switch (typeFilter) {
        case 'method':
          pattern = '**/methods/**/*.md';
          break;
        case 'model':
          pattern = '**/models/**/*.md';
          break;
        case 'guide':
          pattern = '**/guides/**/*.md';
          break;
      }
    }

    const files = await glob(path.join(this.docsDir, pattern), {
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/changelog/**'],
    });

    return files;
  }

  private async searchFiles(files: string[], query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        // Extract title
        const title = this.extractTitle(content);

        // Check if query matches
        const titleMatch = title.toLowerCase().includes(lowerQuery);
        const contentMatch = content.toLowerCase().includes(lowerQuery);

        if (titleMatch || contentMatch) {
          // Calculate score
          let score = 0;
          if (titleMatch) score += 10;
          if (contentMatch) score += 5;

          // Fuzzy match bonus
          const fuzzyResult = fuzzy.filter(lowerQuery, [title.toLowerCase()]);
          if (fuzzyResult.length > 0) {
            score += fuzzyResult[0].score || 0;
          }

          // Extract excerpt around query
          const excerpt = this.extractExcerpt(content, lowerQuery);

          results.push({
            file: path.relative(this.docsDir, file),
            title,
            excerpt,
            score,
            type: this.determineType(file),
          });
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return results;
  }

  private extractTitle(content: string): string {
    // Try frontmatter first
    const frontmatterMatch = content.match(/^---\n[\s\S]*?title:\s*(.+)\n[\s\S]*?---/);
    if (frontmatterMatch) {
      return frontmatterMatch[1].trim();
    }

    // Try first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }

    return 'Untitled';
  }

  private extractExcerpt(content: string, query: string): string {
    // Find the first occurrence of the query
    const index = content.toLowerCase().indexOf(query.toLowerCase());

    if (index === -1) {
      // Return first paragraph if query not found in content
      const firstPara = content.split('\n\n')[0];
      return firstPara.replace(/[#*`]/g, '').trim();
    }

    // Extract context around the query
    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + query.length + 100);

    let excerpt = content.substring(start, end);

    // Clean up markdown syntax
    excerpt = excerpt.replace(/[#*`]/g, '').trim();

    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';

    return excerpt;
  }

  private determineType(filePath: string): 'method' | 'model' | 'guide' | 'other' {
    if (filePath.includes('/methods/')) return 'method';
    if (filePath.includes('/models/')) return 'model';
    if (filePath.includes('/guides/')) return 'guide';
    return 'other';
  }

  private getTypeIcon(type: string): string {
    switch (type) {
      case 'method':
        return '⚡';
      case 'model':
        return '🤖';
      case 'guide':
        return '📚';
      default:
        return '📄';
    }
  }
}
