/**
 * Console output format for reports
 */
import chalk from 'chalk';
import { table } from 'table';
import type { ComplianceReport } from '../../core/types/index.js';

/**
 * Format report for console output
 */
export function formatConsoleReport(report: ComplianceReport): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold.blue('SpecBridge Compliance Report'));
  lines.push(chalk.dim(`Generated: ${new Date(report.timestamp).toLocaleString()}`));
  lines.push(chalk.dim(`Project: ${report.project}`));
  lines.push('');

  // Overall compliance
  const complianceColor = getComplianceColor(report.summary.compliance);
  lines.push(chalk.bold('Overall Compliance'));
  lines.push(`  ${complianceColor(formatComplianceBar(report.summary.compliance))} ${complianceColor(`${report.summary.compliance}%`)}`);
  lines.push('');

  // Summary stats
  lines.push(chalk.bold('Summary'));
  lines.push(`  Decisions: ${report.summary.activeDecisions} active / ${report.summary.totalDecisions} total`);
  lines.push(`  Constraints: ${report.summary.totalConstraints}`);
  lines.push('');

  // Violations
  lines.push(chalk.bold('Violations'));
  const { violations } = report.summary;
  const violationParts: string[] = [];

  if (violations.critical > 0) {
    violationParts.push(chalk.red(`${violations.critical} critical`));
  }
  if (violations.high > 0) {
    violationParts.push(chalk.yellow(`${violations.high} high`));
  }
  if (violations.medium > 0) {
    violationParts.push(chalk.cyan(`${violations.medium} medium`));
  }
  if (violations.low > 0) {
    violationParts.push(chalk.dim(`${violations.low} low`));
  }

  if (violationParts.length > 0) {
    lines.push(`  ${violationParts.join(' | ')}`);
  } else {
    lines.push(chalk.green('  No violations'));
  }
  lines.push('');

  // Per-decision breakdown
  if (report.byDecision.length > 0) {
    lines.push(chalk.bold('By Decision'));
    lines.push('');

    const tableData: string[][] = [
      [
        chalk.bold('Decision'),
        chalk.bold('Status'),
        chalk.bold('Constraints'),
        chalk.bold('Violations'),
        chalk.bold('Compliance'),
      ],
    ];

    for (const dec of report.byDecision) {
      const compColor = getComplianceColor(dec.compliance);
      const statusColor = getStatusColor(dec.status);

      tableData.push([
        truncate(dec.title, 40),
        statusColor(dec.status),
        String(dec.constraints),
        dec.violations > 0 ? chalk.red(String(dec.violations)) : chalk.green('0'),
        compColor(`${dec.compliance}%`),
      ]);
    }

    const tableOutput = table(tableData, {
      border: {
        topBody: '',
        topJoin: '',
        topLeft: '',
        topRight: '',
        bottomBody: '',
        bottomJoin: '',
        bottomLeft: '',
        bottomRight: '',
        bodyLeft: '  ',
        bodyRight: '',
        bodyJoin: '  ',
        joinBody: '',
        joinLeft: '',
        joinRight: '',
        joinJoin: '',
      },
      drawHorizontalLine: (index) => index === 1,
    });

    lines.push(tableOutput);
  }

  return lines.join('\n');
}

function formatComplianceBar(compliance: number): string {
  const filled = Math.round(compliance / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getComplianceColor(compliance: number): (text: string) => string {
  if (compliance >= 90) return chalk.green;
  if (compliance >= 70) return chalk.yellow;
  if (compliance >= 50) return chalk.hex('#FFA500');
  return chalk.red;
}

function getStatusColor(status: string): (text: string) => string {
  switch (status) {
    case 'active':
      return chalk.green;
    case 'draft':
      return chalk.yellow;
    case 'deprecated':
      return chalk.gray;
    case 'superseded':
      return chalk.blue;
    default:
      return chalk.white;
  }
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length - 3) + '...';
}
