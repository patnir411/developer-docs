import { DiffResult, FileChange } from './diff-generator';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { format } from 'date-fns';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: CategorizedChanges;
  breaking: string[];
  features: string[];
  fixes: string[];
  documentation: string[];
}

export interface CategorizedChanges {
  breaking: ChangeDescription[];
  features: ChangeDescription[];
  fixes: ChangeDescription[];
  documentation: ChangeDescription[];
}

export interface ChangeDescription {
  title: string;
  description: string;
  files: string[];
  type: 'api' | 'sdk' | 'docs' | 'other';
}

export class ChangelogGenerator {
  private changelogDir: string;

  constructor(changelogDir: string) {
    this.changelogDir = changelogDir;
  }

  async generateChangelog(diffResult: DiffResult): Promise<ChangelogEntry> {
    console.log(chalk.blue('📝 Generating changelog...'));

    const changes = this.categorizeChanges(diffResult);
    const entry: ChangelogEntry = {
      version: diffResult.to,
      date: format(new Date(diffResult.timestamp), 'yyyy-MM-dd'),
      changes,
      breaking: changes.breaking.map(c => c.title),
      features: changes.features.map(c => c.title),
      fixes: changes.fixes.map(c => c.title),
      documentation: changes.documentation.map(c => c.title),
    };

    // Save changelog
    await this.saveChangelog(entry);

    // Update latest changelog
    await this.updateLatestChangelog(entry);

    // Update master changelog (all entries)
    await this.updateMasterChangelog(entry);

    console.log(chalk.green(`✓ Changelog generated for version ${entry.version}`));

    return entry;
  }

  private categorizeChanges(diffResult: DiffResult): CategorizedChanges {
    const breaking: ChangeDescription[] = [];
    const features: ChangeDescription[] = [];
    const fixes: ChangeDescription[] = [];
    const documentation: ChangeDescription[] = [];

    // Process deleted files (breaking changes)
    for (const file of diffResult.changes.deleted) {
      breaking.push(this.createChangeDescription(file, 'deleted'));
    }

    // Process added files (features)
    for (const file of diffResult.changes.added) {
      features.push(this.createChangeDescription(file, 'added'));
    }

    // Process modified files
    for (const file of diffResult.changes.modified) {
      if (file.significance === 'major') {
        breaking.push(this.createChangeDescription(file, 'modified'));
      } else if (file.significance === 'minor') {
        features.push(this.createChangeDescription(file, 'modified'));
      } else {
        // Check if it's a fix or documentation update
        if (this.isDocumentationUpdate(file)) {
          documentation.push(this.createChangeDescription(file, 'modified'));
        } else {
          fixes.push(this.createChangeDescription(file, 'modified'));
        }
      }
    }

    return { breaking, features, fixes, documentation };
  }

  private createChangeDescription(
    file: FileChange,
    action: 'added' | 'modified' | 'deleted'
  ): ChangeDescription {
    const type = this.determineType(file.path);
    const title = this.generateTitle(file, action);
    const description = this.generateDescription(file, action);

    return {
      title,
      description,
      files: [file.path],
      type,
    };
  }

  private determineType(path: string): 'api' | 'sdk' | 'docs' | 'other' {
    if (path.includes('/methods/') || path.includes('/models/')) {
      return 'api';
    } else if (path.includes('/sdks/')) {
      return 'sdk';
    } else if (path.includes('/guides/') || path.includes('/examples/')) {
      return 'docs';
    }
    return 'other';
  }

  private generateTitle(file: FileChange, action: string): string {
    const fileName = path.basename(file.path, '.md');

    switch (action) {
      case 'added':
        return `Added ${fileName}`;
      case 'deleted':
        return `Removed ${fileName}`;
      case 'modified':
        if (file.details?.methodsAdded && file.details.methodsAdded.length > 0) {
          return `Added methods to ${fileName}: ${file.details.methodsAdded.join(', ')}`;
        }
        if (file.details?.methodsRemoved && file.details.methodsRemoved.length > 0) {
          return `Removed methods from ${fileName}: ${file.details.methodsRemoved.join(', ')}`;
        }
        if (file.details?.parametersChanged && file.details.parametersChanged.length > 0) {
          return `Updated parameters in ${fileName}`;
        }
        return `Updated ${fileName}`;
      default:
        return fileName;
    }
  }

