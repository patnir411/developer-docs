import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import ora from 'ora';

export class ExportCommand {
  private docsDir: string;

  constructor() {
    this.docsDir = path.join(__dirname, '../../../');
  }

  async execute(options: any) {
    const spinner = ora(`Exporting documentation as ${options.format}...`).start();

    try {
      const exportData = await this.gatherData(options.type || 'all');

      const outputFile = options.output || `gemini-docs-export.${options.format}`;

      let content: string;

      switch (options.format) {
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          break;
        case 'md':
          content = this.formatAsMarkdown(exportData);
          break;
        case 'html':
          content = this.formatAsHtml(exportData);
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      await fs.writeFile(outputFile, content, 'utf-8');

      spinner.succeed(`Documentation exported to: ${outputFile}`);

      console.log(chalk.green(`\n✓ Exported ${exportData.totalFiles} files`));
      console.log(chalk.blue(`  Format: ${options.format}`));
      console.log(chalk.blue(`  Output: ${outputFile}\n`));
    } catch (error) {
      spinner.fail('Export failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  private async gatherData(type: string): Promise<any> {
    let pattern = '**/*.md';

    switch (type) {
      case 'methods':
        pattern = '**/methods/**/*.md';
        break;
      case 'models':
        pattern = '**/models/**/*.md';
        break;
      case 'guides':
        pattern = '**/guides/**/*.md';
        break;
    }

    const files = await glob(path.join(this.docsDir, pattern), {
      ignore: ['**/node_modules/**', '**/.git/**', '**/changelog/**'],
    });

    const data: any = {
      exportDate: new Date().toISOString(),
      type,
      totalFiles: files.length,
      files: [],
    };

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const relativePath = path.relative(this.docsDir, file);

      data.files.push({
        path: relativePath,
        content,
        metadata: this.extractMetadata(content),
      });
    }

    return data;
  }

  private extractMetadata(content: string): any {
    const metadata: any = {};

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

    return metadata;
  }

  private formatAsMarkdown(data: any): string {
    let md = `# Gemini API Documentation Export\n\n`;
    md += `**Exported**: ${data.exportDate}\n`;
    md += `**Type**: ${data.type}\n`;
    md += `**Files**: ${data.totalFiles}\n\n`;
    md += `---\n\n`;

    for (const file of data.files) {
      md += `## ${file.path}\n\n`;
      md += file.content + '\n\n';
      md += `---\n\n`;
    }

    return md;
  }

  private formatAsHtml(data: any): string {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Gemini API Documentation</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a73e8; }
    h2 { color: #34a853; border-bottom: 2px solid #34a853; padding-bottom: 5px; }
    pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Gemini API Documentation</h1>
  <p><strong>Exported:</strong> ${data.exportDate}</p>
  <p><strong>Type:</strong> ${data.type}</p>
  <p><strong>Files:</strong> ${data.totalFiles}</p>
  <hr>
`;

    for (const file of data.files) {
      html += `  <h2>${file.path}</h2>\n`;
      html += `  <pre>${this.escapeHtml(file.content)}</pre>\n`;
    }

    html += `</body>\n</html>`;

    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
