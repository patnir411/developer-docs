import { Snapshot, FileSnapshot } from './snapshot-manager';
import * as diff from 'diff';
import chalk from 'chalk';

export interface DiffResult {
  from: string;
  to: string;
  timestamp: string;
  changes: ChangeSet;
  summary: DiffSummary;
}

export interface ChangeSet {
  added: FileChange[];
  modified: FileChange[];
  deleted: FileChange[];
  unchanged: number;
}

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  oldHash?: string;
  newHash?: string;
  diff?: string;
  significance: 'major' | 'minor' | 'patch';
  details?: ChangeDetails;
}

export interface ChangeDetails {
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  methodsAdded?: string[];
  methodsRemoved?: string[];
  parametersChanged?: string[];
}

export interface DiffSummary {
  totalChanges: number;
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  majorChanges: number;
  minorChanges: number;
  patchChanges: number;
}

export class DiffGenerator {
  generateDiff(oldSnapshot: Snapshot, newSnapshot: Snapshot): DiffResult {
    console.log(chalk.blue('🔍 Generating diff...'));
    console.log(chalk.blue(`  From: ${oldSnapshot.version} (${oldSnapshot.timestamp})`));
    console.log(chalk.blue(`  To: ${newSnapshot.version} (${newSnapshot.timestamp})`));

    const oldFiles = new Map(oldSnapshot.files.map(f => [f.path, f]));
    const newFiles = new Map(newSnapshot.files.map(f => [f.path, f]));

    const added: FileChange[] = [];
    const modified: FileChange[] = [];
    const deleted: FileChange[] = [];
    let unchanged = 0;

    // Find added and modified files
    for (const [path, newFile] of newFiles) {
      const oldFile = oldFiles.get(path);

      if (!oldFile) {
        // File was added
        added.push({
          path,
          type: 'added',
          newHash: newFile.hash,
          significance: this.determineSignificance('added', path),
        });
      } else if (oldFile.hash !== newFile.hash) {
        // File was modified
        const fileDiff = this.generateFileDiff(oldFile, newFile);
        modified.push(fileDiff);
      } else {
        unchanged++;
      }
    }

    // Find deleted files
    for (const [path, oldFile] of oldFiles) {
      if (!newFiles.has(path)) {
        deleted.push({
          path,
          type: 'deleted',
          oldHash: oldFile.hash,
          significance: this.determineSignificance('deleted', path),
        });
      }
    }

    const changes: ChangeSet = {
      added,
      modified,
      deleted,
      unchanged,
    };

    const summary = this.generateSummary(changes);

    console.log(chalk.green(`✓ Diff generated:`));
    console.log(chalk.green(`  Added: ${summary.filesAdded}`));
    console.log(chalk.green(`  Modified: ${summary.filesModified}`));
    console.log(chalk.green(`  Deleted: ${summary.filesDeleted}`));
    console.log(chalk.green(`  Unchanged: ${unchanged}`));

    return {
      from: oldSnapshot.version,
      to: newSnapshot.version,
      timestamp: new Date().toISOString(),
      changes,
      summary,
    };
  }

  private generateFileDiff(oldFile: FileSnapshot, newFile: FileSnapshot): FileChange {
    const oldContent = oldFile.content || '';
    const newContent = newFile.content || '';

    // Generate unified diff
    const patches = diff.createPatch(
      oldFile.path,
      oldContent,
      newContent,
      'Before',
      'After'
    );

    // Analyze changes
    const details = this.analyzeChanges(oldContent, newContent);

    return {
      path: oldFile.path,
      type: 'modified',
      oldHash: oldFile.hash,
      newHash: newFile.hash,
      diff: patches,
      significance: this.determineSignificanceFromChanges(details),
      details,
    };
  }

  private analyzeChanges(oldContent: string, newContent: string): ChangeDetails {
    const changes = diff.diffLines(oldContent, newContent);

    let linesAdded = 0;
    let linesRemoved = 0;

    for (const change of changes) {
      if (change.added) {
        linesAdded += change.count || 0;
      } else if (change.removed) {
        linesRemoved += change.count || 0;
      }
    }

    // Extract method changes (for Python SDK)
    const methodsAdded = this.extractAddedMethods(oldContent, newContent);
    const methodsRemoved = this.extractRemovedMethods(oldContent, newContent);
    const parametersChanged = this.extractParameterChanges(oldContent, newContent);

    return {
      linesAdded,
      linesRemoved,
      linesModified: Math.min(linesAdded, linesRemoved),
      methodsAdded,
      methodsRemoved,
      parametersChanged,
    };
  }

  private extractAddedMethods(oldContent: string, newContent: string): string[] {
    const oldMethods = this.extractMethods(oldContent);
    const newMethods = this.extractMethods(newContent);

    return newMethods.filter(m => !oldMethods.includes(m));
  }

  private extractRemovedMethods(oldContent: string, newContent: string): string[] {
    const oldMethods = this.extractMethods(oldContent);
    const newMethods = this.extractMethods(newContent);

    return oldMethods.filter(m => !newMethods.includes(m));
  }

