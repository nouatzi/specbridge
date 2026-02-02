/**
 * Tests for ReportStorage
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { ReportStorage } from '../../../src/reporting/storage.js';
import type { ComplianceReport } from '../../../src/core/types/index.js';

describe('ReportStorage', () => {
  let tempDir: string;
  let storage: ReportStorage;

  // Helper to create a mock report
  function createMockReport(timestamp: string, compliance: number = 85): ComplianceReport {
    return {
      timestamp,
      project: 'test-project',
      summary: {
        totalDecisions: 5,
        activeDecisions: 4,
        totalConstraints: 20,
        violations: {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        },
        compliance,
      },
      byDecision: [
        {
          decisionId: 'dec-001',
          title: 'Test Decision 1',
          status: 'active',
          constraints: 5,
          violations: 2,
          compliance: 90,
        },
        {
          decisionId: 'dec-002',
          title: 'Test Decision 2',
          status: 'active',
          constraints: 5,
          violations: 4,
          compliance: 80,
        },
      ],
    };
  }

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specbridge-test-'));
    storage = new ReportStorage(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('save', () => {
    it('should save a report to storage', async () => {
      const report = createMockReport('2024-02-01T10:00:00.000Z');
      const filepath = await storage.save(report);

      expect(filepath).toContain('report-2024-02-01.json');
      expect(filepath).toContain('.specbridge/reports/history');
    });

    it('should create storage directory if it does not exist', async () => {
      const report = createMockReport('2024-02-01T10:00:00.000Z');
      await storage.save(report);

      // Should not throw, directory should be created
      const dates = await storage.getAvailableDates();
      expect(dates).toContain('2024-02-01');
    });

    it('should overwrite existing report for the same date', async () => {
      const report1 = createMockReport('2024-02-01T10:00:00.000Z', 80);
      const report2 = createMockReport('2024-02-01T15:00:00.000Z', 90);

      await storage.save(report1);
      await storage.save(report2);

      const loaded = await storage.loadByDate('2024-02-01');
      expect(loaded?.summary.compliance).toBe(90);
    });
  });

  describe('loadLatest', () => {
    it('should return null when no reports exist', async () => {
      const latest = await storage.loadLatest();
      expect(latest).toBeNull();
    });

    it('should load the most recent report', async () => {
      await storage.save(createMockReport('2024-02-01T10:00:00.000Z', 80));
      await storage.save(createMockReport('2024-02-02T10:00:00.000Z', 85));
      await storage.save(createMockReport('2024-02-03T10:00:00.000Z', 90));

      const latest = await storage.loadLatest();

      expect(latest).not.toBeNull();
      expect(latest?.timestamp).toBe('2024-02-03');
      expect(latest?.report.summary.compliance).toBe(90);
    });
  });

  describe('loadHistory', () => {
    it('should return empty array when no reports exist', async () => {
      const history = await storage.loadHistory(30);
      expect(history).toEqual([]);
    });

    it('should load historical reports', async () => {
      await storage.save(createMockReport('2024-02-01T10:00:00.000Z'));
      await storage.save(createMockReport('2024-02-02T10:00:00.000Z'));
      await storage.save(createMockReport('2024-02-03T10:00:00.000Z'));

      const history = await storage.loadHistory(30);

      expect(history).toHaveLength(3);
      expect(history[0].timestamp).toBe('2024-02-03'); // Most recent first
      expect(history[2].timestamp).toBe('2024-02-01'); // Oldest last
    });

    it('should limit history to specified number of days', async () => {
      await storage.save(createMockReport('2024-02-01T10:00:00.000Z'));
      await storage.save(createMockReport('2024-02-02T10:00:00.000Z'));
      await storage.save(createMockReport('2024-02-03T10:00:00.000Z'));
      await storage.save(createMockReport('2024-02-04T10:00:00.000Z'));
      await storage.save(createMockReport('2024-02-05T10:00:00.000Z'));

      const history = await storage.loadHistory(3);

      expect(history).toHaveLength(3);
      expect(history[0].timestamp).toBe('2024-02-05');
      expect(history[2].timestamp).toBe('2024-02-03');
    });

    it('should skip corrupted report files', async () => {
      const fs = await import('node:fs/promises');
      const storageDir = join(tempDir, '.specbridge', 'reports', 'history');
      await fs.mkdir(storageDir, { recursive: true });

      // Create a corrupted file
      await fs.writeFile(join(storageDir, 'report-2024-02-01.json'), 'invalid json');

      // Create valid files
      await storage.save(createMockReport('2024-02-02T10:00:00.000Z'));

      const history = await storage.loadHistory(30);

      expect(history).toHaveLength(1);
      expect(history[0].timestamp).toBe('2024-02-02');
    });
  });

  describe('loadByDate', () => {
    it('should return null for non-existent date', async () => {
      const report = await storage.loadByDate('2024-02-01');
      expect(report).toBeNull();
    });

    it('should load a specific report by date', async () => {
      await storage.save(createMockReport('2024-02-01T10:00:00.000Z', 80));
      await storage.save(createMockReport('2024-02-02T10:00:00.000Z', 90));

      const report = await storage.loadByDate('2024-02-01');

      expect(report).not.toBeNull();
      expect(report?.summary.compliance).toBe(80);
    });
  });

  describe('getAvailableDates', () => {
    it('should return empty array when no reports exist', async () => {
      const dates = await storage.getAvailableDates();
      expect(dates).toEqual([]);
    });

    it('should return all available dates in descending order', async () => {
      await storage.save(createMockReport('2024-02-01T10:00:00.000Z'));
      await storage.save(createMockReport('2024-02-03T10:00:00.000Z'));
      await storage.save(createMockReport('2024-02-02T10:00:00.000Z'));

      const dates = await storage.getAvailableDates();

      expect(dates).toEqual(['2024-02-03', '2024-02-02', '2024-02-01']);
    });
  });

  describe('cleanup', () => {
    it('should return 0 when no reports exist', async () => {
      const deleted = await storage.cleanup(90);
      expect(deleted).toBe(0);
    });

    it('should keep only the most recent N days', async () => {
      await storage.save(createMockReport('2024-01-01T10:00:00.000Z'));
      await storage.save(createMockReport('2024-01-02T10:00:00.000Z'));
      await storage.save(createMockReport('2024-01-03T10:00:00.000Z'));
      await storage.save(createMockReport('2024-01-04T10:00:00.000Z'));
      await storage.save(createMockReport('2024-01-05T10:00:00.000Z'));

      const deleted = await storage.cleanup(3);

      expect(deleted).toBe(2);

      const remaining = await storage.getAvailableDates();
      expect(remaining).toHaveLength(3);
      expect(remaining).toEqual(['2024-01-05', '2024-01-04', '2024-01-03']);
    });

    it('should not delete anything if all reports are within keep period', async () => {
      await storage.save(createMockReport('2024-01-01T10:00:00.000Z'));
      await storage.save(createMockReport('2024-01-02T10:00:00.000Z'));

      const deleted = await storage.cleanup(90);

      expect(deleted).toBe(0);

      const remaining = await storage.getAvailableDates();
      expect(remaining).toHaveLength(2);
    });
  });
});
