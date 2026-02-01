import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { createClientOptions, createServerOptions } from './lspClient.js';

let client: LanguageClient | null = null;

export function activate(context: vscode.ExtensionContext) {
  const serverOptions = createServerOptions();
  const clientOptions = createClientOptions();

  client = new LanguageClient('specbridge', 'SpecBridge', serverOptions, clientOptions);
  client.start();

  context.subscriptions.push(
    vscode.commands.registerCommand('specbridge.verify', async () => {
      const terminal = vscode.window.createTerminal('SpecBridge');
      terminal.show();
      terminal.sendText('specbridge verify');
    })
  );
}

export async function deactivate() {
  if (client) {
    await client.stop();
    client = null;
  }
}

