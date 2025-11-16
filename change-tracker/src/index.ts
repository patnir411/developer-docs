#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { SnapshotManager } from './snapshot-manager';
import { DiffGenerator } from './diff-generator';
import { ChangelogGenerator } from './changelog-generator';
import * as fs from 'fs/promises';

const program = new Command();

const DOCS_DIR = path.join(__dirname, '../../');
const SNAPSHOTS_DIR = path.join(__dirname, '../snapshots');
const CHANGELOG_DIR = path.join(__dirname, '../../changelog');

program
  .name('gemini-docs-change-tracker')
  .description('Change detection and tracking for Gemini API documentation')
  .version('1.0.0');

program
  .command('snapshot')
  .description('Create a new documentation snapshot')
  .option('-v, --version <version>', 'Specify version (default: auto-generated)')
  .action(async (options) => {
    try {
      console.log(chalk.bold.cyan('\n📸 Creating Snapshot\n'));

      const manager = new SnapshotManager(SNAPSHOTS_DIR, DOCS_DIR);
      const snapshot = await manager.createSnapshot(options.version);

      console.log(chalk.green('\n✓ Snapshot created successfully!'));
      console.log(chalk.blue(`  Version: ${snapshot.version}`));
      console.log(chalk.blue(`  Files: ${snapshot.metadata.totalFiles}`));
      console.log(chalk.blue(`  Size: ${(snapshot.metadata.totalSize / 1024).toFixed(2)} KB\n`));
    } catch (error) {
      console.error(chalk.red('Error creating snapshot:'), error);
      process.exit(1);
    }
  });

program
  .command('diff')
  .description('Generate diff between two snapshots')
  .option('-f, --from <version>', 'From version')
  .option('-t, --to <version>', 'To version (default: latest)')
  .option('-o, --output <file>', 'Output file for diff')
  .action(async (options) => {
    try {
      console.log(chalk.bold.cyan('\n🔍 Generating Diff\n'));

      const manager = new SnapshotManager(SNAPSHOTS_DIR, DOCS_DIR);
      const diffGen = new DiffGenerator();

      // Load snapshots
      let fromSnapshot, toSnapshot;

      if (options.from) {
        fromSnapshot = await manager.loadSnapshot(options.from);
        if (!fromSnapshot) {
          console.error(chalk.red(`Snapshot not found: ${options.from}`));
          process.exit(1);
        }
      } else {
        // Use the second latest if no from is specified
        const snapshots = await manager.listSnapshots();
        if (snapshots.length < 2) {
          console.error(chalk.red('Not enough snapshots to compare. Need at least 2.'));
          process.exit(1);
        }
        snapshots.sort((a, b) => b.localeCompare(a));
        fromSnapshot = await manager.loadSnapshot(snapshots[1]);
      }

      if (options.to) {
        toSnapshot = await manager.loadSnapshot(options.to);
        if (!toSnapshot) {
          console.error(chalk.red(`Snapshot not found: ${options.to}`));
          process.exit(1);
        }
      } else {
        toSnapshot = await manager.getLatestSnapshot();
        if (!toSnapshot) {
          console.error(chalk.red('No latest snapshot found'));
          process.exit(1);
        }
      }

      // Generate diff
      const diffResult = diffGen.generateDiff(fromSnapshot!, toSnapshot!);

      // Format and display
      const formattedDiff = diffGen.formatDiff(diffResult);
      console.log('\n' + formattedDiff);

      // Save to file if requested
      if (options.output) {
        await fs.writeFile(options.output, formattedDiff, 'utf-8');
        console.log(chalk.green(`\n✓ Diff saved to: ${options.output}\n`));
      }

      // Save diff result as JSON
      const diffPath = path.join(SNAPSHOTS_DIR, `diff-${diffResult.from}-to-${diffResult.to}.json`);
      await fs.writeFile(diffPath, JSON.stringify(diffResult, null, 2), 'utf-8');
      console.log(chalk.blue(`💾 Diff data saved to: ${diffPath}\n`));
    } catch (error) {
      console.error(chalk.red('Error generating diff:'), error);
      process.exit(1);
    }
  });

