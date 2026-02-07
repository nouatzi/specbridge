import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { Decision, Violation } from '../../../src/core/types/index.js';

interface CallbackState {
  onInitialize?: () => Promise<{
    capabilities: { textDocumentSync: number; codeActionProvider: boolean };
  }>;
  onDidOpen?: (event: { document: TextDocument }) => void;
  onDidChangeContent?: (event: { document: TextDocument }) => void;
  onDidClose?: (event: { document: TextDocument }) => void;
  onCodeAction?: (params: { textDocument: { uri: string } }) => unknown[];
}

interface MockState extends CallbackState {
  diagnostics: Array<{ uri: string; diagnostics: Array<{ severity: number; message: string }> }>;
  documents: Map<string, TextDocument>;
  specBridgeDirExists: boolean;
  decisions: Decision[];
  verifierViolations: Violation[];
}

const {
  state,
  loadConfigMock,
  createRegistryMock,
  pathExistsMock,
  getSpecBridgeDirMock,
  selectVerifierForConstraintMock,
  shouldApplyConstraintToFileMock,
  loadPluginsMock,
} = vi.hoisted(() => ({
  state: {
    diagnostics: [],
    documents: new Map<string, TextDocument>(),
    specBridgeDirExists: true,
    decisions: [],
    verifierViolations: [],
  } as MockState,
  loadConfigMock: vi.fn(),
  createRegistryMock: vi.fn(),
  pathExistsMock: vi.fn(),
  getSpecBridgeDirMock: vi.fn(),
  selectVerifierForConstraintMock: vi.fn(),
  shouldApplyConstraintToFileMock: vi.fn(),
  loadPluginsMock: vi.fn(),
}));

