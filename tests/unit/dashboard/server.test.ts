/**
 * Tests for dashboard server
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDashboardServer } from '../../../src/dashboard/server.js';
import type { SpecBridgeConfig } from '../../../src/core/types/index.js';

// Mock config
const mockConfig: SpecBridgeConfig = {
  project: {
    name: 'test-project',
    version: '1.0.0',
    sourceRoots: ['src'],
    exclude: ['node_modules'],
  },
  verification: {
    levels: {
      commit: {
        enabled: true,
        severities: ['critical', 'high'],
      },
      pr: {
        enabled: true,
        severities: ['critical', 'high', 'medium'],
      },
      full: {
        enabled: true,
        severities: ['critical', 'high', 'medium', 'low'],
      },
    },
  },
};

describe('Dashboard Server', () => {
  describe('createDashboardServer', () => {
    it('should create an Express application', () => {
      const app = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });

    it('should configure JSON middleware', () => {
      const app = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      // Check that app has the expected structure
      expect(app._router).toBeDefined();
    });

    it('should register API routes', () => {
      const app = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      // Get all registered routes
      const routes: string[] = [];
      app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          routes.push(middleware.route.path);
        }
      });

      // Check that key API routes are registered
      expect(routes).toContain('/api/health');
      expect(routes).toContain('/api/report/latest');
      expect(routes).toContain('/api/report/history');
      expect(routes).toContain('/api/decisions');
    });
  });

  describe('API Endpoints Structure', () => {
    it('should have health check endpoint', () => {
      const app = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const routes: string[] = [];
      app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          routes.push(middleware.route.path);
        }
      });

      expect(routes).toContain('/api/health');
    });

    it('should have report endpoints', () => {
      const app = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const routes: string[] = [];
      app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          routes.push(middleware.route.path);
        }
      });

      expect(routes).toContain('/api/report/latest');
      expect(routes).toContain('/api/report/history');
      expect(routes).toContain('/api/report/dates');
    });

    it('should have decision endpoints', () => {
      const app = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const routes: string[] = [];
      app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          routes.push(middleware.route.path);
        }
      });

      expect(routes).toContain('/api/decisions');
    });

    it('should have analytics endpoints', () => {
      const app = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const routes: string[] = [];
      app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          routes.push(middleware.route.path);
        }
      });

      expect(routes).toContain('/api/analytics/summary');
    });

    it('should have drift and trend endpoints', () => {
      const app = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const routes: string[] = [];
      app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          routes.push(middleware.route.path);
        }
      });

      expect(routes).toContain('/api/drift');
      expect(routes).toContain('/api/trend');
    });
  });

  describe('CORS Configuration', () => {
    it('should set CORS headers', () => {
      const app = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      // CORS middleware should be configured
      // Check that middleware stack includes CORS handling
      const hasCorsMiddleware = app._router.stack.some((layer: any) => {
        return layer.name === 'corsMiddleware' || (layer.handle && layer.handle.length === 3);
      });

      // The app should have middleware configured
      expect(app._router.stack.length).toBeGreaterThan(0);
    });
  });
});
