/**
 * MCP Server command - Start SpecBridge MCP server
 */
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SpecBridgeMcpServer } from '../../mcp/server.js';

function getCliVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // In production (bundled): import.meta.url points to dist/cli.js, so ../package.json is correct.
    const packageJsonPath = join(__dirname, '../package.json');
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return String(pkg.version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

export const mcpServerCommand = new Command('mcp-server')
  .description('Start SpecBridge MCP server (stdio)')
  .action(async () => {
    const server = new SpecBridgeMcpServer({
      cwd: process.cwd(),
      version: getCliVersion(),
    });

    await server.initialize();
    // MCP servers should write logs to stderr; keep stdout for protocol.
    console.error('SpecBridge MCP server starting (stdio)...');
    await server.startStdio();
  });
