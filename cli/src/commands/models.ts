import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { table } from 'table';
import ora from 'ora';

interface ModelInfo {
  name: string;
  description: string;
  capabilities: string[];
  contextWindow?: number;
  inputCost?: string;
  outputCost?: string;
}

export class ModelsCommand {
  private docsDir: string;

  constructor() {
    this.docsDir = path.join(__dirname, '../../../');
  }

  async execute(options: any) {
    const spinner = ora('Loading model information...').start();

    try {
      const models = await this.loadModels();

      spinner.stop();

      if (models.length === 0) {
        console.log(chalk.yellow('\n⚠️  No model documentation found.\n'));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(models, null, 2));
        return;
      }

      if (options.compare) {
        this.displayComparison(models);
      } else {
        this.displayList(models);
      }
    } catch (error) {
      spinner.fail('Failed to load models');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  private async loadModels(): Promise<ModelInfo[]> {
    const modelFiles = await glob(path.join(this.docsDir, '**/models/**/*.md'), {
      ignore: ['**/node_modules/**', '**/.git/**', '**/README.md'],
    });

    const models: ModelInfo[] = [];

    for (const file of modelFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const model = this.parseModelInfo(content, file);
      if (model) {
        models.push(model);
      }
    }

    return models;
  }

  private parseModelInfo(content: string, filePath: string): ModelInfo | null {
    const name = path.basename(filePath, '.md');

    // Extract title
    const titleMatch = content.match(/^#\s+(.+)$/m) ||
                      content.match(/^title:\s*(.+)$/m);

    // Extract description
    const descMatch = content.match(/^description:\s*(.+)$/m);

    return {
      name: titleMatch ? titleMatch[1].trim() : name,
      description: descMatch ? descMatch[1].trim() : 'No description available',
      capabilities: this.extractCapabilities(content),
      contextWindow: this.extractContextWindow(content),
    };
  }

  private extractCapabilities(content: string): string[] {
    const caps: string[] = [];

    if (content.toLowerCase().includes('multimodal') || content.includes('vision')) {
      caps.push('Vision');
    }
    if (content.toLowerCase().includes('audio')) {
      caps.push('Audio');
    }
    if (content.toLowerCase().includes('function calling')) {
      caps.push('Function Calling');
    }
    if (content.toLowerCase().includes('streaming')) {
      caps.push('Streaming');
    }
    if (content.toLowerCase().includes('thinking')) {
      caps.push('Thinking Mode');
    }

    return caps;
  }

  private extractContextWindow(content: string): number | undefined {
    const match = content.match(/context\s*window[:\s]+([0-9,]+)/i);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return undefined;
  }

  private displayList(models: ModelInfo[]) {
    console.log(chalk.bold.cyan('\n🤖 Gemini Models\n'));

    for (const model of models) {
      console.log(chalk.bold.white(model.name));
      console.log(chalk.gray(`  ${model.description}`));

      if (model.capabilities.length > 0) {
        console.log(chalk.cyan(`  Capabilities: ${model.capabilities.join(', ')}`));
      }

      if (model.contextWindow) {
        console.log(chalk.dim(`  Context Window: ${model.contextWindow.toLocaleString()} tokens`));
      }

      console.log('');
    }
  }

  private displayComparison(models: ModelInfo[]) {
    console.log(chalk.bold.cyan('\n🤖 Gemini Models Comparison\n'));

    const data: string[][] = [
      ['Model', 'Description', 'Capabilities', 'Context'],
    ];

    for (const model of models) {
      data.push([
        model.name,
        model.description.substring(0, 40) + '...',
        model.capabilities.join('\n'),
        model.contextWindow ? `${(model.contextWindow / 1000).toFixed(0)}K` : 'N/A',
      ]);
    }

    console.log(table(data, {
      header: {
        alignment: 'center',
        content: chalk.bold.cyan('Gemini Models'),
      },
    }));

    console.log('');
  }
}
