/**
 * Dashboard server - Compliance dashboard backend with REST API
 */
import express, { type Request, type Response, type Application } from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpecBridgeConfig } from '../core/types/index.js';
import { generateReport } from '../reporting/reporter.js';
import { ReportStorage } from '../reporting/storage.js';
import { AnalyticsEngine } from '../analytics/engine.js';
import { createRegistry } from '../registry/registry.js';
import { detectDrift, analyzeTrend } from '../reporting/drift.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface DashboardOptions {
  cwd: string;
  config: SpecBridgeConfig;
}

/**
 * Create and configure the dashboard server
 */
export function createDashboardServer(options: DashboardOptions): Application {
  const { cwd, config } = options;
  const app = express();

  // Middleware
  app.use(express.json());

  // CORS for development
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  /**
   * GET /api/report/latest
   * Get the most recent compliance report
   */
  app.get('/api/report/latest', async (_req: Request, res: Response) => {
    try {
      const report = await generateReport(config, { cwd });
      res.json(report);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/report/history?days=30
   * Get historical reports
   */
  app.get('/api/report/history', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const storage = new ReportStorage(cwd);
      const history = await storage.loadHistory(days);
      res.json(history);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to load history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/report/dates
   * Get all available report dates
   */
  app.get('/api/report/dates', async (_req: Request, res: Response) => {
    try {
      const storage = new ReportStorage(cwd);
      const dates = await storage.getAvailableDates();
      res.json(dates);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to load dates',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/report/:date
   * Get a specific report by date
   */
  app.get('/api/report/:date', async (req: Request, res: Response) => {
    try {
      const date = req.params.date;
      if (!date) {
        res.status(400).json({ error: 'Date parameter required' });
        return;
      }

      const storage = new ReportStorage(cwd);
      const report = await storage.loadByDate(date);

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

  /**
   * GET /api/decisions
   * Get all architectural decisions
   */
  app.get('/api/decisions', async (_req: Request, res: Response) => {
    try {
      const registry = createRegistry({ basePath: cwd });
      await registry.load();
      const decisions = registry.getAll();
      res.json(decisions);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to load decisions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/decisions/:id
   * Get a specific decision by ID
   */
  app.get('/api/decisions/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      if (!id) {
        res.status(400).json({ error: 'Decision ID required' });
        return;
      }

      const registry = createRegistry({ basePath: cwd });
      await registry.load();
      const decision = registry.get(id);

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

  /**
   * GET /api/analytics/summary?days=90
   * Get analytics summary
   */
  app.get('/api/analytics/summary', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 90;
      const storage = new ReportStorage(cwd);
      const history = await storage.loadHistory(days);

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

  /**
   * GET /api/analytics/decision/:id?days=90
   * Get analytics for a specific decision
   */
  app.get('/api/analytics/decision/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      if (!id) {
        res.status(400).json({ error: 'Decision ID required' });
        return;
      }

      const days = parseInt(req.query.days as string) || 90;
      const storage = new ReportStorage(cwd);
      const history = await storage.loadHistory(days);

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

  /**
   * GET /api/drift?days=2
   * Get drift analysis between most recent reports
   */
  app.get('/api/drift', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 2;
      const storage = new ReportStorage(cwd);
      const history = await storage.loadHistory(days);

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

  /**
   * GET /api/trend?days=30
   * Get compliance trend over time
   */
  app.get('/api/trend', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const storage = new ReportStorage(cwd);
      const history = await storage.loadHistory(days);

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

  /**
   * GET /api/health
   * Health check endpoint
   */
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      project: config.project.name,
    });
  });

  // Serve static frontend files
  const publicDir = join(__dirname, 'public');
  app.use(express.static(publicDir));

  // Fallback to index.html for SPA routing
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(join(publicDir, 'index.html'));
  });

  return app;
}
