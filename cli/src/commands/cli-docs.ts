import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { table } from 'table';
import ora from 'ora';

export class CliDocsCommand {
  private docsDir: string;

  constructor() {
    this.docsDir = path.join(__dirname, '../../../gemini-cli');
  }

  async execute(options: any) {
    const spinner = ora('Loading Gemini CLI documentation...').start();

    try {
      const action = options.action || 'list';

      switch (action) {
        case 'list':
          await this.listCommands(spinner);
          break;
        case 'commands':
          await this.showCommandsTable(spinner);
          break;
        case 'categories':
          await this.showByCategory(spinner);
          break;
        case 'stats':
          await this.showStats(spinner);
          break;
        default:
          spinner.fail(`Unknown action: ${action}`);
      }
    } catch (error) {
      spinner.fail('Failed to load CLI documentation');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  private async listCommands(spinner: ora.Ora) {
    const commandsDir = path.join(this.docsDir, 'commands');
    const files = await glob(path.join(commandsDir, '*.md'), {
      ignore: ['**/README.md'],
    });

    spinner.stop();

    console.log(chalk.bold.cyan('\n🔶 Gemini CLI Commands\n'));
    console.log(chalk.blue(`Source: https://geminicli.com/docs`));
    console.log(chalk.dim(`Total commands: ${files.length}\n`));

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const commandInfo = this.parseCommandFile(content);
      const fileName = path.basename(file, '.md');

      console.log(chalk.bold.white(`gemini ${commandInfo.title || fileName}`));
      if (commandInfo.description) {
        console.log(chalk.gray(`  ${commandInfo.description}`));
      }
      if (commandInfo.usage) {
        console.log(chalk.dim(`  Usage: ${commandInfo.usage}`));
      }
      console.log('');
    }
  }

  private async showCommandsTable(spinner: ora.Ora) {
    const commandsDir = path.join(this.docsDir, 'commands');
    const files = await glob(path.join(commandsDir, '*.md'), {
      ignore: ['**/README.md'],
    });

    const tableData: string[][] = [
      ['Command', 'Description', 'Category']
    ];

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const commandInfo = this.parseCommandFile(content);
      const fileName = path.basename(file, '.md');

      tableData.push([
        fileName,
        (commandInfo.description || '').substring(0, 50),
        commandInfo.category || 'General'
      ]);
    }

    spinner.stop();

    console.log(chalk.bold.cyan('\n🔶 Gemini CLI Commands Reference\n'));
    console.log(table(tableData));
  }

  private async showByCategory(spinner: ora.Ora) {
    const commandsDir = path.join(this.docsDir, 'commands');
    const files = await glob(path.join(commandsDir, '*.md'), {
      ignore: ['**/README.md'],
    });

    const categories = new Map<string, Array<{name: string, description: string}>>();

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const commandInfo = this.parseCommandFile(content);
      const fileName = path.basename(file, '.md');
      const category = commandInfo.category || 'General';

      if (!categories.has(category)) {
        categories.set(category, []);
      }

      categories.get(category)!.push({
        name: fileName,
        description: commandInfo.description || 'No description'
      });
    }

    spinner.stop();

    console.log(chalk.bold.cyan('\n🔶 Gemini CLI Commands by Category\n'));

    const sortedCategories = Array.from(categories.keys()).sort();

    for (const category of sortedCategories) {
      console.log(chalk.bold.green(`\n${category}:`));
      const commands = categories.get(category)!;

      for (const cmd of commands) {
        console.log(chalk.white(`  gemini ${cmd.name}`));
        console.log(chalk.dim(`    ${cmd.description.substring(0, 70)}`));
      }
    }

    console.log('');
  }

  private async showStats(spinner: ora.Ora) {
    const files = await glob(path.join(this.docsDir, '**/*.md'), {
      ignore: ['**/README.md', '**/node_modules/**'],
    });

    let totalCommands = 0;
    let totalOptions = 0;
    let totalExamples = 0;

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');

      if (file.includes('/commands/')) {
        totalCommands++;
      }

      // Count options (lines with --)
      const optionMatches = content.match(/--\w+/g);
      totalOptions += optionMatches ? optionMatches.length : 0;

      // Count example blocks
      const exampleMatches = content.match(/### Example|```bash/g);
      totalExamples += exampleMatches ? exampleMatches.length : 0;
    }

    spinner.stop();

    console.log(chalk.bold.cyan('\n📊 Gemini CLI Documentation Stats\n'));
    console.log(chalk.white(`Total Commands: ${totalCommands}`));
    console.log(chalk.white(`Total Options: ${totalOptions}`));
    console.log(chalk.white(`Total Examples: ${totalExamples}`));
    console.log(chalk.white(`Documentation Files: ${files.length}`));
    console.log('');
  }

  private parseCommandFile(content: string): {
    title: string;
    description: string;
    usage: string;
    category: string;
  } {
    const result = {
      title: '',
      description: '',
      usage: '',
      category: ''
    };

    // Extract from frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      frontmatter.split('\n').forEach(line => {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const key = match[1] as keyof typeof result;
          if (key in result) {
            result[key] = match[2];
          }
        }
      });
    }

    // Extract from content if not in frontmatter
    if (!result.title) {
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) result.title = titleMatch[1].trim();
    }

    if (!result.usage) {
      const usageMatch = content.match(/```bash\n(.+?)\n```/s);
      if (usageMatch) result.usage = usageMatch[1].trim().split('\n')[0];
    }

    return result;
  }
}
