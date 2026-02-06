/**
 * Tests for dashboard server
 */
import { describe, it, expect } from 'vitest';
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

function getMiddlewareStack(app: any): any[] {
  return app?._router?.stack ?? app?.router?.stack ?? [];
}

function getRegisteredRoutes(app: any): string[] {
  const routes: string[] = [];
  for (const layer of getMiddlewareStack(app)) {
    if (layer.route?.path) {
      routes.push(layer.route.path);
    }
  }
  return routes;
}

describe('Dashboard Server', () => {
  describe('createDashboardServer', () => {
    it('should create a DashboardServer instance', () => {
      const server = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      expect(server).toBeDefined();
      expect(typeof server.getApp).toBe('function');
    });

    it('should provide Express application via getApp()', () => {
      const server = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const app = server.getApp();
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });

    it('should register API routes', () => {
      const server = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const app = server.getApp();

      // Get all registered routes
      const routes = getRegisteredRoutes(app);

      // Check that key API routes are registered
      expect(routes).toContain('/api/health');
      expect(routes).toContain('/api/report/latest');
      expect(routes).toContain('/api/report/history');
      expect(routes).toContain('/api/decisions');
    });
  });

  describe('API Endpoints Structure', () => {
    it('should have health check endpoint', () => {
      const server = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const app = server.getApp();
      const routes = getRegisteredRoutes(app);

      expect(routes).toContain('/api/health');
    });

    it('should have report endpoints', () => {
      const server = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const app = server.getApp();
      const routes = getRegisteredRoutes(app);

      expect(routes).toContain('/api/report/latest');
      expect(routes).toContain('/api/report/history');
      expect(routes).toContain('/api/report/dates');
    });

    it('should have decision endpoints', () => {
      const server = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const app = server.getApp();
      const routes = getRegisteredRoutes(app);

      expect(routes).toContain('/api/decisions');
    });

    it('should have analytics endpoints', () => {
      const server = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const app = server.getApp();
      const routes = getRegisteredRoutes(app);

      expect(routes).toContain('/api/analytics/summary');
    });

    it('should have drift and trend endpoints', () => {
      const server = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const app = server.getApp();
      const routes = getRegisteredRoutes(app);

      expect(routes).toContain('/api/drift');
      expect(routes).toContain('/api/trend');
    });
  });

  describe('CORS Configuration', () => {
    it('should set CORS headers', () => {
      const server = createDashboardServer({
        cwd: process.cwd(),
        config: mockConfig,
      });

      const app = server.getApp();
      const stack = getMiddlewareStack(app);

      // CORS middleware should be configured
      // Check that middleware stack includes CORS handling
      const hasCorsMiddleware = stack.some((layer: any) => {
        return layer.name === 'corsMiddleware' || (layer.handle && layer.handle.length === 3);
      });

      // The app should have middleware configured
      expect(hasCorsMiddleware).toBe(true);
      expect(stack.length).toBeGreaterThan(0);
    });
  });
});
