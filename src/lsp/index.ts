import { SpecBridgeLspServer, type LspServerOptions } from './server.js';

export async function startLspServer(options: LspServerOptions): Promise<void> {
  const server = new SpecBridgeLspServer(options);
  await server.initialize();
}

