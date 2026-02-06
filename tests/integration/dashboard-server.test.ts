import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDashboardServer, type DashboardServer } from '../../src/dashboard/server.js';
import { loadConfig } from '../../src/config/loader.js';
import { setupTestProject, createDecisionYaml } from '../helpers/setup.js';

async function startHttpServer(server: DashboardServer): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = server.getApp();
  const httpServer = app.listen(0, '127.0.0.1');
  await once(httpServer, 'listening');

  const address = httpServer.address() as AddressInfo | null;
  if (!address) {
    throw new Error('Could not obtain dashboard server address');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

describe('Dashboard Server Integration', () => {
  let testDir: string;
  let dashboardServer: DashboardServer | null = null;
  let closeHttpServer: (() => Promise<void>) | null = null;
  let baseUrl: string | null = null;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'specbridge-dashboard-test-'));

    const srcDir = join(testDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, 'service.ts'),
      `
export class Service {
  run() {
    return 'ok';
  }
}
`
    );

    await setupTestProject(testDir, {
      decisions: [
        {
          id: 'dash-001',
          content: createDecisionYaml('dash-001', {
            title: 'Dashboard integration decision',
            constraints: [
              {
                id: 'c-1',
                type: 'convention',
                rule: 'must contain /class/',
                severity: 'low',
                scope: 'src/**/*.ts',
                verifier: 'regex',
              },
            ],
          }),
        },
      ],
    });

    const config = await loadConfig(testDir);
    dashboardServer = createDashboardServer({ cwd: testDir, config });
    await dashboardServer.start();

    const http = await startHttpServer(dashboardServer);
    baseUrl = http.baseUrl;
    closeHttpServer = http.close;
  });

  afterEach(async () => {
    if (closeHttpServer) {
      await closeHttpServer();
      closeHttpServer = null;
    }

    if (dashboardServer) {
      dashboardServer.stop();
      dashboardServer = null;
    }

    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('serves health and report endpoints', async () => {
    const health = await fetch(`${baseUrl}/api/health`);
    expect(health.status).toBe(200);
    const healthBody = await health.json();
    expect(healthBody.status).toBe('ok');
    expect(healthBody.project).toBe('test-project');

    const latest = await fetch(`${baseUrl}/api/report/latest`);
    expect(latest.status).toBe(200);
    const latestBody = await latest.json();
    expect(latestBody.cached).toBe(true);
    expect(latestBody.summary).toBeDefined();

    const dates = await fetch(`${baseUrl}/api/report/dates`);
    expect(dates.status).toBe(200);
    const datesBody = await dates.json();
    expect(Array.isArray(datesBody)).toBe(true);

    const history = await fetch(`${baseUrl}/api/report/history?days=7`);
    expect(history.status).toBe(200);
    const historyBody = await history.json();
    expect(Array.isArray(historyBody)).toBe(true);
  });

  it('serves decisions and error cases for missing entities', async () => {
    const decisions = await fetch(`${baseUrl}/api/decisions`);
    expect(decisions.status).toBe(200);
    const decisionsBody = await decisions.json();
    expect(Array.isArray(decisionsBody)).toBe(true);
    expect(decisionsBody.some((d: { metadata: { id: string } }) => d.metadata.id === 'dash-001')).toBe(true);

    const existingDecision = await fetch(`${baseUrl}/api/decisions/dash-001`);
    expect(existingDecision.status).toBe(200);
    const existingBody = await existingDecision.json();
    expect(existingBody.metadata.id).toBe('dash-001');

    const missingDecision = await fetch(`${baseUrl}/api/decisions/not-found`);
    expect(missingDecision.status).toBe(404);
    const missingBody = await missingDecision.json();
    expect(missingBody.error).toBe('Decision not found');
  });

  it('returns expected status for analytics-dependent routes with limited history', async () => {
    const drift = await fetch(`${baseUrl}/api/drift?days=2`);
    expect([200, 404]).toContain(drift.status);

    const trend = await fetch(`${baseUrl}/api/trend?days=2`);
    expect([200, 404]).toContain(trend.status);
  });
});
