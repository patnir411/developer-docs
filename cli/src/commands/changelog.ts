import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { parseISO, isAfter } from 'date-fns';
import ora from 'ora';

export class ChangelogCommand {
  private changelogDir: string;

  constructor() {
    this.changelogDir = path.join(__dirname, '../../../changelog');
  }

  async execute(options: any) {
    const spinner = ora('Loading changelog...').start();

    try {
      let content: string;

      if (options.since) {
        content = await this.getChangesSince(new Date(options.since), parseInt(options.limit));
      } else {
        content = await this.getLatestChangelog();
      }

      spinner.stop();

      if (!content) {
        console.log(chalk.yellow('\n⚠️  No changelog found.\n'));
        console.log(chalk.dim('Run the scraper and change tracker to generate changelogs.\n'));
        return;
      }

      if (options.json) {
        const entries = await this.loadChangelogEntries(options.since, parseInt(options.limit));
        console.log(JSON.stringify(entries, null, 2));
        return;
      }

      console.log(chalk.bold.cyan('\n📝 Gemini API Changelog\n'));
      console.log(content);
      console.log('');
    } catch (error) {
      spinner.fail('Failed to load changelog');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  private async getLatestChangelog(): Promise<string> {
    const latestPath = path.join(this.changelogDir, 'LATEST.md');

    try {
      return await fs.readFile(latestPath, 'utf-8');
    } catch {
      return '';
    }
  }

  private async getChangesSince(since: Date, limit: number): Promise<string> {
    const entries = await this.loadChangelogEntries(since.toISOString(), limit);

    if (entries.length === 0) {
      return '';
    }

    let output = '';

    for (const entry of entries) {
      const content = await fs.readFile(entry.path, 'utf-8');
      output += content + '\n\n---\n\n';
    }

    return output;
  }

  private async loadChangelogEntries(since?: string, limit?: number): Promise<any[]> {
    const pattern = path.join(this.changelogDir, '**/*.json');
    const files = await glob(pattern, {
      ignore: ['**/LATEST.json', '**/CHANGELOG.json'],
    });

    const entries: any[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const entry = JSON.parse(content);

        if (since) {
          const entryDate = parseISO(entry.date);
          const sinceDate = parseISO(since);

          if (isAfter(entryDate, sinceDate)) {
            entries.push({ ...entry, path: file.replace('.json', '.md') });
          }
        } else {
          entries.push({ ...entry, path: file.replace('.json', '.md') });
        }
      } catch {
        continue;
      }
    }

    // Sort by date (descending)
    entries.sort((a, b) => b.date.localeCompare(a.date));

    return limit ? entries.slice(0, limit) : entries;
  }
}