  private generateDescription(file: FileChange, action: string): string {
    if (action === 'added') {
      return `New documentation added for ${file.path}`;
    } else if (action === 'deleted') {
      return `Documentation removed for ${file.path}`;
    } else {
      const details = file.details;
      if (!details) {
        return `Documentation updated for ${file.path}`;
      }

      const parts: string[] = [];

      if (details.linesAdded > 0) {
        parts.push(`${details.linesAdded} lines added`);
      }
      if (details.linesRemoved > 0) {
        parts.push(`${details.linesRemoved} lines removed`);
      }
      if (details.methodsAdded && details.methodsAdded.length > 0) {
        parts.push(`${details.methodsAdded.length} methods added`);
      }
      if (details.methodsRemoved && details.methodsRemoved.length > 0) {
        parts.push(`${details.methodsRemoved.length} methods removed`);
      }

      return parts.length > 0 ? parts.join(', ') : 'Minor updates';
    }
  }

  private isDocumentationUpdate(file: FileChange): boolean {
    // Consider it a documentation update if it's just fixing typos or improving docs
    const details = file.details;
    if (!details) return true;

    // If no methods or parameters changed, it's likely just documentation
    const hasMethodChanges = (details.methodsAdded && details.methodsAdded.length > 0) ||
                             (details.methodsRemoved && details.methodsRemoved.length > 0);
    const hasParamChanges = details.parametersChanged && details.parametersChanged.length > 0;

    return !hasMethodChanges && !hasParamChanges;
  }

  private async saveChangelog(entry: ChangelogEntry): Promise<void> {
    await fs.mkdir(this.changelogDir, { recursive: true });

    const yearDir = path.join(this.changelogDir, entry.date.substring(0, 4));
    await fs.mkdir(yearDir, { recursive: true });

    const filename = `${entry.version}.md`;
    const filepath = path.join(yearDir, filename);

    const content = this.formatChangelog(entry);
    await fs.writeFile(filepath, content, 'utf-8');

    // Also save JSON version
    const jsonPath = filepath.replace('.md', '.json');
    await fs.writeFile(jsonPath, JSON.stringify(entry, null, 2), 'utf-8');
  }

  private formatChangelog(entry: ChangelogEntry): string {
    let md = `# ${entry.version}\n\n`;
    md += `**Release Date**: ${entry.date}\n\n`;

    // Breaking changes
    if (entry.changes.breaking.length > 0) {
      md += `## ⚠️ Breaking Changes\n\n`;
      for (const change of entry.changes.breaking) {
        md += `### ${change.title}\n\n`;
        md += `${change.description}\n\n`;
        md += `**Affected files**:\n`;
        for (const file of change.files) {
          md += `- \`${file}\`\n`;
        }
        md += '\n';
      }
    }

    // New features
    if (entry.changes.features.length > 0) {
      md += `## ✨ New Features\n\n`;
      for (const change of entry.changes.features) {
        md += `### ${change.title}\n\n`;
        md += `${change.description}\n\n`;
      }
    }

    // Bug fixes
    if (entry.changes.fixes.length > 0) {
      md += `## 🐛 Bug Fixes\n\n`;
      for (const change of entry.changes.fixes) {
        md += `- ${change.title}: ${change.description}\n`;
      }
      md += '\n';
    }

    // Documentation updates
    if (entry.changes.documentation.length > 0) {
      md += `## 📚 Documentation\n\n`;
      for (const change of entry.changes.documentation) {
        md += `- ${change.title}\n`;
      }
      md += '\n';
    }

    return md;
  }

  private async updateLatestChangelog(entry: ChangelogEntry): Promise<void> {
    const latestPath = path.join(this.changelogDir, 'LATEST.md');
    const content = this.formatChangelog(entry);
    await fs.writeFile(latestPath, content, 'utf-8');
  }

  private async updateMasterChangelog(entry: ChangelogEntry): Promise<void> {
    const masterPath = path.join(this.changelogDir, 'CHANGELOG.md');

    let existingContent = '';
    try {
      existingContent = await fs.readFile(masterPath, 'utf-8');
    } catch {
      // File doesn't exist yet
      existingContent = '# Gemini API Documentation Changelog\n\nAll notable changes to the Gemini API documentation are tracked here.\n\n';
    }

    const newEntry = this.formatChangelog(entry);

    // Insert new entry after the header
    const headerEnd = existingContent.indexOf('\n\n') + 2;
    const updatedContent = existingContent.substring(0, headerEnd) +
                          '\n' +
                          newEntry +
                          '\n---\n\n' +
                          existingContent.substring(headerEnd);

    await fs.writeFile(masterPath, updatedContent, 'utf-8');
  }
}
