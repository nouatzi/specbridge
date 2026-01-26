/**
 * Inference Engine - Orchestrates pattern detection
 */
import type { Pattern, InferenceResult, SpecBridgeConfig } from '../core/types/index.js';
import { AnalyzerNotFoundError } from '../core/errors/index.js';
import { CodeScanner } from './scanner.js';
import { getAnalyzer, getAnalyzerIds, type Analyzer } from './analyzers/index.js';

export interface InferenceOptions {
  analyzers?: string[];
  minConfidence?: number;
  sourceRoots?: string[];
  exclude?: string[];
  cwd?: string;
}

/**
 * Inference Engine class
 */
export class InferenceEngine {
  private scanner: CodeScanner;
  private analyzers: Analyzer[] = [];

  constructor() {
    this.scanner = new CodeScanner();
  }

  /**
   * Configure analyzers to use
   */
  configureAnalyzers(analyzerIds: string[]): void {
    this.analyzers = [];

    for (const id of analyzerIds) {
      const analyzer = getAnalyzer(id);
      if (!analyzer) {
        throw new AnalyzerNotFoundError(id);
      }
      this.analyzers.push(analyzer);
    }
  }

  /**
   * Run inference on the codebase
   */
  async infer(options: InferenceOptions): Promise<InferenceResult> {
    const startTime = Date.now();

    const {
      analyzers: analyzerIds = getAnalyzerIds(),
      minConfidence = 50,
      sourceRoots = ['src/**/*.ts', 'src/**/*.tsx'],
      exclude = ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
      cwd = process.cwd(),
    } = options;

    // Configure analyzers
    this.configureAnalyzers(analyzerIds);

    // Scan codebase
    const scanResult = await this.scanner.scan({
      sourceRoots,
      exclude,
      cwd,
    });

    if (scanResult.totalFiles === 0) {
      return {
        patterns: [],
        analyzersRun: analyzerIds,
        filesScanned: 0,
        duration: Date.now() - startTime,
      };
    }

    // Run all analyzers
    const allPatterns: Pattern[] = [];

    for (const analyzer of this.analyzers) {
      try {
        const patterns = await analyzer.analyze(this.scanner);
        allPatterns.push(...patterns);
      } catch (error) {
        // Log but don't fail on individual analyzer errors
        console.warn(`Analyzer ${analyzer.id} failed:`, error);
      }
    }

    // Filter by minimum confidence
    const filteredPatterns = allPatterns.filter(p => p.confidence >= minConfidence);

    // Sort by confidence (highest first)
    filteredPatterns.sort((a, b) => b.confidence - a.confidence);

    return {
      patterns: filteredPatterns,
      analyzersRun: analyzerIds,
      filesScanned: scanResult.totalFiles,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Get scanner for direct access
   */
  getScanner(): CodeScanner {
    return this.scanner;
  }
}

/**
 * Create an inference engine from config
 */
export function createInferenceEngine(): InferenceEngine {
  return new InferenceEngine();
}

/**
 * Run inference with config
 */
export async function runInference(
  config: SpecBridgeConfig,
  options?: Partial<InferenceOptions>
): Promise<InferenceResult> {
  const engine = createInferenceEngine();

  return engine.infer({
    analyzers: config.inference?.analyzers,
    minConfidence: config.inference?.minConfidence,
    sourceRoots: config.project.sourceRoots,
    exclude: config.project.exclude,
    ...options,
  });
}
