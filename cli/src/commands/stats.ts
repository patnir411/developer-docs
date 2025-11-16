import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { table } from 'table';
import ora from 'ora';

export class StatsCommand {
  private docsDir: string;

  constructor() {
    this.docsDir = path.join(__dirname, '../../../');
  }

  async execute(options: any) {
    const spinner = ora('Calculating statistics...').start();

    try {
      const stats = await this.calculateStats();

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      this.displayStats(stats);
    } catch (error) {
      spinner.fail('Failed to calculate statistics');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  private async calculateStats(): Promise<any> {
    const allFiles = await glob(path.join(this.docsDir, '**/*.md'), {
      ignore: ['**/node_modules/**', '**/.git/**'],
    });

    const stats: any = {
      totalFiles: allFiles.length,
      totalSize: 0,
      totalWords: 0,
      totalCodeBlocks: 0,
      byCategory: {},
      byLanguage: {},
      lastUpdated: new Date().toISOString(),
    };

    for (const file of allFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const fileStats = await fs.stat(file);

      stats.totalSize += fileStats.size;
      stats.totalWords += content.split(/\s+/).filter(Boolean).length;

      // Count code blocks
      const codeBlocks = content.match(/```/g);
      stats.totalCodeBlocks += codeBlocks ? codeBlocks.length / 2 : 0;

      // Categorize by directory
      const category = this.categorizeFile(file);
      if (!stats.byCategory[category]) {
        stats.byCategory[category] = { files: 0, size: 0 };
      }
      stats.byCategory[category].files++;
      stats.byCategory[category].size += fileStats.size;

      // Extract code languages
      const langMatches = content.matchAll(/```(\w+)/g);
      for (const match of langMatches) {
        const lang = match[1];
        stats.byLanguage[lang] = (stats.byLanguage[lang] || 0) + 1;
      }
    }

    return stats;
  }

  private categorizeFile(filePath: string): string {
    if (filePath.includes('/methods/')) return 'Methods';
    if (filePath.includes('/models/')) return 'Models';
    if (filePath.includes('/guides/')) return 'Guides';
    if (filePath.includes('/examples/')) return 'Examples';
    if (filePath.includes('/sdks/')) return 'SDKs';
    if (filePath.includes('/changelog/')) return 'Changelog';
    return 'Other';
  }

  private displayStats(stats: any) {
    console.log(chalk.bold.cyan('\n📊 Documentation Statistics\n'));

    console.log(chalk.bold('Overall:'));
    console.log(chalk.white(`  Total Files: ${stats.totalFiles.toLocaleString()}`));
    console.log(chalk.white(`  Total Size: ${(stats.totalSize / 1024).toFixed(2)} KB`));
    console.log(chalk.white(`  Total Words: ${stats.totalWords.toLocaleString()}`));
    console.log(chalk.white(`  Code Blocks: ${stats.totalCodeBlocks.toLocaleString()}\n`));

    // Category breakdown
    console.log(chalk.bold('By Category:'));
    const categoryData: string[][] = [['Category', 'Files', 'Size (KB)']];

    for (const [category, data] of Object.entries(stats.byCategory)) {
      categoryData.push([
        category,
        String((data as any).files),
        ((data as any).size / 1024).toFixed(2),
      ]);
    }

    console.log(table(categoryData));

    // Language breakdown
    console.log(chalk.bold('Top Languages in Examples:'));
    const langEntries = Object.entries(stats.byLanguage)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10);

    for (const [lang, count] of langEntries) {
      console.log(chalk.cyan(`  ${lang}: ${count} examples`));
    }

    console.log('');
  }
}