  private extractMethods(content: string): string[] {
    const methods: string[] = [];

    // Match Python-style method definitions
    const pythonMatches = content.matchAll(/def\s+(\w+)\s*\(/g);
    for (const match of pythonMatches) {
      methods.push(match[1]);
    }

    // Match markdown headings for methods (in documentation)
    const headingMatches = content.matchAll(/^##?\s+`?(\w+(?:\.\w+)*)`?/gm);
    for (const match of headingMatches) {
      if (match[1] && !methods.includes(match[1])) {
        methods.push(match[1]);
      }
    }

    return methods;
  }

  private extractParameterChanges(oldContent: string, newContent: string): string[] {
    // This is a simplified version - could be enhanced to detect actual parameter changes
    const changes: string[] = [];

    if (oldContent.includes('| Parameter |') && newContent.includes('| Parameter |')) {
      // Compare parameter tables
      const oldParams = this.extractParameterNames(oldContent);
      const newParams = this.extractParameterNames(newContent);

      const added = newParams.filter(p => !oldParams.includes(p));
      const removed = oldParams.filter(p => !newParams.includes(p));

      changes.push(...added.map(p => `+${p}`));
      changes.push(...removed.map(p => `-${p}`));
    }

    return changes;
  }

  private extractParameterNames(content: string): string[] {
    const params: string[] = [];
    const matches = content.matchAll(/\|\s*`(\w+)`\s*\|/g);

    for (const match of matches) {
      params.push(match[1]);
    }

    return params;
  }

  private determineSignificance(type: 'added' | 'modified' | 'deleted', path: string): 'major' | 'minor' | 'patch' {
    if (type === 'deleted') {
      return 'major'; // Deletions are breaking changes
    }

    if (type === 'added') {
      return 'minor'; // New files are minor changes
    }

    // For modified files, check the path
    if (path.includes('/methods/') || path.includes('/models/')) {
      return 'minor';
    }

    return 'patch';
  }

  private determineSignificanceFromChanges(details: ChangeDetails): 'major' | 'minor' | 'patch' {
    // Breaking changes
    if (details.methodsRemoved && details.methodsRemoved.length > 0) {
      return 'major';
    }

    if (details.parametersChanged) {
      const removed = details.parametersChanged.filter(p => p.startsWith('-'));
      if (removed.length > 0) {
        return 'major';
      }
    }

    // New features
    if (details.methodsAdded && details.methodsAdded.length > 0) {
      return 'minor';
    }

    if (details.parametersChanged) {
      const added = details.parametersChanged.filter(p => p.startsWith('+'));
      if (added.length > 0) {
        return 'minor';
      }
    }

    // Everything else is a patch
    return 'patch';
  }

  private generateSummary(changes: ChangeSet): DiffSummary {
    const allChanges = [...changes.added, ...changes.modified, ...changes.deleted];

    return {
      totalChanges: allChanges.length,
      filesAdded: changes.added.length,
      filesModified: changes.modified.length,
      filesDeleted: changes.deleted.length,
      majorChanges: allChanges.filter(c => c.significance === 'major').length,
      minorChanges: allChanges.filter(c => c.significance === 'minor').length,
      patchChanges: allChanges.filter(c => c.significance === 'patch').length,
    };
  }

  formatDiff(diffResult: DiffResult): string {
    let output = '';

    output += `# Diff: ${diffResult.from} → ${diffResult.to}\n\n`;
    output += `**Generated**: ${diffResult.timestamp}\n\n`;

    output += `## Summary\n\n`;
    output += `- **Total Changes**: ${diffResult.summary.totalChanges}\n`;
    output += `- **Files Added**: ${diffResult.summary.filesAdded}\n`;
    output += `- **Files Modified**: ${diffResult.summary.filesModified}\n`;
    output += `- **Files Deleted**: ${diffResult.summary.filesDeleted}\n`;
    output += `- **Breaking Changes**: ${diffResult.summary.majorChanges}\n`;
    output += `- **New Features**: ${diffResult.summary.minorChanges}\n`;
    output += `- **Patches**: ${diffResult.summary.patchChanges}\n\n`;

    if (diffResult.changes.added.length > 0) {
      output += `## Added Files (${diffResult.changes.added.length})\n\n`;
      for (const file of diffResult.changes.added) {
        output += `- ✨ \`${file.path}\`\n`;
      }
      output += '\n';
    }

    if (diffResult.changes.modified.length > 0) {
      output += `## Modified Files (${diffResult.changes.modified.length})\n\n`;
      for (const file of diffResult.changes.modified) {
        const icon = file.significance === 'major' ? '🔴' : file.significance === 'minor' ? '🟡' : '🟢';
        output += `- ${icon} \`${file.path}\` (${file.significance})\n`;

        if (file.details) {
          if (file.details.methodsAdded && file.details.methodsAdded.length > 0) {
            output += `  - ✨ Methods added: ${file.details.methodsAdded.join(', ')}\n`;
          }
          if (file.details.methodsRemoved && file.details.methodsRemoved.length > 0) {
            output += `  - ❌ Methods removed: ${file.details.methodsRemoved.join(', ')}\n`;
          }
          if (file.details.parametersChanged && file.details.parametersChanged.length > 0) {
            output += `  - 🔧 Parameters changed: ${file.details.parametersChanged.join(', ')}\n`;
          }
        }
      }
      output += '\n';
    }

    if (diffResult.changes.deleted.length > 0) {
      output += `## Deleted Files (${diffResult.changes.deleted.length})\n\n`;
      for (const file of diffResult.changes.deleted) {
        output += `- ❌ \`${file.path}\`\n`;
      }
      output += '\n';
    }

    return output;
  }
}
