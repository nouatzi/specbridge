# SpecBridge API Reference

Complete API reference for SpecBridge Phase 4 Analytics features.

## Table of Contents

- [TypeScript/JavaScript API](#typescript-javascript-api)
  - [Core Exports](#core-exports)
  - [Report Storage](#report-storage)
  - [Drift Detection](#drift-detection)
  - [Analytics Engine](#analytics-engine)
  - [Dashboard Server](#dashboard-server)
- [REST API](#rest-api)
  - [Endpoints](#endpoints)
  - [Authentication](#authentication)
  - [Error Handling](#error-handling)
- [CLI API](#cli-api)

---

## TypeScript/JavaScript API

### Core Exports

SpecBridge now re-exports core platform modules from the package root:

```typescript
import {
  AnalyticsEngine,
  createDashboardServer,
  DashboardServer,
  startLspServer,
  SpecBridgeMcpServer,
} from '@ipation/specbridge';
```

These exports are intended for embedding SpecBridge capabilities into custom tools and services.

### Report Storage

#### `ReportStorage`

Manages historical compliance reports.

```typescript
import { ReportStorage } from '@ipation/specbridge';

const storage = new ReportStorage(basePath: string);
```

**Methods:**

##### `save(report: ComplianceReport): Promise<string>`

Save a compliance report to history.

```typescript
const filePath = await storage.save(report);
// Returns: ".specbridge/reports/history/report-2024-02-03.json"
```

##### `loadLatest(): Promise<StoredReport | null>`

Load the most recent report.

```typescript
const latest = await storage.loadLatest();
if (latest) {
  console.log(`Latest: ${latest.timestamp}`);
  console.log(`Compliance: ${latest.report.summary.compliance}%`);
}
```

##### `loadHistory(days?: number): Promise<StoredReport[]>`

Load historical reports.

```typescript
// Load last 30 days (default)
const history = await storage.loadHistory();

// Load last 7 days
const week = await storage.loadHistory(7);

// Process history
history.forEach(({ timestamp, report }) => {
  console.log(`${timestamp}: ${report.summary.compliance}%`);
});
```

##### `loadByDate(date: string): Promise<ComplianceReport | null>`

Load a specific report by date.

```typescript
const report = await storage.loadByDate('2024-02-03');
if (report) {
  console.log(`Compliance: ${report.summary.compliance}%`);
}
```

##### `getAvailableDates(): Promise<string[]>`

Get all available report dates.

```typescript
const dates = await storage.getAvailableDates();
// Returns: ["2024-02-03", "2024-02-02", "2024-02-01"]
```

##### `cleanup(keepDays?: number): Promise<number>`

Delete old reports.

```typescript
// Keep only last 30 days
const deleted = await storage.cleanup(30);
console.log(`Deleted ${deleted} old reports`);
```

**Types:**

```typescript
interface StoredReport {
  timestamp: string;
  report: ComplianceReport;
}
```

---

### Drift Detection

#### `detectDrift(current: ComplianceReport, previous: ComplianceReport): Promise<OverallDrift>`

Analyze compliance drift between two reports.

```typescript
import { detectDrift } from '@ipation/specbridge';

const drift = await detectDrift(currentReport, previousReport);

console.log(`Trend: ${drift.trend}`);
console.log(`Change: ${drift.complianceChange}%`);
console.log(`New violations: ${drift.summary.newViolations.total}`);
console.log(`Fixed violations: ${drift.summary.fixedViolations.total}`);

// Most improved decisions
drift.mostImproved.forEach(d => {
  console.log(`✅ ${d.title}: ${d.previousCompliance}% → ${d.currentCompliance}%`);
});

// Most degraded decisions
drift.mostDegraded.forEach(d => {
  console.log(`⚠️ ${d.title}: ${d.previousCompliance}% → ${d.currentCompliance}%`);
});
```

**Return Type:**

```typescript
interface OverallDrift {
  trend: 'improving' | 'stable' | 'degrading';
  complianceChange: number;
  summary: {
    newViolations: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
    fixedViolations: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
  };
  byDecision: DriftAnalysis[];
  mostImproved: DriftAnalysis[];
  mostDegraded: DriftAnalysis[];
}

interface DriftAnalysis {
  decisionId: string;
  title: string;
  trend: 'improving' | 'stable' | 'degrading';
  complianceChange: number;
  newViolations: number;
  fixedViolations: number;
  currentCompliance: number;
  previousCompliance: number;
}
```

#### `analyzeTrend(reports: StoredReport[]): Promise<TrendAnalysis>`

Analyze compliance trends over multiple reports.

```typescript
import { analyzeTrend } from '@ipation/specbridge';

const storage = new ReportStorage(cwd);
const history = await storage.loadHistory(30);
const trend = await analyzeTrend(history);

console.log(`Period: ${trend.period.start} to ${trend.period.end}`);
console.log(`Overall: ${trend.overall.startCompliance}% → ${trend.overall.endCompliance}%`);
console.log(`Trend: ${trend.overall.trend}`);

// Chart the trend
trend.overall.dataPoints.forEach(({ date, compliance }) => {
  console.log(`${date}: ${compliance}%`);
});

// Per-decision trends
trend.decisions.forEach(d => {
  console.log(`${d.title}: ${d.trend} (${d.change > 0 ? '+' : ''}${d.change}%)`);
});
```

**Return Type:**

```typescript
interface TrendAnalysis {
  period: {
    start: string;
    end: string;
    days: number;
  };
  overall: {
    startCompliance: number;
    endCompliance: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
    dataPoints: Array<{
      date: string;
      compliance: number;
    }>;
  };
  decisions: Array<{
    decisionId: string;
    title: string;
    startCompliance: number;
    endCompliance: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
    dataPoints: Array<{
      date: string;
      compliance: number;
    }>;
  }>;
}
```

---

### Analytics Engine

#### `AnalyticsEngine`

Generate insights from historical data.

```typescript
import { AnalyticsEngine } from '@ipation/specbridge';

const engine = new AnalyticsEngine();
```

**Methods:**

##### `analyzeDecision(decisionId: string, history: StoredReport[]): Promise<DecisionMetrics>`

Analyze a specific decision.

```typescript
const storage = new ReportStorage(cwd);
const history = await storage.loadHistory(90);

const metrics = await engine.analyzeDecision('auth-001', history);

console.log(`Decision: ${metrics.title}`);
console.log(`Average compliance: ${metrics.averageComplianceScore}%`);
console.log(`Trend: ${metrics.trendDirection}`);
console.log(`Current violations: ${metrics.totalViolations}`);

// Historical data
metrics.history.forEach(({ date, compliance, violations }) => {
  console.log(`${date}: ${compliance}% (${violations} violations)`);
});
```

**Return Type:**

```typescript
interface DecisionMetrics {
  decisionId: string;
  title: string;
  totalViolations: number;
  violationsByFile: Map<string, number>;
  violationsBySeverity: Record<Severity, number>;
  mostViolatedConstraint: {
    id: string;
    count: number;
  } | null;
  averageComplianceScore: number;
  trendDirection: 'up' | 'down' | 'stable';
  history: Array<{
    date: string;
    compliance: number;
    violations: number;
  }>;
}
```

##### `generateInsights(history: StoredReport[]): Promise<Insight[]>`

Generate automated insights.

```typescript
const insights = await engine.generateInsights(history);

// Group by type
const warnings = insights.filter(i => i.type === 'warning');
const successes = insights.filter(i => i.type === 'success');
const suggestions = insights.filter(i => i.type === 'info');

warnings.forEach(i => {
  console.log(`⚠️ ${i.message}`);
  if (i.details) console.log(`   ${i.details}`);
});
```

**Return Type:**

```typescript
interface Insight {
  type: 'warning' | 'info' | 'success';
  category: 'compliance' | 'trend' | 'hotspot' | 'suggestion';
  message: string;
  details?: string;
  decisionId?: string;
}
```

##### `generateSummary(history: StoredReport[]): Promise<AnalyticsSummary>`

Generate analytics summary.

```typescript
const summary = await engine.generateSummary(history);

console.log(`Total decisions: ${summary.totalDecisions}`);
console.log(`Average compliance: ${summary.averageCompliance}%`);
console.log(`Overall trend: ${summary.overallTrend}`);
console.log(`Critical issues: ${summary.criticalIssues}`);

// Top performers
summary.topDecisions.forEach(d => {
  console.log(`✅ ${d.title}: ${d.compliance}%`);
});

// Bottom performers
summary.bottomDecisions.forEach(d => {
  console.log(`⚠️ ${d.title}: ${d.compliance}%`);
});

// Insights
summary.insights.forEach(i => {
  console.log(`${i.type === 'warning' ? '⚠️' : '💡'} ${i.message}`);
});
```

**Return Type:**

```typescript
interface AnalyticsSummary {
  totalDecisions: number;
  averageCompliance: number;
  overallTrend: 'up' | 'down' | 'stable';
  criticalIssues: number;
  topDecisions: Array<{
    decisionId: string;
    title: string;
    compliance: number;
  }>;
  bottomDecisions: Array<{
    decisionId: string;
    title: string;
    compliance: number;
  }>;
  insights: Insight[];
}
```

---

### Dashboard Server

#### `createDashboardServer(options: DashboardOptions): Application`

Create Express dashboard server.

```typescript
import { createDashboardServer } from '@ipation/specbridge';
import { loadConfig } from '@ipation/specbridge';

const config = await loadConfig(process.cwd());
const app = createDashboardServer({
  cwd: process.cwd(),
  config
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
```

**Options:**

```typescript
interface DashboardOptions {
  cwd: string;
  config: SpecBridgeConfig;
}
```

**Returns:** Express `Application` instance

The returned app is a fully configured Express server with:
- CORS middleware
- JSON body parser
- All API endpoints registered
- Static file serving
- Error handling

---

## REST API

Base URL: `http://localhost:3000/api`

### Endpoints

#### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-02-03T10:30:00.000Z",
  "project": "my-project"
}
```

#### Latest Report

```http
GET /api/report/latest
```

**Response:** `ComplianceReport` object

**Example:**
```bash
curl http://localhost:3000/api/report/latest | jq '.summary'
```

#### Historical Reports

```http
GET /api/report/history?days=30
```

**Query Parameters:**
- `days` (optional, default: 30): Number of days to retrieve

**Response:**
```json
[
  {
    "timestamp": "2024-02-03",
    "report": { /* ComplianceReport */ }
  }
]
```

**Example:**
```bash
curl 'http://localhost:3000/api/report/history?days=7' | jq
```

#### Available Dates

```http
GET /api/report/dates
```

**Response:**
```json
["2024-02-03", "2024-02-02", "2024-02-01"]
```

#### Report by Date

```http
GET /api/report/:date
```

**Example:**
```bash
curl http://localhost:3000/api/report/2024-02-03 | jq
```

**Response:** `ComplianceReport` object or 404

#### All Decisions

```http
GET /api/decisions
```

**Response:** Array of `Decision` objects

#### Decision by ID

```http
GET /api/decisions/:id
```

**Example:**
```bash
curl http://localhost:3000/api/decisions/auth-001 | jq
```

**Response:** `Decision` object or 404

#### Analytics Summary

```http
GET /api/analytics/summary?days=90
```

**Query Parameters:**
- `days` (optional, default: 90): Analysis period

**Response:** `AnalyticsSummary` object

**Example:**
```bash
curl 'http://localhost:3000/api/analytics/summary?days=30' | jq '.overallTrend'
```

#### Decision Analytics

```http
GET /api/analytics/decision/:id?days=90
```

**Query Parameters:**
- `days` (optional, default: 90): Analysis period

**Response:** `DecisionMetrics` object

**Example:**
```bash
curl 'http://localhost:3000/api/analytics/decision/auth-001?days=30' | jq
```

#### Drift Analysis

```http
GET /api/drift?days=2
```

**Query Parameters:**
- `days` (optional, default: 2): Number of reports to compare

**Response:** `OverallDrift` object

**Example:**
```bash
curl http://localhost:3000/api/drift | jq '.trend'
```

#### Trend Analysis

```http
GET /api/trend?days=30
```

**Query Parameters:**
- `days` (optional, default: 30): Analysis period

**Response:** `TrendAnalysis` object

**Example:**
```bash
curl 'http://localhost:3000/api/trend?days=7' | jq '.overall'
```

### Authentication

The default dashboard server does not include authentication. For production use:

```typescript
import { createDashboardServer } from '@ipation/specbridge';

const app = createDashboardServer(options);

// Add authentication middleware
app.use('/api', (req, res, next) => {
  const token = req.headers.authorization;
  if (validateToken(token)) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.listen(3000);
```

### Error Handling

All endpoints return consistent error format:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

**HTTP Status Codes:**
- `200` - Success
- `404` - Resource not found
- `500` - Server error

**Example Error:**
```json
{
  "error": "Failed to load history",
  "message": "No reports found in storage directory"
}
```

---

## CLI API

### `specbridge report`

```bash
specbridge report [options]
```

**Options:**
- `-f, --format <format>` - Output format (console, json, markdown)
- `-o, --output <file>` - Output file path
- `--save` - Save to .specbridge/reports/
- `-a, --all` - Include all decisions
- `--trend` - Show compliance trend
- `--drift` - Analyze drift
- `--days <n>` - Days for trend analysis (default: 30)

**Examples:**
```bash
specbridge report
specbridge report --trend --days 7
specbridge report --drift
specbridge report --format json -o report.json
```

### `specbridge analytics`

```bash
specbridge analytics [decision-id] [options]
```

**Options:**
- `--insights` - Show AI-generated insights
- `--days <n>` - Analysis period (default: 90)
- `-f, --format <format>` - Output format (console, json)

**Examples:**
```bash
specbridge analytics
specbridge analytics --insights
specbridge analytics auth-001
specbridge analytics --format json
```

### `specbridge dashboard`

```bash
specbridge dashboard [options]
```

**Options:**
- `-p, --port <port>` - Port to listen on (default: 3000)
- `-h, --host <host>` - Host to bind to (default: localhost)

**Examples:**
```bash
specbridge dashboard
specbridge dashboard --port 8080
specbridge dashboard --host 0.0.0.0
```

---

## Integration Examples

### Node.js Script

```javascript
import { ReportStorage, AnalyticsEngine, detectDrift } from '@ipation/specbridge';

async function analyzeCompliance() {
  const storage = new ReportStorage(process.cwd());
  const engine = new AnalyticsEngine();

  // Load history
  const history = await storage.loadHistory(30);

  if (history.length < 2) {
    console.log('Not enough data');
    return;
  }

  // Analyze drift
  const [current, previous] = history;
  const drift = await detectDrift(current.report, previous.report);

  console.log(`Trend: ${drift.trend}`);
  console.log(`Change: ${drift.complianceChange}%`);

  // Get insights
  const summary = await engine.generateSummary(history);

  summary.insights.forEach(insight => {
    console.log(`${insight.type}: ${insight.message}`);
  });
}

analyzeCompliance().catch(console.error);
```

### Monitoring Integration

```javascript
import fetch from 'node-fetch';

async function checkCompliance() {
  const response = await fetch('http://localhost:3000/api/report/latest');
  const report = await response.json();

  // Send to monitoring service
  await sendMetric('compliance.score', report.summary.compliance);
  await sendMetric('compliance.critical_violations', report.summary.violations.critical);

  // Alert on critical issues
  if (report.summary.violations.critical > 0) {
    await sendAlert('Critical compliance violations detected');
  }
}

setInterval(checkCompliance, 60000); // Every minute
```

---

## Type Definitions

All TypeScript types are exported from the main package:

```typescript
import type {
  ComplianceReport,
  DecisionCompliance,
  StoredReport,
  DriftAnalysis,
  OverallDrift,
  TrendAnalysis,
  DecisionMetrics,
  Insight,
  AnalyticsSummary,
  SpecBridgeConfig,
  Severity,
} from '@ipation/specbridge';
```

---

*Last updated: February 2024*
