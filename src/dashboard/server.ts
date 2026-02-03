/**
 * Dashboard server - Compliance dashboard backend with REST API
 */
import express, { type Request, type Response, type Application } from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpecBridgeConfig, ComplianceReport } from '../core/types/index.js';
import { generateReport } from '../reporting/reporter.js';
import { ReportStorage } from '../reporting/storage.js';
import { AnalyticsEngine } from '../analytics/engine.js';
import { createRegistry, type Registry } from '../registry/registry.js';
import { detectDrift, analyzeTrend } from '../reporting/drift.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface DashboardOptions {
  cwd: string;
  config: SpecBridgeConfig;
}

/**
 * Dashboard Server with caching
 */
class DashboardServer {
  private app: Application;
  private cwd: string;
  private config: SpecBridgeConfig;
  private registry: Registry;
  private reportStorage: ReportStorage;

  // Caching infrastructure
  private cachedReport: ComplianceReport | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(options: DashboardOptions) {
    this.cwd = options.cwd;
    this.config = options.config;
    this.app = express();
    this.registry = createRegistry({ basePath: this.cwd });
    this.reportStorage = new ReportStorage(this.cwd);

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Start the server with background cache refresh
   */
  async start(): Promise<void> {
    // Load registry once
    await this.registry.load();

    // Initial cache population
    await this.refreshCache();

    // Background refresh
    this.refreshInterval = setInterval(
      () => this.refreshCache().catch(console.error),
      this.CACHE_TTL
    );
  }

  /**
   * Stop the server and clear intervals
   */
  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Refresh the cached report
   */
  private async refreshCache(): Promise<void> {
    try {
      const report = await generateReport(this.config, { cwd: this.cwd });

      this.cachedReport = report;
      this.cacheTimestamp = Date.now();

      // Persist to disk
      await this.reportStorage.save(report);
    } catch (error) {
      console.error('Cache refresh failed:', error);

      // Fallback: Load last saved report if cache is empty
      if (!this.cachedReport) {
        try {
          const stored = await this.reportStorage.loadLatest();
          if (stored) {
            this.cachedReport = stored.report;
          }
        } catch (fallbackError) {
          console.error('Failed to load fallback report:', fallbackError);
        }
      }
    }
  }

  /**
   * Get the Express app instance
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());

    // CORS for development
    this.app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });
  }

  /**
   * Setup all routes
   */
  private setupRoutes(): void {
    this.setupReportRoutes();
    this.setupDecisionRoutes();
    this.setupAnalyticsRoutes();
    this.setupHealthRoute();
    this.setupStaticFiles();
  }

  /**
   * Setup report-related routes
   */
  private setupReportRoutes(): void {
    // GET /api/report/latest - Serve cached report
    this.app.get('/api/report/latest', (_req: Request, res: Response) => {
      if (!this.cachedReport) {
        res.status(503).json({ error: 'Report not ready' });
        return;
      }

      res.json({
        ...this.cachedReport,
        cached: true,
        cacheAge: Date.now() - this.cacheTimestamp,
      });
    });

    // GET /api/report/history?days=30
    this.app.get('/api/report/history', async (req: Request, res: Response) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const history = await this.reportStorage.loadHistory(days);
        res.json(history);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to load history',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // GET /api/report/dates
    this.app.get('/api/report/dates', async (_req: Request, res: Response) => {
      try {
        const dates = await this.reportStorage.getAvailableDates();
        res.json(dates);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to load dates',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // GET /api/report/:date
    this.app.get('/api/report/:date', async (req: Request, res: Response) => {
      try {
        const date = req.params.date;
        if (!date) {
          res.status(400).json({ error: 'Date parameter required' });
          return;
        }

        const report = await this.reportStorage.loadByDate(date);

        if (!report) {
          res.status(404).json({ error: 'Report not found' });
          return;
        }

        res.json(report);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to load report',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  /**
   * Setup decision-related routes
   */
  private setupDecisionRoutes(): void {
    // GET /api/decisions
    this.app.get('/api/decisions', async (_req: Request, res: Response) => {
      try {
        const decisions = this.registry.getAll();
        res.json(decisions);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to load decisions',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // GET /api/decisions/:id
    this.app.get('/api/decisions/:id', async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ error: 'Decision ID required' });
          return;
        }

        const decision = this.registry.get(id);

        if (!decision) {
          res.status(404).json({ error: 'Decision not found' });
          return;
        }

        res.json(decision);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to load decision',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  /**
   * Setup analytics-related routes
   */
  private setupAnalyticsRoutes(): void {
    // GET /api/analytics/summary?days=90
    this.app.get('/api/analytics/summary', async (req: Request, res: Response) => {
      try {
        const days = parseInt(req.query.days as string) || 90;
        const history = await this.reportStorage.loadHistory(days);

        if (history.length === 0) {
          res.status(404).json({ error: 'No historical data available' });
          return;
        }

        const engine = new AnalyticsEngine();
        const summary = await engine.generateSummary(history);
        res.json(summary);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to generate analytics',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // GET /api/analytics/decision/:id?days=90
    this.app.get('/api/analytics/decision/:id', async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ error: 'Decision ID required' });
          return;
        }

        const days = parseInt(req.query.days as string) || 90;
        const history = await this.reportStorage.loadHistory(days);

        if (history.length === 0) {
          res.status(404).json({ error: 'No historical data available' });
          return;
        }

        const engine = new AnalyticsEngine();
        const metrics = await engine.analyzeDecision(id, history);
        res.json(metrics);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to analyze decision',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // GET /api/drift?days=2
    this.app.get('/api/drift', async (req: Request, res: Response) => {
      try {
        const days = parseInt(req.query.days as string) || 2;
        const history = await this.reportStorage.loadHistory(days);

        if (history.length < 2) {
          res.status(404).json({ error: 'Need at least 2 reports for drift analysis' });
          return;
        }

        const currentEntry = history[0];
        const previousEntry = history[1];

        if (!currentEntry || !previousEntry) {
          res.status(400).json({ error: 'Invalid history data' });
          return;
        }

        const drift = await detectDrift(currentEntry.report, previousEntry.report);
        res.json(drift);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to analyze drift',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // GET /api/trend?days=30
    this.app.get('/api/trend', async (req: Request, res: Response) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const history = await this.reportStorage.loadHistory(days);

        if (history.length < 2) {
          res.status(404).json({ error: 'Need at least 2 reports for trend analysis' });
          return;
        }

        const trend = await analyzeTrend(history);
        res.json(trend);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to analyze trend',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  /**
   * Setup health check route
   */
  private setupHealthRoute(): void {
    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        project: this.config.project.name,
        cache: {
          loaded: this.cachedReport !== null,
          age: Date.now() - this.cacheTimestamp,
          nextRefresh: this.CACHE_TTL - (Date.now() - this.cacheTimestamp),
        },
      });
    });
  }

  /**
   * Setup static file serving
   */
  private setupStaticFiles(): void {
    // Serve static frontend files
    const publicDir = join(__dirname, 'public');
    this.app.use(express.static(publicDir, {
      maxAge: '1h', // Cache static assets
      etag: true,
    }));

    // Fallback to index.html for SPA routing
    this.app.get('*', (_req: Request, res: Response) => {
      res.sendFile(join(publicDir, 'index.html'));
    });
  }
}

/**
 * Create and configure the dashboard server (factory function)
 * @returns DashboardServer instance
 */
export function createDashboardServer(options: DashboardOptions): DashboardServer {
  return new DashboardServer(options);
}

// Export the class for advanced usage
export { DashboardServer };
