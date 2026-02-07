import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { Violation } from '../../src/core/types/index.js';
import { setupTestProject, createDecisionYaml } from '../helpers/setup.js';

vi.mock('vscode-languageserver/node.js', () => {
  class MockTextDocuments<T extends TextDocument> {
    onDidOpen(_handler: (event: { document: T }) => void): void {}
    onDidChangeContent(_handler: (event: { document: T }) => void): void {}
    onDidClose(_handler: (event: { document: T }) => void): void {}
    listen(_connection: unknown): void {}
    get(_uri: string): T | undefined {
      return undefined;
    }
  }

  return {
    createConnection: () => ({
      onInitialize: (_handler: (params: unknown) => Promise<unknown>) => {},
      onCodeAction: (_handler: (params: unknown) => unknown[]) => {},
      sendDiagnostics: (_payload: unknown) => {},
      listen: () => {},
      console: {
        error: () => {},
        log: () => {},
      },
    }),
    ProposedFeatures: { all: {} },
    TextDocuments: MockTextDocuments,
    TextDocumentSyncKind: { Incremental: 2 },
    DiagnosticSeverity: { Error: 1, Warning: 2, Information: 3, Hint: 4 },
    CodeActionKind: { QuickFix: 'quickfix' },
  };
});

import { SpecBridgeLspServer } from '../../src/lsp/server.js';

interface Harness {
  onInitialize?: (params: unknown) => Promise<any>;
  onDidOpen?: (event: { document: TextDocument }) => void;
  onDidChangeContent?: (event: { document: TextDocument }) => void;
  onDidClose?: (event: { document: TextDocument }) => void;
  onCodeAction?: (params: { textDocument: { uri: string } }) => unknown[];
  sentDiagnostics: Array<{ uri: string; diagnostics: unknown[] }>;
  documentStore: Map<string, TextDocument>;
}

function createHarness(server: SpecBridgeLspServer): Harness {
  const connection = (server as any).connection;
  const documents = (server as any).documents;

  const harness: Harness = {
    sentDiagnostics: [],
    documentStore: new Map<string, TextDocument>(),
  };

  vi.spyOn(connection, 'onInitialize').mockImplementation(
    (handler: (params: unknown) => Promise<any>) => {
      harness.onInitialize = handler;
    }
  );
  vi.spyOn(connection, 'onCodeAction').mockImplementation((handler: (params: any) => unknown[]) => {
    harness.onCodeAction = handler;
  });
  vi.spyOn(connection, 'sendDiagnostics').mockImplementation(
    (payload: { uri: string; diagnostics: unknown[] }) => {
      harness.sentDiagnostics.push(payload);
    }
  );
  vi.spyOn(connection, 'listen').mockImplementation(() => {});

  vi.spyOn(documents, 'onDidOpen').mockImplementation(
    (handler: (event: { document: TextDocument }) => void) => {
      harness.onDidOpen = handler;
    }
  );
  vi.spyOn(documents, 'onDidChangeContent').mockImplementation(
    (handler: (event: { document: TextDocument }) => void) => {
      harness.onDidChangeContent = handler;
    }
  );
  vi.spyOn(documents, 'onDidClose').mockImplementation(
    (handler: (event: { document: TextDocument }) => void) => {
      harness.onDidClose = handler;
    }
  );
  vi.spyOn(documents, 'listen').mockImplementation(() => {});
  vi.spyOn(documents, 'get').mockImplementation((uri: string) => harness.documentStore.get(uri));

  return harness;
}

describe('LSP Server Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-lsp-test-'));

    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, 'example.ts'),
      `
export function sample() {
  console.log('debug');
}
`
    );

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'lsp-001',
          content: createDecisionYaml('lsp-001', {
            title: 'LSP regex verifier',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'must not contain /console\\.log/',
                severity: 'medium',
                scope: 'src/**/*.ts',
                verifier: 'regex',
              },
            ],
          }),
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('initializes, validates documents, provides code actions, and clears cache on close', async () => {
    const server = new SpecBridgeLspServer({ cwd: testDir });
    const harness = createHarness(server);

    await server.initialize();
    expect(harness.onInitialize).toBeDefined();
    expect(harness.onDidClose).toBeDefined();
    expect(harness.onCodeAction).toBeDefined();

    const initResult = await harness.onInitialize!({});
    expect(initResult.capabilities.textDocumentSync).toBeDefined();
    expect(initResult.capabilities.codeActionProvider).toBe(true);

    const fileUri = pathToFileURL(join(testDir, 'src', 'example.ts')).toString();
    const doc = TextDocument.create(fileUri, 'typescript', 1, 'console.log("bad")');
    harness.documentStore.set(fileUri, doc);

    await (server as any).validateDocument(doc);
    expect(harness.sentDiagnostics.length).toBeGreaterThan(0);
    expect(harness.sentDiagnostics[0]?.uri).toBe(fileUri);

    const violation: Violation = {
      decisionId: 'lsp-001',
      constraintId: 'c-1',
      type: 'convention',
      severity: 'medium',
      message: 'console.log is forbidden',
      file: join(testDir, 'src', 'example.ts'),
      line: 1,
      column: 1,
      autofix: {
        description: 'Remove console.log',
        edits: [{ start: 0, end: 12, text: '' }],
      },
    };

    (server as any).cache.set(fileUri, [violation]);
    const actions = harness.onCodeAction!({ textDocument: { uri: fileUri } });
    expect(actions.length).toBe(1);

    harness.onDidClose!({ document: doc });
    expect((server as any).cache.has(fileUri)).toBe(false);
    const lastDiagnostics = harness.sentDiagnostics[harness.sentDiagnostics.length - 1];
    expect(lastDiagnostics?.uri).toBe(fileUri);
    expect(lastDiagnostics?.diagnostics).toEqual([]);
  });

  it('publishes an initialization diagnostic when workspace is not initialized', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'specbridge-lsp-empty-'));
    const server = new SpecBridgeLspServer({ cwd: emptyDir });
    const harness = createHarness(server);

    await server.initialize();
    await harness.onInitialize!({});

    const fileUri = pathToFileURL(join(emptyDir, 'src', 'file.ts')).toString();
    const doc = TextDocument.create(fileUri, 'typescript', 1, 'export const ok = true;');
    harness.documentStore.set(fileUri, doc);

    await (server as any).validateDocument(doc);

    const lastDiagnostics = harness.sentDiagnostics[harness.sentDiagnostics.length - 1];
    expect(lastDiagnostics?.uri).toBe(fileUri);
    expect(lastDiagnostics?.diagnostics.length).toBeGreaterThan(0);
    const message = String((lastDiagnostics?.diagnostics[0] as any).message || '').toLowerCase();
    expect(message).toContain('not initialized');

    rmSync(emptyDir, { recursive: true, force: true });
  });
});
