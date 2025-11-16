import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import ora from 'ora';

// Configure marked for terminal output
marked.setOptions({
  renderer: new TerminalRenderer(),
});

export class MethodCommand {
  private docsDir: string;

  constructor() {
    this.docsDir = path.join(__dirname, '../../../');
  }

  async execute(methodName: string, options: any) {
    const spinner = ora(`Looking up method: ${methodName}`).start();

    try {
      // Find the method file
      const methodFile = await this.findMethodFile(methodName);

      if (!methodFile) {
        spinner.fail(`Method not found: ${methodName}`);
        console.log(chalk.yellow('\n💡 Try searching for it:'));
        console.log(chalk.cyan(`   gemini-docs search "${methodName}"\n`));
        return;
      }

      // Read the file
      const content = await fs.readFile(methodFile, 'utf-8');

      spinner.stop();

      if (options.json) {
        const metadata = this.extractMetadata(content);
        console.log(JSON.stringify(metadata, null, 2));
        return;
      }

      // Display method information
      this.displayMethod(content, methodName, options);
    } catch (error) {
      spinner.fail('Failed to retrieve method information');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  private async findMethodFile(methodName: string): Promise<string | null> {
    // Try multiple patterns
    const patterns = [
      `**/methods/${methodName}.md`,
      `**/methods/${methodName.replace(/\./g, '_')}.md`,
      `**/*${methodName}*.md`,
    ];

    for (const pattern of patterns) {
      const files = await glob(path.join(this.docsDir, pattern), {
        ignore: ['**/node_modules/**', '**/.git/**', '**/changelog/**'],
      });

      if (files.length > 0) {
        return files[0];
      }
    }

    return null;
  }

  private extractMetadata(content: string): any {
    const metadata: any = {};

    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      frontmatter.split('\n').forEach(line => {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          metadata[match[1]] = match[2];
        }
      });
    }

    // Extract parameters
    const paramsMatch = content.match(/## Parameters\n\n([\s\S]*?)(?=\n##|$)/);
    if (paramsMatch) {
      metadata.parameters = this.parseParameterTable(paramsMatch[1]);
    }

    // Extract return type
    const returnsMatch = content.match(/## Returns\n\n```\n([\s\S]*?)\n```/);
    if (returnsMatch) {
      metadata.returnType = returnsMatch[1].trim();
    }

    // Extract examples
    const examples: string[] = [];
    const exampleMatches = content.matchAll(/```(\w+)\n([\s\S]*?)\n```/g);
    for (const match of exampleMatches) {
      examples.push({ language: match[1], code: match[2] });
    }
    metadata.examples = examples;

    return metadata;
  }

  private parseParameterTable(tableStr: string): any[] {
    const params: any[] = [];
    const lines = tableStr.split('\n').filter(l => l.trim() && !l.includes('---'));

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 4) {
        params.push({
          name: cells[0].replace(/`/g, ''),
          type: cells[1].replace(/`/g, ''),
          required: cells[2].includes('✓'),
          description: cells[3],
        });
      }
    }

    return params;
  }

  private displayMethod(content: string, methodName: string, options: any) {
    console.log(chalk.bold.cyan(`\n⚡ ${methodName}\n`));

    // Remove frontmatter for display
    const displayContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');

    if (options.examples) {
      // Show only examples
      const examplesMatch = displayContent.match(/## Examples\n\n([\s\S]*?)(?=\n##|$)/);
      if (examplesMatch) {
        console.log(marked(examplesMatch[0]));
      } else {
        console.log(chalk.yellow('No examples found for this method.\n'));
      }
    } else {
      // Show full documentation
      console.log(marked(displayContent));
    }

    console.log('');
  }
}
