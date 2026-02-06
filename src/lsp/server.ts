/**
 * SpecBridge Language Server (LSP)
 */
import { createConnection, ProposedFeatures, TextDocuments, TextDocumentSyncKind, DiagnosticSeverity, CodeActionKind } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Project } from 'ts-morph';
import chalk from 'chalk';
import { loadConfig } from '../config/loader.js';
import { createRegistry, type Registry } from '../registry/registry.js';
import { getSpecBridgeDir, pathExists } from '../utils/fs.js';
import { selectVerifierForConstraint, type VerificationContext } from '../verification/verifiers/index.js';
import { shouldApplyConstraintToFile } from '../verification/applicability.js';
import { getPluginLoader } from '../verification/plugins/loader.js';
import type { Decision, Violation, Severity } from '../core/types/index.js';
import { NotInitializedError } from '../core/errors/index.js';

export interface LspServerOptions {
  cwd: string;
  verbose?: boolean;
}

function severityToDiagnostic(severity: Severity): DiagnosticSeverity {
  switch (severity) {
    case 'critical':
      return DiagnosticSeverity.Error;
    case 'high':
      return DiagnosticSeverity.Warning;
    case 'medium':
      return DiagnosticSeverity.Information;
    case 'low':
      return DiagnosticSeverity.Hint;
    default:
      return DiagnosticSeverity.Information;
  }
}

function uriToFilePath(uri: string): string {
  if (uri.startsWith('file://')) return fileURLToPath(uri);
  // Fallback: treat as plain path
  return uri;
}

function violationToRange(doc: TextDocument, v: Violation) {
  // Prefer autofix ranges when available, otherwise line/column best-effort.
  const edit = v.autofix?.edits?.[0];
  if (edit) {
    return {
      start: doc.positionAt(edit.start),
      end: doc.positionAt(edit.end),
    };
  }

  const line = Math.max(0, (v.line ?? 1) - 1);
  const char = Math.max(0, (v.column ?? 1) - 1);
  return {
    start: { line, character: char },
    end: { line, character: char + 1 },
  };
}

export class SpecBridgeLspServer {
  private connection = createConnection(ProposedFeatures.all);
  private documents = new TextDocuments(TextDocument);

  private options: LspServerOptions;
  private registry: Registry | null = null;
  private decisions: Decision[] = [];
  private cwd: string;
  private project: Project;
  private cache = new Map<string, Violation[]>();
  private initError: string | null = null;

  constructor(options: LspServerOptions) {
    this.options = options;
    this.cwd = options.cwd;
    this.project = new Project({
      compilerOptions: {
        allowJs: true,
        checkJs: false,
        noEmit: true,
        skipLibCheck: true,
      },
      skipAddingFilesFromTsConfig: true,
    });
  }

  async initialize(): Promise<void> {
    this.connection.onInitialize(async () => {
      await this.initializeWorkspace();

      return {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          codeActionProvider: true,
        },
      };
    });

    this.documents.onDidOpen((e) => {
      void this.validateDocument(e.document);
    });

    this.documents.onDidChangeContent((change) => {
      void this.validateDocument(change.document);
    });

    this.documents.onDidClose((e) => {
      this.cache.delete(e.document.uri);
      this.connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
    });

    this.connection.onCodeAction((params) => {
      const violations = this.cache.get(params.textDocument.uri) || [];
      const doc = this.documents.get(params.textDocument.uri);
      if (!doc) return [];

      return violations
        .filter((v) => v.autofix && v.autofix.edits.length > 0)
        .map((v) => {
          const autofix = v.autofix;
          if (!autofix) {
            return null;
          }

          const edits = autofix.edits.map((edit) => ({
            range: {
              start: doc.positionAt(edit.start),
              end: doc.positionAt(edit.end),
            },
            newText: edit.text,
          }));

          return {
            title: autofix.description,
            kind: CodeActionKind.QuickFix,
            edit: {
              changes: {
                [params.textDocument.uri]: edits,
              },
            },
          };
        })
        .filter((action): action is NonNullable<typeof action> => action !== null);
    });

    this.documents.listen(this.connection);
    this.connection.listen();
  }

  private async initializeWorkspace(): Promise<void> {
    // Ensure initialized (but keep server alive if not).
    if (!await pathExists(getSpecBridgeDir(this.cwd))) {
      const err = new NotInitializedError();
      this.initError = err.message;
      if (this.options.verbose) this.connection.console.error(chalk.red(this.initError));
      return;
    }

    try {
      const config = await loadConfig(this.cwd);

      // Load custom verifier plugins (best-effort). This must not write to stdout.
      try {
        await getPluginLoader().loadPlugins(this.cwd);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (this.options.verbose) this.connection.console.error(chalk.red(`Plugin load failed: ${msg}`));
      }

      this.registry = createRegistry({ basePath: this.cwd });
      await this.registry.load();
      this.decisions = this.registry.getActive();

      // Prime project with source roots (best-effort). This enables verifiers that depend on import graph.
      for (const root of config.project.sourceRoots) {
        // ts-morph doesn't support globs directly; add root folders when possible.
        const rootPath = path.isAbsolute(root) ? root : path.join(this.cwd, root);
        // If root is a glob, fall back to adding the directory portion.
        const dir = rootPath.includes('*') ? rootPath.split('*')[0] : rootPath;
        if (dir && await pathExists(dir)) {
          this.project.addSourceFilesAtPaths(path.join(dir, '**/*.{ts,tsx,js,jsx}'));
        }
      }

      if (this.options.verbose) {
        this.connection.console.log(chalk.dim(`Loaded ${this.decisions.length} active decision(s)`));
      }
    } catch (error) {
      this.initError = error instanceof Error ? error.message : String(error);
      if (this.options.verbose) this.connection.console.error(chalk.red(this.initError));
    }
  }

  private async verifyTextDocument(doc: TextDocument): Promise<Violation[]> {
    if (this.initError) {
      throw new Error(this.initError);
    }
    if (!this.registry) return [];

    const filePath = uriToFilePath(doc.uri);
    const sourceFile = this.project.createSourceFile(filePath, doc.getText(), { overwrite: true });

    const violations: Violation[] = [];

    for (const decision of this.decisions) {
      for (const constraint of decision.constraints) {
        if (!shouldApplyConstraintToFile({ filePath, constraint, cwd: this.cwd })) continue;

        const verifier = selectVerifierForConstraint(constraint.rule, constraint.verifier, constraint.check);
        if (!verifier) continue;

        const ctx: VerificationContext = {
          filePath,
          sourceFile,
          constraint,
          decisionId: decision.metadata.id,
        };

        try {
          const constraintViolations = await verifier.verify(ctx);
          violations.push(...constraintViolations);
        } catch {
          // Ignore verifier errors (LSP should stay responsive)
        }
      }
    }

    return violations;
  }

  private async validateDocument(doc: TextDocument): Promise<void> {
    try {
      const violations = await this.verifyTextDocument(doc);
      this.cache.set(doc.uri, violations);

      const diagnostics = violations.map((v) => ({
        range: violationToRange(doc, v),
        severity: severityToDiagnostic(v.severity),
        message: v.message,
        source: 'specbridge',
      }));

      this.connection.sendDiagnostics({ uri: doc.uri, diagnostics });
    } catch (error) {
      // If workspace isn't initialized, surface a single diagnostic.
      const msg = error instanceof Error ? error.message : String(error);
      this.connection.sendDiagnostics({
        uri: doc.uri,
        diagnostics: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
            severity: DiagnosticSeverity.Error,
            message: msg,
            source: 'specbridge',
          },
        ],
      });
    }
  }
}
