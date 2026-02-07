import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Application } from 'express';
import type { ComplianceReport, Decision } from '../../../src/core/types/index.js';
import { DecisionNotFoundError } from '../../../src/core/errors/index.js';

interface HistoryEntry {
  timestamp: string;
  report: ComplianceReport;
}

const {
  generateReportMock,
  saveMock,
  loadLatestMock,
  loadHistoryMock,
  getAvailableDatesMock,
  loadByDateMock,
  registryLoadMock,
  registryGetAllMock,
  registryGetMock,
  generateSummaryMock,
  analyzeDecisionMock,
  detectDriftMock,
  analyzeTrendMock,
} = vi.hoisted(() => ({
  generateReportMock: vi.fn(),
  saveMock: vi.fn(),
  loadLatestMock: vi.fn(),
  loadHistoryMock: vi.fn(),
  getAvailableDatesMock: vi.fn(),
  loadByDateMock: vi.fn(),
  registryLoadMock: vi.fn(),
  registryGetAllMock: vi.fn(),
  registryGetMock: vi.fn(),
  generateSummaryMock: vi.fn(),
  analyzeDecisionMock: vi.fn(),
  detectDriftMock: vi.fn(),
  analyzeTrendMock: vi.fn(),
}));

vi.mock('../../../src/reporting/reporter.js', () => ({
  generateReport: generateReportMock,
}));

vi.mock('../../../src/reporting/storage.js', () => ({
  ReportStorage: class {
    save(report: ComplianceReport): Promise<string> {
      return saveMock(report);
    }
    loadLatest(): Promise<HistoryEntry | null> {
      return loadLatestMock();
    }
    loadHistory(days: number): Promise<HistoryEntry[]> {
      return loadHistoryMock(days);
    }
    getAvailableDates(): Promise<string[]> {
      return getAvailableDatesMock();
    }
    loadByDate(date: string): Promise<ComplianceReport | null> {
      return loadByDateMock(date);
    }
  },
}));

vi.mock('../../../src/registry/registry.js', () => ({
  createRegistry: () => ({
    load: registryLoadMock,
    getAll: registryGetAllMock,
    get: registryGetMock,
  }),
}));

vi.mock('../../../src/analytics/engine.js', () => ({
  AnalyticsEngine: class {
    generateSummary(history: HistoryEntry[]): Promise<Record<string, unknown>> {
      return generateSummaryMock(history);
    }
    analyzeDecision(id: string, history: HistoryEntry[]): Promise<Record<string, unknown>> {
      return analyzeDecisionMock(id, history);
    }
  },
}));

vi.mock('../../../src/reporting/drift.js', () => ({
  detectDrift: detectDriftMock,
  analyzeTrend: analyzeTrendMock,
}));

import { createDashboardServer, type DashboardServer } from '../../../src/dashboard/server.js';

function mockDecision(id: string): Decision {
  return {
    kind: 'Decision',
    metadata: {
      id,
      title: 'Dashboard decision',
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
        rule: 'must contain /class/',
        severity: 'low',
        scope: 'src/**/*.ts',
      },
    ],
  };
}

function mockReport(timestamp: string, compliance = 94): ComplianceReport {
  return {
    timestamp,
    project: 'specbridge',
    summary: {
      compliance,
      violations: 2,
      activeDecisions: 1,
    },
    details: [],
  } as unknown as ComplianceReport;
}

