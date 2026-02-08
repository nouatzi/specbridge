/**
 * Dashboard command - Start compliance dashboard web server
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { createDashboardServer } from '../../dashboard/server.js';
import { createConfiguredCommandContext } from '../command-context.js';

interface DashboardOptions {
  port?: string;
  host?: string;
}

export const dashboardCommand = new Command('dashboard')
  .description('Start compliance dashboard web server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .action(async (options: DashboardOptions) => {
    console.log(chalk.blue('Starting SpecBridge dashboard...'));

    try {
      const { context, config } = await createConfiguredCommandContext();
      const { cwd } = context;

      // Create server
      const server = createDashboardServer({ cwd, config });

      // Initialize (loads registry and starts caching)
      await server.start();

      // Start listening
      const port = parseInt(options.port || '3000', 10);
      const host = options.host || 'localhost';

      server.getApp().listen(port, host, () => {
        console.log(chalk.green(`\n✓ Dashboard running at http://${host}:${port}`));
        console.log(chalk.gray('  Press Ctrl+C to stop\n'));

        // Show helpful endpoints
        console.log(chalk.bold('API Endpoints:'));
        console.log(`  ${chalk.cyan(`http://${host}:${port}/api/health`)} - Health check`);
        console.log(
          `  ${chalk.cyan(`http://${host}:${port}/api/report/latest`)} - Latest report (cached)`
        );
        console.log(`  ${chalk.cyan(`http://${host}:${port}/api/decisions`)} - All decisions`);
        console.log(`  ${chalk.cyan(`http://${host}:${port}/api/analytics/summary`)} - Analytics`);
        console.log('');
      });

      // Handle shutdown gracefully
      const shutdown = () => {
        console.log(chalk.yellow('\n\nShutting down dashboard...'));
        server.stop();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (error) {
      console.error(chalk.red('Failed to start dashboard:'), error);
      throw error;
    }
  });
