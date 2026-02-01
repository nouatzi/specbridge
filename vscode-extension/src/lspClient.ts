import type { ServerOptions, LanguageClientOptions } from 'vscode-languageclient/node';

export function createServerOptions(): ServerOptions {
  return {
    command: 'specbridge',
    args: ['lsp'],
  };
}

export function createClientOptions(): LanguageClientOptions {
  return {
    documentSelector: [
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'typescriptreact' },
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'javascriptreact' },
    ],
  };
}

