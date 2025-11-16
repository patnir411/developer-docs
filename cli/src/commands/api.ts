import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import ora from 'ora';

export class ApiCommand {
  private docsDir: string;

  constructor() {
    this.docsDir = path.join(__dirname, '../../../gemini-api');
  }

  async execute(options: any) {
    const spinner = ora('Loading Gemini API documentation...').start();

    try {
      const action = options.action || 'list';

      switch (action) {
        case 'list':
          await this.listEndpoints(spinner);
          break;
        case 'models':
          await this.listModels(spinner);
          break;
        case 'methods':
          await this.listMethods(spinner);
          break;
        case 'stats':
          await this.showStats(spinner);
          break;
        default:
          spinner.fail(`Unknown action: ${action}`);
      }
    } catch (error) {
      spinner.fail('Failed to load API documentation');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  private async listEndpoints(spinner: ora.Ora) {
    const files = await glob(path.join(this.docsDir, '**/*.md'), {
      ignore: ['**/README.md', '**/node_modules/**'],
    });

    spinner.stop();

    console.log(chalk.bold.cyan('\n🔷 Gemini API Documentation\n'));
    console.log(chalk.blue(`Source: https://ai.google.dev/gemini-api/docs`));
    console.log(chalk.dim(`Total files: ${files.length}\n`));

    const categorized = await this.categorizeFiles(files);

    for (const [category, fileList] of Object.entries(categorized)) {
      console.log(chalk.bold.green(`\n${category}:`));
      for (const file of fileList) {
        const relativePath = path.relative(this.docsDir, file);
        console.log(chalk.white(`  • ${relativePath}`));
      }
    }

    console.log('');
  }

  private async listModels(spinner: ora.Ora) {
    const modelsDir = path.join(this.docsDir, 'models');
    const files = await glob(path.join(modelsDir, '*.md'), {
      ignore: ['**/README.md'],
    });

    spinner.stop();

    console.log(chalk.bold.cyan('\n🤖 Gemini API Models\n'));

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const title = this.extractTitle(content);
      const fileName = path.basename(file, '.md');

      console.log(chalk.bold.white(`${title || fileName}`));
      console.log(chalk.dim(`  File: ${path.relative(this.docsDir, file)}`));

      // Extract capabilities
      const capabilities = this.extractCapabilities(content);
      if (capabilities.length > 0) {
        console.log(chalk.cyan(`  Capabilities: ${capabilities.join(', ')}`));
      }

      console.log('');
    }
  }

  private async listMethods(spinner: ora.Ora) {
    const methodsDir = path.join(this.docsDir, 'methods');
    const files = await glob(path.join(methodsDir, '*.md'), {
      ignore: ['**/README.md'],
    });

    spinner.stop();

    console.log(chalk.bold.cyan('\n⚡ Gemini API Methods\n'));

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const title = this.extractTitle(content);
      const description = this.extractDescription(content);
      const fileName = path.basename(file, '.md');

      console.log(chalk.bold.white(`${title || fileName}`));
      if (description) {
        console.log(chalk.gray(`  ${description.substring(0, 80)}...`));
      }
      console.log('');
    }
  }

  private async showStats(spinner: ora.Ora) {
    const files = await glob(path.join(this.docsDir, '**/*.md'), {
      ignore: ['**/README.md', '**/node_modules/**'],
    });

    let totalWords = 0;
    let totalCodeBlocks = 0;

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      totalWords += content.split(/\s+/).filter(Boolean).length;
      const codeMatches = content.match(/```/g);
      totalCodeBlocks += codeMatches ? codeMatches.length / 2 : 0;
    }

    spinner.stop();

    console.log(chalk.bold.cyan('\n📊 Gemini API Documentation Stats\n'));
    console.log(chalk.white(`Total Files: ${files.length}`));
    console.log(chalk.white(`Total Words: ${totalWords.toLocaleString()}`));
    console.log(chalk.white(`Code Examples: ${totalCodeBlocks}`));
    console.log('');
  }

  private async categorizeFiles(files: string[]): Promise<Record<string, string[]>> {
    const categories: Record<string, string[]> = {
      'Models': [],
      'Methods': [],
      'Parameters': [],
      'Guides': [],
      'Examples': [],
      'Other': [],
    };

    for (const file of files) {
      const relativePath = path.relative(this.docsDir, file);
      if (relativePath.includes('models/')) {
        categories['Models'].push(file);
      } else if (relativePath.includes('methods/')) {
        categories['Methods'].push(file);
      } else if (relativePath.includes('parameters/')) {
        categories['Parameters'].push(file);
      } else if (relativePath.includes('guides/')) {
        categories['Guides'].push(file);
      } else if (relativePath.includes('examples/')) {
        categories['Examples'].push(file);
      } else {
        categories['Other'].push(file);
      }
    }

    // Remove empty categories
    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m) || content.match(/^title:\s*(.+)$/m);
    return match ? match[1].trim() : '';
  }

  private extractDescription(content: string): string {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('description:')) {
        return line.replace('description:', '').trim();
      }
      if (line && !line.startsWith('#') && !line.startsWith('---') && line.length > 20) {
        return line;
      }
    }
    return '';
  }

  private extractCapabilities(content: string): string[] {
    const caps: string[] = [];
    const lower = content.toLowerCase();

    if (lower.includes('multimodal') || lower.includes('vision')) caps.push('Vision');
    if (lower.includes('audio')) caps.push('Audio');
    if (lower.includes('function calling')) caps.push('Function Calling');
    if (lower.includes('thinking')) caps.push('Thinking Mode');
    if (lower.includes('streaming')) caps.push('Streaming');

    return caps;
  }
}