async function startHttpServer(
  app: Application
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new Error('Failed to resolve test HTTP server address');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

describe('DashboardServer (unit)', () => {
  let dashboard: DashboardServer;

  beforeEach(() => {
    generateReportMock.mockReset();
    saveMock.mockReset();
    loadLatestMock.mockReset();
    loadHistoryMock.mockReset();
    getAvailableDatesMock.mockReset();
    loadByDateMock.mockReset();
    registryLoadMock.mockReset();
    registryGetAllMock.mockReset();
    registryGetMock.mockReset();
    generateSummaryMock.mockReset();
    analyzeDecisionMock.mockReset();
    detectDriftMock.mockReset();
    analyzeTrendMock.mockReset();

    generateReportMock.mockResolvedValue(mockReport('2026-02-07T10:00:00.000Z'));
    saveMock.mockResolvedValue('/tmp/report-2026-02-07.json');
    loadLatestMock.mockResolvedValue(null);
    loadHistoryMock.mockResolvedValue([]);
    getAvailableDatesMock.mockResolvedValue(['2026-02-07']);
    loadByDateMock.mockResolvedValue(mockReport('2026-02-06T10:00:00.000Z', 92));
    registryLoadMock.mockResolvedValue(undefined);
    registryGetAllMock.mockReturnValue([mockDecision('dash-001')]);
    registryGetMock.mockImplementation((id: string) =>
      id === 'dash-001' ? mockDecision(id) : null
    );
    generateSummaryMock.mockResolvedValue({ trends: [] });
    analyzeDecisionMock.mockResolvedValue({ id: 'dash-001', score: 90 });
    detectDriftMock.mockResolvedValue({ trend: 'stable' });
    analyzeTrendMock.mockResolvedValue({ points: [] });

    dashboard = createDashboardServer({
      cwd: '/repo',
      config: {
        version: '1.0',
        project: {
          name: 'specbridge',
          sourceRoots: ['src'],
          exclude: ['node_modules'],
        },
        verification: {
          levels: {
            full: {
              severity: ['critical', 'high', 'medium', 'low'],
            },
          },
        },
      },
    });
  });

  afterEach(() => {
    dashboard.stop();
    vi.useRealTimers();
  });

  it('returns 503 for latest report before cache is warmed', async () => {
    const http = await startHttpServer(dashboard.getApp());
    const response = await fetch(`${http.baseUrl}/api/report/latest`);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe('Report not ready');
    await http.close();
  });

  it('loads registry, refreshes cache, and serves latest report after start', async () => {
    await dashboard.start();
    const http = await startHttpServer(dashboard.getApp());
    const response = await fetch(`${http.baseUrl}/api/report/latest`);
    const body = await response.json();

    expect(registryLoadMock).toHaveBeenCalledTimes(1);
    expect(generateReportMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.summary.compliance).toBe(94);
    await http.close();
  });

  it('falls back to stored latest report when refresh fails', async () => {
    generateReportMock.mockRejectedValueOnce(new Error('report generation failed'));
    loadLatestMock.mockResolvedValueOnce({
      timestamp: '2026-02-05',
      report: mockReport('2026-02-05T10:00:00.000Z', 88),
    });

    await dashboard.start();
    const http = await startHttpServer(dashboard.getApp());
    const response = await fetch(`${http.baseUrl}/api/report/latest`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.compliance).toBe(88);
    await http.close();
  });

  it('serves report history and dates endpoints with success and failure cases', async () => {
    await dashboard.start();
    loadHistoryMock.mockResolvedValueOnce([
      { timestamp: '2026-02-07', report: mockReport('2026-02-07T10:00:00.000Z') },
    ]);
    const http = await startHttpServer(dashboard.getApp());

    const okHistory = await fetch(`${http.baseUrl}/api/report/history?days=7`);
    const okHistoryBody = await okHistory.json();
    expect(okHistory.status).toBe(200);
    expect(okHistoryBody.length).toBe(1);

    loadHistoryMock.mockRejectedValueOnce(new Error('history failed'));
    const failedHistory = await fetch(`${http.baseUrl}/api/report/history?days=7`);
    expect(failedHistory.status).toBe(500);

    getAvailableDatesMock.mockResolvedValueOnce(['2026-02-07', '2026-02-06']);
    const okDates = await fetch(`${http.baseUrl}/api/report/dates`);
    const okDatesBody = await okDates.json();
    expect(okDates.status).toBe(200);
    expect(okDatesBody).toEqual(['2026-02-07', '2026-02-06']);

    getAvailableDatesMock.mockRejectedValueOnce(new Error('dates failed'));
    const failedDates = await fetch(`${http.baseUrl}/api/report/dates`);
    expect(failedDates.status).toBe(500);

    await http.close();
  });

  it('serves report by date with 200, 404 and 500 paths', async () => {
    await dashboard.start();
    const http = await startHttpServer(dashboard.getApp());

    loadByDateMock.mockResolvedValueOnce(mockReport('2026-02-06T10:00:00.000Z', 91));
    const found = await fetch(`${http.baseUrl}/api/report/2026-02-06`);
    expect(found.status).toBe(200);

    loadByDateMock.mockResolvedValueOnce(null);
    const missing = await fetch(`${http.baseUrl}/api/report/2026-02-05`);
    expect(missing.status).toBe(404);

    loadByDateMock.mockRejectedValueOnce(new Error('load failed'));
    const failed = await fetch(`${http.baseUrl}/api/report/2026-02-04`);
    expect(failed.status).toBe(500);

    await http.close();
  });

  it('serves decisions endpoints with 200, 404 and 500 paths', async () => {
    await dashboard.start();
    const http = await startHttpServer(dashboard.getApp());

    const list = await fetch(`${http.baseUrl}/api/decisions`);
    const listBody = await list.json();
    expect(list.status).toBe(200);
    expect(listBody[0].metadata.id).toBe('dash-001');

    registryGetAllMock.mockImplementationOnce(() => {
      throw new Error('registry failed');
    });
    const listFail = await fetch(`${http.baseUrl}/api/decisions`);
    expect(listFail.status).toBe(500);

    const one = await fetch(`${http.baseUrl}/api/decisions/dash-001`);
    const oneBody = await one.json();
    expect(one.status).toBe(200);
    expect(oneBody.metadata.id).toBe('dash-001');

    registryGetMock.mockReturnValueOnce(null);
    const missing = await fetch(`${http.baseUrl}/api/decisions/not-found`);
    expect(missing.status).toBe(404);

    registryGetMock.mockImplementationOnce(() => {
      throw new DecisionNotFoundError('dash-404');
    });
    const handledNotFound = await fetch(`${http.baseUrl}/api/decisions/dash-404`);
    expect(handledNotFound.status).toBe(404);

    registryGetMock.mockImplementationOnce(() => {
      throw new Error('unexpected');
    });
    const failed = await fetch(`${http.baseUrl}/api/decisions/dash-500`);
    expect(failed.status).toBe(500);

    await http.close();
  });

  it('serves analytics summary and per-decision endpoints', async () => {
    await dashboard.start();
    const http = await startHttpServer(dashboard.getApp());

    loadHistoryMock.mockResolvedValueOnce([]);
    const noSummary = await fetch(`${http.baseUrl}/api/analytics/summary?days=30`);
    expect(noSummary.status).toBe(404);

    loadHistoryMock.mockResolvedValueOnce([
      { timestamp: '2026-02-07', report: mockReport('2026-02-07T10:00:00.000Z') },
    ]);
    generateSummaryMock.mockResolvedValueOnce({ avg: 90 });
    const summary = await fetch(`${http.baseUrl}/api/analytics/summary?days=30`);
    expect(summary.status).toBe(200);

    loadHistoryMock.mockRejectedValueOnce(new Error('summary failed'));
    const summaryFail = await fetch(`${http.baseUrl}/api/analytics/summary?days=30`);
    expect(summaryFail.status).toBe(500);

    loadHistoryMock.mockResolvedValueOnce([]);
    const noDecisionMetrics = await fetch(
      `${http.baseUrl}/api/analytics/decision/dash-001?days=30`
    );
    expect(noDecisionMetrics.status).toBe(404);

    loadHistoryMock.mockResolvedValueOnce([
      { timestamp: '2026-02-07', report: mockReport('2026-02-07T10:00:00.000Z') },
    ]);
    analyzeDecisionMock.mockResolvedValueOnce({ id: 'dash-001', trend: 'improving' });
    const decisionMetrics = await fetch(`${http.baseUrl}/api/analytics/decision/dash-001?days=30`);
    expect(decisionMetrics.status).toBe(200);

    await http.close();
  });

  it('serves drift and trend endpoints with minimum-history guards', async () => {
    await dashboard.start();
    const http = await startHttpServer(dashboard.getApp());

    loadHistoryMock.mockResolvedValueOnce([
      { timestamp: '2026-02-07', report: mockReport('2026-02-07T10:00:00.000Z') },
    ]);
    const drift404 = await fetch(`${http.baseUrl}/api/drift?days=2`);
    expect(drift404.status).toBe(404);

    loadHistoryMock.mockResolvedValueOnce([
      { timestamp: '2026-02-07', report: mockReport('2026-02-07T10:00:00.000Z') },
      { timestamp: '2026-02-06', report: mockReport('2026-02-06T10:00:00.000Z') },
    ]);
    detectDriftMock.mockResolvedValueOnce({ changed: true });
    const drift200 = await fetch(`${http.baseUrl}/api/drift?days=2`);
    expect(drift200.status).toBe(200);

    loadHistoryMock.mockResolvedValueOnce([
      { timestamp: '2026-02-07', report: mockReport('2026-02-07T10:00:00.000Z') },
    ]);
    const trend404 = await fetch(`${http.baseUrl}/api/trend?days=2`);
    expect(trend404.status).toBe(404);

    loadHistoryMock.mockResolvedValueOnce([
      { timestamp: '2026-02-07', report: mockReport('2026-02-07T10:00:00.000Z') },
      { timestamp: '2026-02-06', report: mockReport('2026-02-06T10:00:00.000Z') },
    ]);
    analyzeTrendMock.mockResolvedValueOnce({ trend: 'stable' });
    const trend200 = await fetch(`${http.baseUrl}/api/trend?days=2`);
    expect(trend200.status).toBe(200);

    await http.close();
  });

  it('serves health endpoint with cache metadata', async () => {
    await dashboard.start();
    const http = await startHttpServer(dashboard.getApp());
    const response = await fetch(`${http.baseUrl}/api/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.project).toBe('specbridge');
    expect(body.cache.loaded).toBe(true);
    expect(typeof body.cache.nextRefresh).toBe('number');
    await http.close();
  });

  it('starts background refresh and clears interval on stop', async () => {
    vi.useFakeTimers();
    await dashboard.start();
    expect(generateReportMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60000);
    expect(generateReportMock).toHaveBeenCalledTimes(2);

    dashboard.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(generateReportMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