program
  .command('changelog')
  .description('Generate changelog from diff')
  .option('-f, --from <version>', 'From version')
  .option('-t, --to <version>', 'To version (default: latest)')
  .action(async (options) => {
    try {
      console.log(chalk.bold.cyan('\n📝 Generating Changelog\n'));

      const manager = new SnapshotManager(SNAPSHOTS_DIR, DOCS_DIR);
      const diffGen = new DiffGenerator();
      const changelogGen = new ChangelogGenerator(CHANGELOG_DIR);

      // Load snapshots
      let fromSnapshot, toSnapshot;

      if (options.from) {
        fromSnapshot = await manager.loadSnapshot(options.from);
        if (!fromSnapshot) {
          console.error(chalk.red(`Snapshot not found: ${options.from}`));
          process.exit(1);
        }
      } else {
        const snapshots = await manager.listSnapshots();
        if (snapshots.length < 2) {
          console.error(chalk.red('Not enough snapshots. Need at least 2.'));
          process.exit(1);
        }
        snapshots.sort((a, b) => b.localeCompare(a));
        fromSnapshot = await manager.loadSnapshot(snapshots[1]);
      }

      if (options.to) {
        toSnapshot = await manager.loadSnapshot(options.to);
        if (!toSnapshot) {
          console.error(chalk.red(`Snapshot not found: ${options.to}`));
          process.exit(1);
        }
      } else {
        toSnapshot = await manager.getLatestSnapshot();
        if (!toSnapshot) {
          console.error(chalk.red('No latest snapshot found'));
          process.exit(1);
        }
      }

      // Generate diff
      const diffResult = diffGen.generateDiff(fromSnapshot!, toSnapshot!);

      // Generate changelog
      const changelog = await changelogGen.generateChangelog(diffResult);

      console.log(chalk.green('\n✓ Changelog generated successfully!'));
      console.log(chalk.blue(`  Version: ${changelog.version}`));
      console.log(chalk.blue(`  Breaking Changes: ${changelog.breaking.length}`));
      console.log(chalk.blue(`  New Features: ${changelog.features.length}`));
      console.log(chalk.blue(`  Bug Fixes: ${changelog.fixes.length}`));
      console.log(chalk.blue(`  Documentation: ${changelog.documentation.length}\n`));
    } catch (error) {
      console.error(chalk.red('Error generating changelog:'), error);
      process.exit(1);
    }
  });

program
  .command('track')
  .description('Full tracking workflow: snapshot, diff, and changelog')
  .action(async () => {
    try {
      console.log(chalk.bold.cyan('\n🔄 Running Full Tracking Workflow\n'));

      const manager = new SnapshotManager(SNAPSHOTS_DIR, DOCS_DIR);
      const diffGen = new DiffGenerator();
      const changelogGen = new ChangelogGenerator(CHANGELOG_DIR);

      // Step 1: Get previous snapshot
      const previousSnapshot = await manager.getLatestSnapshot();

      // Step 2: Create new snapshot
      console.log(chalk.bold.blue('Step 1: Creating new snapshot...\n'));
      const newSnapshot = await manager.createSnapshot();

      if (!previousSnapshot) {
        console.log(chalk.yellow('\n⚠️  No previous snapshot found. This is the first snapshot.'));
        console.log(chalk.yellow('Run this command again after the next scrape to generate diffs and changelogs.\n'));
        return;
      }

      // Step 3: Generate diff
      console.log(chalk.bold.blue('\nStep 2: Generating diff...\n'));
      const diffResult = diffGen.generateDiff(previousSnapshot, newSnapshot);

      if (diffResult.summary.totalChanges === 0) {
        console.log(chalk.yellow('\n✓ No changes detected.\n'));
        return;
      }

      // Step 4: Generate changelog
      console.log(chalk.bold.blue('\nStep 3: Generating changelog...\n'));
      const changelog = await changelogGen.generateChangelog(diffResult);

      // Print summary
      console.log(chalk.bold.green('\n' + '='.repeat(70)));
      console.log(chalk.bold.green('✨ Tracking Complete!'));
      console.log(chalk.bold.green('='.repeat(70)));
      console.log(chalk.green(`\n📊 Changes Detected: ${diffResult.summary.totalChanges}`));
      console.log(chalk.green(`  ⚠️  Breaking: ${changelog.breaking.length}`));
      console.log(chalk.green(`  ✨ Features: ${changelog.features.length}`));
      console.log(chalk.green(`  🐛 Fixes: ${changelog.fixes.length}`));
      console.log(chalk.green(`  📚 Documentation: ${changelog.documentation.length}\n`));
      console.log(chalk.blue(`📝 Changelog: ${CHANGELOG_DIR}/LATEST.md`));
      console.log(chalk.bold.green('='.repeat(70) + '\n'));
    } catch (error) {
      console.error(chalk.red('Error in tracking workflow:'), error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all snapshots')
  .action(async () => {
    try {
      const manager = new SnapshotManager(SNAPSHOTS_DIR, DOCS_DIR);
      const snapshots = await manager.listSnapshots();

      if (snapshots.length === 0) {
        console.log(chalk.yellow('No snapshots found.'));
        return;
      }

      console.log(chalk.bold.blue('\n📸 Available Snapshots:\n'));
      snapshots.sort((a, b) => b.localeCompare(a));

      for (const version of snapshots) {
        const snapshot = await manager.loadSnapshot(version);
        if (snapshot) {
          console.log(chalk.green(`  ${version}`));
          console.log(chalk.dim(`    Date: ${snapshot.timestamp}`));
          console.log(chalk.dim(`    Files: ${snapshot.metadata.totalFiles}`));
          console.log(chalk.dim(`    Size: ${(snapshot.metadata.totalSize / 1024).toFixed(2)} KB\n`));
        }
      }
    } catch (error) {
      console.error(chalk.red('Error listing snapshots:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);

// If no command provided, show help
if (process.argv.length === 2) {
  program.help();
}
