/**
 * Report storage - Save and load historical compliance reports
 */
import { join } from 'node:path';
import type { ComplianceReport } from '../core/types/index.js';
import {
  ensureDir,
  writeTextFile,
  readTextFile,
  readFilesInDir,
  pathExists,
  getSpecBridgeDir,
} from '../utils/fs.js';
import { getLogger } from '../utils/logger.js';

export interface StoredReport {
  timestamp: string;
  report: ComplianceReport;
}

/**
 * ReportStorage - Handles persistence and retrieval of historical reports
 */
export class ReportStorage {
  private storageDir: string;
  private logger = getLogger({ module: 'reporting.storage' });

  constructor(basePath: string) {
    this.storageDir = join(getSpecBridgeDir(basePath), 'reports', 'history');
  }

  /**
   * Save a compliance report to storage
   */
  async save(report: ComplianceReport): Promise<string> {
    await ensureDir(this.storageDir);

    // Use date as filename (one report per day, overwrites if exists)
    const date = new Date(report.timestamp).toISOString().split('T')[0];
    const filename = `report-${date}.json`;
    const filepath = join(this.storageDir, filename);

    await writeTextFile(filepath, JSON.stringify(report, null, 2));

    return filepath;
  }

  /**
   * Load the most recent report
   */
  async loadLatest(): Promise<StoredReport | null> {
    if (!(await pathExists(this.storageDir))) {
      return null;
    }

    const files = await readFilesInDir(this.storageDir);
    if (files.length === 0) {
      return null;
    }

    // Sort files by date (descending)
    const sortedFiles = files
      .filter((f) => f.startsWith('report-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (sortedFiles.length === 0) {
      return null;
    }

    const latestFile = sortedFiles[0];
    if (!latestFile) {
      return null;
    }

    const content = await readTextFile(join(this.storageDir, latestFile));
    const report = JSON.parse(content) as ComplianceReport;

    return {
      timestamp: latestFile.replace('report-', '').replace('.json', ''),
      report,
    };
  }

  /**
   * Load historical reports for the specified number of days
   * Uses parallel I/O for better performance
   */
  async loadHistory(days: number = 30): Promise<StoredReport[]> {
    if (!(await pathExists(this.storageDir))) {
      return [];
    }

    const files = await readFilesInDir(this.storageDir);

    // Filter report files and sort by date
    const reportFiles = files
      .filter((f) => f.startsWith('report-') && f.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first

    // Take only the requested number of days
    const recentFiles = reportFiles.slice(0, days);

    // Load all reports in parallel
    const reportPromises = recentFiles.map(async (file) => {
      try {
        const content = await readTextFile(join(this.storageDir, file));
        const report = JSON.parse(content) as ComplianceReport;
        const timestamp = file.replace('report-', '').replace('.json', '');

        return { timestamp, report } as StoredReport;
      } catch (error) {
        // Skip corrupted files
        this.logger.warn({ file, error }, 'Failed to load report file');
        return null;
      }
    });

    const results = await Promise.all(reportPromises);

    // Filter out null results from failed loads
    return results.filter((r): r is StoredReport => r !== null);
  }

  /**
   * Load a specific report by date
   */
  async loadByDate(date: string): Promise<ComplianceReport | null> {
    const filepath = join(this.storageDir, `report-${date}.json`);

    if (!(await pathExists(filepath))) {
      return null;
    }

    const content = await readTextFile(filepath);
    return JSON.parse(content) as ComplianceReport;
  }

  /**
   * Get all available report dates
   */
  async getAvailableDates(): Promise<string[]> {
    if (!(await pathExists(this.storageDir))) {
      return [];
    }

    const files = await readFilesInDir(this.storageDir);

    return files
      .filter((f) => f.startsWith('report-') && f.endsWith('.json'))
      .map((f) => f.replace('report-', '').replace('.json', ''))
      .sort()
      .reverse();
  }

  /**
   * Clear old reports (keep only the most recent N days)
   */
  async cleanup(keepDays: number = 90): Promise<number> {
    if (!(await pathExists(this.storageDir))) {
      return 0;
    }

    const files = await readFilesInDir(this.storageDir);
    const reportFiles = files
      .filter((f) => f.startsWith('report-') && f.endsWith('.json'))
      .sort()
      .reverse();

    // Delete files beyond the keep limit
    const filesToDelete = reportFiles.slice(keepDays);

    for (const file of filesToDelete) {
      try {
        const filepath = join(this.storageDir, file);
        const fs = await import('node:fs/promises');
        await fs.unlink(filepath);
      } catch (error) {
        this.logger.warn({ file, error }, 'Failed to delete old report file');
      }
    }

    return filesToDelete.length;
  }
}
