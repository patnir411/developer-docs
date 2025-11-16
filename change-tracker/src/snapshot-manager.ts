import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { glob } from 'glob';
import chalk from 'chalk';

export interface Snapshot {
  timestamp: string;
  version: string;
  files: FileSnapshot[];
  metadata: SnapshotMetadata;
}

export interface FileSnapshot {
  path: string;
  hash: string;
  size: number;
  content?: string;
  metadata?: any;
}

export interface SnapshotMetadata {
  totalFiles: number;
  totalSize: number;
  sources: string[];
  generator: string;
}

export class SnapshotManager {
  private snapshotsDir: string;
  private docsDir: string;

  constructor(snapshotsDir: string, docsDir: string) {
    this.snapshotsDir = snapshotsDir;
    this.docsDir = docsDir;
  }

  async createSnapshot(version?: string): Promise<Snapshot> {
    console.log(chalk.blue('📸 Creating documentation snapshot...'));

    const timestamp = new Date().toISOString();
    const snapshotVersion = version || this.generateVersion(timestamp);

    // Find all markdown files
    const files = await this.findDocumentationFiles();

    console.log(chalk.blue(`Found ${files.length} documentation files`));

    // Create file snapshots
    const fileSnapshots: FileSnapshot[] = [];
    let totalSize = 0;

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const hash = this.hashContent(content);
      const stats = await fs.stat(file);
      const relativePath = path.relative(this.docsDir, file);

      fileSnapshots.push({
        path: relativePath,
        hash,
        size: stats.size,
        content,
        metadata: this.extractMetadata(content),
      });

      totalSize += stats.size;
    }

    // Detect sources
    const sources = this.detectSources(fileSnapshots);

    const snapshot: Snapshot = {
      timestamp,
      version: snapshotVersion,
      files: fileSnapshots,
      metadata: {
        totalFiles: fileSnapshots.length,
        totalSize,
        sources,
        generator: 'gemini-docs-tracker-v1',
      },
    };

    // Save snapshot
    await this.saveSnapshot(snapshot);

    console.log(chalk.green(`✓ Snapshot created: ${snapshotVersion}`));
    console.log(chalk.green(`  Files: ${snapshot.metadata.totalFiles}`));
    console.log(chalk.green(`  Size: ${(snapshot.metadata.totalSize / 1024).toFixed(2)} KB`));

    return snapshot;
  }

  async loadSnapshot(version: string): Promise<Snapshot | null> {
    const snapshotPath = path.join(this.snapshotsDir, `${version}.json`);

    try {
      const content = await fs.readFile(snapshotPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(chalk.yellow(`⚠️  Snapshot not found: ${version}`));
      return null;
    }
  }

  async getLatestSnapshot(): Promise<Snapshot | null> {
    const snapshots = await this.listSnapshots();

    if (snapshots.length === 0) {
      return null;
    }

    // Sort by timestamp (descending)
    snapshots.sort((a, b) => b.localeCompare(a));

    return this.loadSnapshot(snapshots[0]);
  }

  async listSnapshots(): Promise<string[]> {
    await fs.mkdir(this.snapshotsDir, { recursive: true });

    const files = await fs.readdir(this.snapshotsDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  private async saveSnapshot(snapshot: Snapshot): Promise<void> {
    await fs.mkdir(this.snapshotsDir, { recursive: true });

    const snapshotPath = path.join(this.snapshotsDir, `${snapshot.version}.json`);

    // Save full snapshot with content
    await fs.writeFile(
      snapshotPath,
      JSON.stringify(snapshot, null, 2),
      'utf-8'
    );

    // Save compact version without content (for quick comparison)
    const compactSnapshot = {
      ...snapshot,
      files: snapshot.files.map(f => ({
        path: f.path,
        hash: f.hash,
        size: f.size,
      })),
    };

    const compactPath = path.join(this.snapshotsDir, `${snapshot.version}-compact.json`);
    await fs.writeFile(
      compactPath,
      JSON.stringify(compactSnapshot, null, 2),
      'utf-8'
    );
  }

  private async findDocumentationFiles(): Promise<string[]> {
    const patterns = [
      path.join(this.docsDir, '**/*.md'),
      path.join(this.docsDir, '**/*.json'),
    ];

    const allFiles: string[] = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      });
      allFiles.push(...files);
    }

    return allFiles;
  }

  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private generateVersion(timestamp: string): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    return `${year}${month}${day}-${hour}${minute}`;
  }

  private extractMetadata(content: string): any {
    // Extract frontmatter metadata
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      return {};
    }

    const frontmatter = frontmatterMatch[1];
    const metadata: any = {};

    frontmatter.split('\n').forEach(line => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        metadata[match[1]] = match[2];
      }
    });

    return metadata;
  }

  private detectSources(files: FileSnapshot[]): string[] {
    const sources = new Set<string>();

    for (const file of files) {
      if (file.path.startsWith('gemini-api')) {
        sources.add('gemini-api');
      } else if (file.path.startsWith('sdks/python')) {
        sources.add('python-sdk');
      } else if (file.path.startsWith('vertex-ai')) {
        sources.add('vertex-ai');
      }
    }

    return Array.from(sources);
  }
}