vi.mock('vscode-languageserver/node.js', () => {
  class MockTextDocuments {
    onDidOpen(handler: (event: { document: TextDocument }) => void): void {
      state.onDidOpen = handler;
    }
    onDidChangeContent(handler: (event: { document: TextDocument }) => void): void {
      state.onDidChangeContent = handler;
    }
    onDidClose(handler: (event: { document: TextDocument }) => void): void {
      state.onDidClose = handler;
    }
    listen(_connection: unknown): void {}
    get(uri: string): TextDocument | undefined {
      return state.documents.get(uri);
    }
  }

  return {
    createConnection: () => ({
      onInitialize: (
        handler: () => Promise<{
          capabilities: { textDocumentSync: number; codeActionProvider: boolean };
        }>
      ) => {
        state.onInitialize = handler;
      },
      onCodeAction: (handler: (params: { textDocument: { uri: string } }) => unknown[]) => {
        state.onCodeAction = handler;
      },
      sendDiagnostics: (payload: {
        uri: string;
        diagnostics: Array<{ severity: number; message: string }>;
      }) => {
        state.diagnostics.push(payload);
      },
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

vi.mock('../../../src/config/loader.js', () => ({
  loadConfig: loadConfigMock,
}));

vi.mock('../../../src/registry/registry.js', () => ({
  createRegistry: createRegistryMock,
}));

vi.mock('../../../src/utils/fs.js', () => ({
  pathExists: pathExistsMock,
  getSpecBridgeDir: getSpecBridgeDirMock,
}));

vi.mock('../../../src/verification/verifiers/index.js', () => ({
  selectVerifierForConstraint: selectVerifierForConstraintMock,
}));

vi.mock('../../../src/verification/applicability.js', () => ({
  shouldApplyConstraintToFile: shouldApplyConstraintToFileMock,
}));

vi.mock('../../../src/verification/plugins/loader.js', () => ({
  getPluginLoader: () => ({
    loadPlugins: loadPluginsMock,
  }),
}));

import { SpecBridgeLspServer } from '../../../src/lsp/server.js';

interface LspServerInternals {
  validateDocument: (doc: TextDocument) => Promise<void>;
  cache: Map<string, Violation[]>;
}

function createDecision(id: string): Decision {
  return {
    kind: 'Decision',
    metadata: {
      id,
      title: 'LSP decision',
      status: 'active',
      owners: ['team'],
    },
    decision: {
      summary: 'summary',
      rationale: 'rationale',
    },
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
  };
}

describe('SpecBridgeLspServer (unit)', () => {
  beforeEach(() => {
    state.diagnostics = [];
    state.documents = new Map<string, TextDocument>();
    state.specBridgeDirExists = true;
    state.decisions = [createDecision('lsp-001')];
    state.verifierViolations = [];
    state.onInitialize = undefined;
    state.onDidOpen = undefined;
    state.onDidChangeContent = undefined;
    state.onDidClose = undefined;
    state.onCodeAction = undefined;

    loadConfigMock.mockReset();
    createRegistryMock.mockReset();
    pathExistsMock.mockReset();
    getSpecBridgeDirMock.mockReset();
    selectVerifierForConstraintMock.mockReset();
    shouldApplyConstraintToFileMock.mockReset();
    loadPluginsMock.mockReset();

    loadConfigMock.mockResolvedValue({
      project: {
        sourceRoots: ['src'],
      },
    });

    createRegistryMock.mockReturnValue({
      load: vi.fn().mockResolvedValue(undefined),
      getActive: vi.fn(() => state.decisions),
    });

    getSpecBridgeDirMock.mockImplementation((cwd: string) => `${cwd}/.specbridge`);
    pathExistsMock.mockImplementation(async (target: string) => {
      if (target.endsWith('/.specbridge')) {
        return state.specBridgeDirExists;
      }
      return true;
    });

    selectVerifierForConstraintMock.mockImplementation(() => ({
      id: 'regex',
      verify: vi.fn(async () => state.verifierViolations),
    }));

    shouldApplyConstraintToFileMock.mockReturnValue(true);
    loadPluginsMock.mockResolvedValue(undefined);
  });

  it('registers handlers and advertises capabilities on initialize', async () => {
    const server = new SpecBridgeLspServer({ cwd: '/repo' });
    await server.initialize();

    expect(state.onInitialize).toBeDefined();
    expect(state.onDidOpen).toBeDefined();
    expect(state.onDidChangeContent).toBeDefined();
    expect(state.onDidClose).toBeDefined();
    expect(state.onCodeAction).toBeDefined();

    const init = await state.onInitialize?.();
    expect(init?.capabilities.textDocumentSync).toBe(2);
    expect(init?.capabilities.codeActionProvider).toBe(true);
  });

  it('publishes diagnostics with severity mapping for violations', async () => {
    const server = new SpecBridgeLspServer({ cwd: '/repo' });
    await server.initialize();
    await state.onInitialize?.();

    const uri = 'file:///repo/src/example.ts';
    const doc = TextDocument.create(uri, 'typescript', 1, 'console.log("bad");');
    state.documents.set(uri, doc);

    state.verifierViolations = [
      {
        decisionId: 'lsp-001',
        constraintId: 'c-1',
        type: 'convention',
        severity: 'critical',
        message: 'critical',
        file: '/repo/src/example.ts',
        line: 1,
        column: 1,
      },
      {
        decisionId: 'lsp-001',
        constraintId: 'c-1',
        type: 'convention',
        severity: 'high',
        message: 'high',
        file: '/repo/src/example.ts',
        line: 1,
        column: 1,
      },
      {
        decisionId: 'lsp-001',
        constraintId: 'c-1',
        type: 'convention',
        severity: 'medium',
        message: 'medium',
        file: '/repo/src/example.ts',
        line: 1,
        column: 1,
      },
      {
        decisionId: 'lsp-001',
        constraintId: 'c-1',
        type: 'convention',
        severity: 'low',
        message: 'low',
        file: '/repo/src/example.ts',
        line: 1,
        column: 1,
      },
    ];

    await (server as unknown as LspServerInternals).validateDocument(doc);
    const payload = state.diagnostics[0];

    expect(payload?.uri).toBe(uri);
    expect(payload?.diagnostics.map((d) => d.severity)).toEqual([1, 2, 3, 4]);
  });

  it('returns quick fixes from cached autofix edits', async () => {
    const server = new SpecBridgeLspServer({ cwd: '/repo' });
    await server.initialize();
    await state.onInitialize?.();

    const uri = 'file:///repo/src/example.ts';
    const doc = TextDocument.create(uri, 'typescript', 1, 'console.log("bad");');
    state.documents.set(uri, doc);

    (server as unknown as LspServerInternals).cache.set(uri, [
      {
        decisionId: 'lsp-001',
        constraintId: 'c-1',
        type: 'convention',
        severity: 'medium',
        message: 'remove console.log',
        file: '/repo/src/example.ts',
        line: 1,
        column: 1,
        autofix: {
          description: 'Remove console.log',
          edits: [{ start: 0, end: 17, text: '' }],
        },
      },
    ]);

    const actions = state.onCodeAction?.({ textDocument: { uri } });
    const firstAction = (actions as Array<{ title: string; kind: string }>)[0];

    expect(Array.isArray(actions)).toBe(true);
    expect(actions?.length).toBe(1);
    expect(firstAction?.title).toBe('Remove console.log');
    expect(firstAction?.kind).toBe('quickfix');
  });

  it('clears cache and diagnostics when a document closes', async () => {
    const server = new SpecBridgeLspServer({ cwd: '/repo' });
    await server.initialize();
    await state.onInitialize?.();

    const uri = 'file:///repo/src/example.ts';
    const doc = TextDocument.create(uri, 'typescript', 1, 'export const x = 1;');

    (server as unknown as LspServerInternals).cache.set(uri, []);
    state.onDidClose?.({ document: doc });

    const last = state.diagnostics[state.diagnostics.length - 1];
    expect((server as unknown as LspServerInternals).cache.has(uri)).toBe(false);
    expect(last?.uri).toBe(uri);
    expect(last?.diagnostics).toEqual([]);
  });

  it('publishes initialization error diagnostics when workspace is missing .specbridge', async () => {
    state.specBridgeDirExists = false;
    const server = new SpecBridgeLspServer({ cwd: '/repo' });
    await server.initialize();
    await state.onInitialize?.();

    const uri = 'file:///repo/src/missing.ts';
    const doc = TextDocument.create(uri, 'typescript', 1, 'export const ok = true;');
    state.documents.set(uri, doc);

    await (server as unknown as LspServerInternals).validateDocument(doc);
    const payload = state.diagnostics[state.diagnostics.length - 1];
    const firstMessage = payload?.diagnostics[0]?.message.toLowerCase() || '';

    expect(payload?.uri).toBe(uri);
    expect(firstMessage).toContain('not initialized');
  });
});
