/**
 * Dashboard Performance Benchmarks
 *
 * Tests dashboard caching and response times
 */
import { describe, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DashboardServer } from '../../src/dashboard/server.js';
import { setupTestProject, createDecisionYaml } from '../helpers/setup.js';
import type { SpecBridgeConfig } from '../../src/core/types/index.js';
import request from 'supertest';

describe('Dashboard Performance Benchmarks', () => {
  let testDir: string;
  let config: SpecBridgeConfig;
  let server: DashboardServer;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-dashboard-bench-'));

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'test-decision',
          content: createDecisionYaml('test-decision', {
            title: 'Test Decision',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'Test',
                severity: 'medium',
                scope: '**/*.ts',
              },
            ],
          }),
        },
      ],
    });

    config = {
      version: 1,
      project: {
        name: 'benchmark-project',
        root: testDir,
      },
    };

    server = new DashboardServer({ cwd: testDir, config });
    await server.start();
  });

  afterEach(() => {
    server.stop();

    if (testDir && testDir.includes('specbridge-dashboard-bench-')) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should serve cached reports quickly', async () => {
    const app = server.getApp();

    // Wait for initial cache to populate
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Benchmark cached response
    const start = Date.now();
    const response = await request(app).get('/api/report/latest');
    const duration = Date.now() - start;

    console.log(`\nDashboard Cache Benchmark:`);
    console.log(`  Response time:   ${duration}ms`);
    console.log(`  Status:          ${response.status}`);
    console.log(`  Cached:          ${response.body.cached}`);

    // Should respond in under 1 second (target: sub-100ms for cached)
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(1000);
  });

  it('should handle concurrent requests efficiently', async () => {
    const app = server.getApp();

    // Wait for cache
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Make 10 concurrent requests
    const start = Date.now();

    const requests = Array(10)
      .fill(null)
      .map(() => request(app).get('/api/report/latest'));

    const responses = await Promise.all(requests);
    const duration = Date.now() - start;

    const avgDuration = duration / 10;

    console.log(`\nConcurrent Requests Benchmark:`);
    console.log(`  Requests:        10`);
    console.log(`  Total time:      ${duration}ms`);
    console.log(`  Avg per request: ${avgDuration.toFixed(1)}ms`);

    // All should succeed
    responses.forEach((r) => {
      expect(r.status).toBe(200);
      expect(r.body.cached).toBe(true);
    });

    // Should handle concurrency well (avg < 200ms)
    expect(avgDuration).toBeLessThan(200);
  });

  it('should benchmark history loading', async () => {
    const app = server.getApp();

    const start = Date.now();
    const response = await request(app).get('/api/report/history?days=30');
    const duration = Date.now() - start;

    console.log(`\nHistory Loading Benchmark:`);
    console.log(`  Duration:        ${duration}ms`);
    console.log(`  Reports found:   ${response.body.length}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should benchmark decisions endpoint', async () => {
    const app = server.getApp();

    const start = Date.now();
    const response = await request(app).get('/api/decisions');
    const duration = Date.now() - start;

    console.log(`\nDecisions Endpoint Benchmark:`);
    console.log(`  Duration:        ${duration}ms`);
    console.log(`  Decisions found: ${response.body.length}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    // Should be fast (registry loaded once)
    expect(duration).toBeLessThan(500);
  });

  it('should benchmark health check endpoint', async () => {
    const app = server.getApp();

    const times: number[] = [];

    // Run multiple times
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await request(app).get('/api/health');
      times.push(Date.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);

    console.log(`\nHealth Check Benchmark:`);
    console.log(`  Avg time:        ${avgTime.toFixed(1)}ms`);
    console.log(`  Max time:        ${maxTime}ms`);

    // Health check should be very fast
    expect(avgTime).toBeLessThan(50);
  });
});
