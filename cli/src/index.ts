#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { SearchCommand } from './commands/search';
import { MethodCommand } from './commands/method';
import { ModelsCommand } from './commands/models';
import { ChangelogCommand } from './commands/changelog';
import { ExportCommand } from './commands/export';
import { InteractiveCommand } from './commands/interactive';
import { StatsCommand } from './commands/stats';

const program = new Command();

program
  .name('gemini-docs')
  .description('Interactive CLI for exploring Gemini API documentation')
  .version('1.0.0')
  .addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.cyan('$ gemini-docs search "generate content"')}      Search for documentation
  ${chalk.cyan('$ gemini-docs method generateContent')}         Show method details
  ${chalk.cyan('$ gemini-docs models')}                         List all Gemini models
  ${chalk.cyan('$ gemini-docs changelog --since 2024-01-01')}   Show recent changes
  ${chalk.cyan('$ gemini-docs interactive')}                    Launch interactive mode

${chalk.bold('Documentation Location:')}
  All documentation is stored locally in markdown format
  and can be accessed offline after the initial scrape.
  `);

// Search command
program
  .command('search')
  .description('Search documentation for a query')
  .argument('<query>', 'Search query')
  .option('-t, --type <type>', 'Filter by type (method, model, guide)')
  .option('-l, --limit <number>', 'Limit results', '10')
  .option('--json', 'Output as JSON')
  .action(async (query, options) => {
    const cmd = new SearchCommand();
    await cmd.execute(query, options);
  });

// Method command
program
  .command('method')
  .description('Show details for a specific method')
  .argument('<name>', 'Method name')
  .option('--examples', 'Show code examples')
  .option('--json', 'Output as JSON')
  .action(async (name, options) => {
    const cmd = new MethodCommand();
    await cmd.execute(name, options);
  });

// Models command
program
  .command('models')
  .description('List all Gemini models')
  .option('--compare', 'Show comparison table')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const cmd = new ModelsCommand();
    await cmd.execute(options);
  });

// Changelog command
program
  .command('changelog')
  .description('Show changelog and recent changes')
  .option('-s, --since <date>', 'Show changes since date (YYYY-MM-DD)')
  .option('-l, --limit <number>', 'Limit entries', '5')
  .option('--breaking', 'Show only breaking changes')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const cmd = new ChangelogCommand();
    await cmd.execute(options);
  });

// Export command
program
  .command('export')
  .description('Export documentation in various formats')
  .option('-f, --format <format>', 'Format (json, md, html)', 'json')
  .option('-o, --output <file>', 'Output file')
  .option('-t, --type <type>', 'Export type (all, methods, models, guides)')
  .action(async (options) => {
    const cmd = new ExportCommand();
    await cmd.execute(options);
  });

// Stats command
program
  .command('stats')
  .description('Show documentation statistics')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const cmd = new StatsCommand();
    await cmd.execute(options);
  });

// Interactive command (default)
program
  .command('interactive')
  .alias('i')
  .description('Launch interactive exploration mode')
  .action(async () => {
    const cmd = new InteractiveCommand();
    await cmd.execute();
  });

// Parse arguments
program.parse(process.argv);

// If no arguments, show help
if (process.argv.length === 2) {
  program.help();
}
