import chalk from 'chalk';
import inquirer from 'inquirer';
import { SearchCommand } from './search';
import { MethodCommand } from './method';
import { ModelsCommand } from './models';
import { ChangelogCommand } from './changelog';
import { StatsCommand } from './stats';

export class InteractiveCommand {
  async execute() {
    console.log(chalk.bold.cyan('\n🚀 Gemini Documentation Explorer\n'));
    console.log(chalk.dim('Interactive mode - explore Gemini API documentation\n'));

    let running = true;

    while (running) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🔍 Search documentation', value: 'search' },
            { name: '⚡ Look up a method', value: 'method' },
            { name: '🤖 Browse models', value: 'models' },
            { name: '📝 View changelog', value: 'changelog' },
            { name: '📊 Show statistics', value: 'stats' },
            new inquirer.Separator(),
            { name: '🚪 Exit', value: 'exit' },
          ],
        },
      ]);

      switch (action) {
        case 'search':
          await this.handleSearch();
          break;
        case 'method':
          await this.handleMethod();
          break;
        case 'models':
          await this.handleModels();
          break;
        case 'changelog':
          await this.handleChangelog();
          break;
        case 'stats':
          await this.handleStats();
          break;
        case 'exit':
          running = false;
          console.log(chalk.cyan('\n👋 Goodbye!\n'));
          break;
      }

      if (running) {
        console.log(''); // Add spacing between actions
      }
    }
  }

  private async handleSearch() {
    const { query } = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: 'Enter search query:',
        validate: (input: string) => input.length > 0 || 'Please enter a search query',
      },
    ]);

    const { limit } = await inquirer.prompt([
      {
        type: 'number',
        name: 'limit',
        message: 'Number of results:',
        default: 10,
      },
    ]);

    const cmd = new SearchCommand();
    await cmd.execute(query, { limit });
  }

  private async handleMethod() {
    const { methodName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'methodName',
        message: 'Enter method name (e.g., generateContent):',
        validate: (input: string) => input.length > 0 || 'Please enter a method name',
      },
    ]);

    const { showExamples } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'showExamples',
        message: 'Show only examples?',
        default: false,
      },
    ]);

    const cmd = new MethodCommand();
    await cmd.execute(methodName, { examples: showExamples });
  }

  private async handleModels() {
    const { compare } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'compare',
        message: 'Show comparison table?',
        default: false,
      },
    ]);

    const cmd = new ModelsCommand();
    await cmd.execute({ compare });
  }

  private async handleChangelog() {
    const { viewType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'viewType',
        message: 'What would you like to view?',
        choices: [
          { name: 'Latest changes', value: 'latest' },
          { name: 'Changes since date', value: 'since' },
        ],
      },
    ]);

    let options: any = { limit: 5 };

    if (viewType === 'since') {
      const { since } = await inquirer.prompt([
        {
          type: 'input',
          name: 'since',
          message: 'Enter date (YYYY-MM-DD):',
          validate: (input: string) => {
            const date = new Date(input);
            return !isNaN(date.getTime()) || 'Please enter a valid date';
          },
        },
      ]);
      options.since = since;
    }

    const cmd = new ChangelogCommand();
    await cmd.execute(options);
  }

  private async handleStats() {
    const cmd = new StatsCommand();
    await cmd.execute({});
  }
}
