# Analytics & Insights

Analytics & Insights adds powerful capabilities to SpecBridge, providing visibility into compliance trends, decision impact, and architectural drift over time.

## Overview

The Analytics & Insights system consists of four main components:

1. **Report Storage** - Historical persistence of compliance reports
2. **Drift Detection** - Track changes between reports
3. **Analytics Engine** - Generate insights and metrics
4. **Web Dashboard** - Visual monitoring interface

## Table of Contents

- [Report Storage](#report-storage)
- [Drift Detection](#drift-detection)
- [Trend Analysis](#trend-analysis)
- [Analytics Engine](#analytics-engine)
- [CLI Commands](#cli-commands)
- [Web Dashboard](#web-dashboard)
- [REST API](#rest-api)
- [Use Cases](#use-cases)

---

## Report Storage

### Overview

Every compliance report is automatically saved to `.specbridge/reports/history/` for historical analysis.

### Storage Format

```
.specbridge/
└── reports/
    └── history/
        ├── report-2024-02-01.json
        ├── report-2024-02-02.json
        └── report-2024-02-03.json
```

**File naming:** `report-YYYY-MM-DD.json`
- One report per day
- Newer reports overwrite same-day reports
- JSON format for programmatic access

### Report Structure

```json
{
  "timestamp": "2024-02-03T10:30:00.000Z",
  "project": "my-project",
  "summary": {
    "totalDecisions": 5,
    "activeDecisions": 4,
    "totalConstraints": 20,
    "violations": {
      "critical": 0,
      "high": 2,
      "medium": 5,
      "low": 8
    },
    "compliance": 87
  },
  "byDecision": [
    {
      "decisionId": "auth-001",
      "title": "Authentication Strategy",
      "status": "active",
      "constraints": 5,
      "violations": 2,
      "compliance": 90
    }
  ]
}
```

### Automatic Cleanup

By default, reports older than 90 days are retained. Configure retention:

```typescript
import { ReportStorage } from '@ipation/specbridge';

const storage = new ReportStorage(process.cwd());

// Keep only last 30 days
await storage.cleanup(30);
```

### Manual Access

```bash
# View stored reports
ls .specbridge/reports/history/

# View specific report
cat .specbridge/reports/history/report-2024-02-03.json | jq

# Count historical reports
ls .specbridge/reports/history/ | wc -l
```

---

## Drift Detection

### Overview

Drift detection compares two compliance reports to identify:
- Compliance score changes
- New vs. fixed violations
- Decision-level improvements or degradations
- Severity distribution changes

### Usage

```bash
# Compare with previous report
specbridge report --drift

# Output format
Comparing: 2024-02-02 vs 2024-02-03
Compliance Change: +5.0%
📈 Overall Trend: IMPROVING
```

### Drift Analysis Output

```typescript
interface DriftAnalysis {
  trend: 'improving' | 'stable' | 'degrading';
  complianceChange: number;        // Percentage points
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
  byDecision: DriftAnalysis[];      // Per-decision drift
  mostImproved: DriftAnalysis[];    // Top 5 improvements
  mostDegraded: DriftAnalysis[];    // Top 5 regressions
}
```

### Trend Classification

- **Improving**: Compliance increased by >5%
- **Degrading**: Compliance decreased by >5%
- **Stable**: Change between -5% and +5%

### Programmatic Access

```typescript
import { detectDrift } from '@ipation/specbridge';

const drift = await detectDrift(currentReport, previousReport);

console.log(`Trend: ${drift.trend}`);
console.log(`Change: ${drift.complianceChange}%`);
console.log(`New violations: ${drift.summary.newViolations.total}`);
console.log(`Fixed violations: ${drift.summary.fixedViolations.total}`);
```

---

## Trend Analysis

### Overview

Trend analysis examines compliance patterns over multiple reports to identify:
- Long-term compliance trajectory
- Seasonal patterns
- Decision-specific trends
- Overall health direction

### Usage

```bash
# Analyze last 30 days
specbridge report --trend --days 30

# Combine with drift detection
specbridge report --trend --drift --days 7
```

### Trend Analysis Output

```typescript
interface TrendAnalysis {
  period: {
    start: string;              // First report date
    end: string;                // Last report date
    days: number;               // Number of data points
  };
  overall: {
    startCompliance: number;    // Starting compliance %
    endCompliance: number;      // Ending compliance %
    change: number;             // Total change
    trend: 'up' | 'down' | 'stable';
    dataPoints: Array<{         // For charting
      date: string;
      compliance: number;
    }>;
  };
  decisions: Array<{            // Per-decision trends
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

### Visualization

Trend data includes `dataPoints` arrays suitable for charting:

```javascript
// Example with Chart.js
const trend = await analyzeTrend(history);

new Chart(ctx, {
  type: 'line',
  data: {
    labels: trend.overall.dataPoints.map(d => d.date),
    datasets: [{
      label: 'Compliance',
      data: trend.overall.dataPoints.map(d => d.compliance)
    }]
  }
});
```

---

## Analytics Engine

### Overview

The Analytics Engine generates actionable insights by analyzing historical compliance data.

### Features

1. **Decision Metrics** - Deep analysis of individual decisions
2. **Insight Generation** - Automated observations and recommendations
3. **Trend Detection** - Identify patterns over time
4. **Performance Ranking** - Top and bottom performers

### Decision Metrics

```bash
# Analyze specific decision
specbridge analytics auth-001
```

**Output:**
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

### Automated Insights

```bash
# Generate insights
specbridge analytics --insights
```

**Insight Types:**

1. **Warnings** (🟠)
   - Critical violations present
   - Compliance below thresholds
   - Degrading trends
   - Hotspot areas

2. **Successes** (🟢)
   - 100% compliance achievements
   - Significant improvements
   - Consistent high performance

3. **Suggestions** (💡)
   - Violation distribution analysis
   - Focus area recommendations
   - Optimization opportunities

**Example Insights:**
```
⚠️  Warnings:
  • 3 critical violation(s) require immediate attention
    Critical violations block deployments

  • Compliance has dropped by 12.0% over the past 7 days
    From 92% to 80%

✅ Positive Trends:
  • 2 decision(s) have 100% compliance
    Authentication Strategy, API Standards

💡 Suggestions:
  • Most violations are high severity
    80% critical/high. Prioritize these for maximum impact.
```

### Analytics Summary

```bash
# Overall summary
specbridge analytics
```

**Output:**
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

## CLI Commands

### `specbridge report`

Enhanced with trend and drift analysis.

**Options:**
```bash
-f, --format <format>   Output format (console, json, markdown)
-o, --output <file>     Output file path
--save                  Save to .specbridge/reports/
-a, --all               Include all decisions (not just active)
--trend                 Show compliance trend over time
--drift                 Analyze drift since last report
--days <n>              Number of days for trend analysis (default: 30)
```

**Examples:**
```bash
# Basic report
specbridge report

# Report with 7-day trend
specbridge report --trend --days 7

# Drift analysis
specbridge report --drift

# Combined analysis
specbridge report --trend --drift --days 30

# Save markdown report
specbridge report --format markdown --output weekly-report.md
```

### `specbridge analytics`

Analyze compliance trends and decision impact.

**Syntax:**
```bash
specbridge analytics [decision-id] [options]
```

**Options:**
```bash
--insights              Show AI-generated insights
--days <n>              Number of days of history (default: 90)
-f, --format <format>   Output format (console, json)
```

**Examples:**
```bash
# Overall analytics with insights
specbridge analytics --insights

# Analyze specific decision
specbridge analytics auth-001

# Last 30 days only
specbridge analytics --days 30

# JSON output for scripting
specbridge analytics --format json > analytics.json

# Per-decision JSON
specbridge analytics auth-001 --format json
```

### `specbridge dashboard`

Start the compliance dashboard web server.

**Options:**
```bash
-p, --port <port>       Port to listen on (default: 3000)
-h, --host <host>       Host to bind to (default: localhost)
```

**Examples:**
```bash
# Start on default port
specbridge dashboard

# Custom port
specbridge dashboard --port 8080

# Bind to all interfaces
specbridge dashboard --host 0.0.0.0

# Custom port and host
specbridge dashboard --port 8080 --host 0.0.0.0
```

**Accessing:**
- Local: http://localhost:3000
- Network: http://your-ip:3000

**Stopping:**
- Press `Ctrl+C` in the terminal
- Server shuts down gracefully

---

## Web Dashboard

### Overview

Interactive web interface for monitoring compliance in real-time.

### Features

1. **Compliance Score Card**
   - Large, prominent compliance percentage
   - Trend indicator (📈/📉/➡️)
   - Visual status (green/yellow/red)

2. **Summary Statistics**
   - Decision counts
   - Constraint totals
   - Violation breakdown by severity

3. **Trend Visualization**
   - 30-day compliance chart
   - Interactive hover tooltips
   - Smooth trend lines

4. **Decision Breakdown**
   - Sortable table
   - Per-decision compliance
   - Violation counts
   - Status indicators

5. **Automated Insights**
   - Real-time insight display
   - Categorized by type (warning/success/info)
   - Actionable recommendations

### Technology

- **Frontend**: React (via CDN)
- **Charts**: Chart.js
- **Styling**: Custom CSS with modern design
- **Backend**: Express REST API

### Responsive Design

- Desktop optimized
- Mobile friendly
- Grid-based layout
- Adaptive cards

### Auto-Refresh

Dashboard automatically refreshes when:
- New reports are generated
- Decisions are updated
- Data changes detected

Simply run `specbridge report` in another terminal and watch the dashboard update.

---

## REST API

### Overview

The dashboard exposes a full REST API for integration with other tools.

### Base URL

```
http://localhost:3000/api
```

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

**Response:** Full `ComplianceReport` object

#### Historical Reports

```http
GET /api/report/history?days=30
```

**Query Parameters:**
- `days` (optional): Number of days to retrieve (default: 30)

**Response:**
```json
[
  {
    "timestamp": "2024-02-03",
    "report": { /* ComplianceReport */ }
  },
  {
    "timestamp": "2024-02-02",
    "report": { /* ComplianceReport */ }
  }
]
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
```http
GET /api/report/2024-02-03
```

**Response:** `ComplianceReport` object

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
```http
GET /api/decisions/auth-001
```

**Response:** Single `Decision` object

#### Analytics Summary

```http
GET /api/analytics/summary?days=90
```

**Query Parameters:**
- `days` (optional): Analysis period (default: 90)

**Response:** `AnalyticsSummary` object

#### Decision Analytics

```http
GET /api/analytics/decision/:id?days=90
```

**Example:**
```http
GET /api/analytics/decision/auth-001?days=30
```

**Response:** `DecisionMetrics` object

#### Drift Analysis

```http
GET /api/drift?days=2
```

**Query Parameters:**
- `days` (optional): Reports to compare (default: 2)

**Response:** `DriftAnalysis` object

#### Trend Analysis

```http
GET /api/trend?days=30
```

**Query Parameters:**
- `days` (optional): Analysis period (default: 30)

**Response:** `TrendAnalysis` object

### Error Handling

**Error Response Format:**
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

### CORS

The API supports CORS for development. In production, configure CORS appropriately for your security requirements.

### Examples

#### Bash/cURL

```bash
# Get latest compliance
curl http://localhost:3000/api/report/latest | jq '.summary.compliance'

# Get trend data
curl http://localhost:3000/api/trend?days=7 | jq '.overall'

# Get insights
curl http://localhost:3000/api/analytics/summary | jq '.insights'
```

#### JavaScript/Node.js

```javascript
// Fetch latest report
const response = await fetch('http://localhost:3000/api/report/latest');
const report = await response.json();
console.log(`Compliance: ${report.summary.compliance}%`);

// Get analytics
const analytics = await fetch('http://localhost:3000/api/analytics/summary?days=30');
const data = await analytics.json();
console.log(`Trend: ${data.overallTrend}`);
```

#### Python

```python
import requests

# Get drift analysis
response = requests.get('http://localhost:3000/api/drift')
drift = response.json()
print(f"Trend: {drift['trend']}")
print(f"Change: {drift['complianceChange']}%")
```

---

## Use Cases

### 1. Continuous Monitoring

**Scenario:** Track compliance daily during active development

**Implementation:**
```bash
# CI/CD pipeline (runs daily)
specbridge report --save

# Weekly team review
specbridge report --trend --drift --days 7

# Dashboard for continuous visibility
specbridge dashboard
```

**Benefits:**
- Early detection of compliance drift
- Historical record of architectural evolution
- Team awareness of current state

### 2. Release Quality Gates

**Scenario:** Ensure compliance before releases

**Implementation:**
```bash
# Pre-release check
specbridge verify --level full

# Compliance trend
specbridge report --drift

# Fail if critical issues
CRITICAL=$(specbridge analytics --format json | jq '.criticalIssues')
if [ $CRITICAL -gt 0 ]; then
  echo "Cannot release: $CRITICAL critical issues"
  exit 1
fi
```

**Benefits:**
- Prevent releases with critical violations
- Document compliance at release time
- Track compliance improvements per release

### 3. Technical Debt Tracking

**Scenario:** Measure and reduce technical debt over time

**Implementation:**
```bash
# Monthly review
specbridge analytics --insights --days 90

# Identify problem areas
specbridge analytics --format json | \
  jq '.bottomDecisions[] | select(.compliance < 70)'

# Track specific debt reduction
specbridge analytics legacy-migration-001
```

**Benefits:**
- Quantify technical debt
- Track debt reduction efforts
- Prioritize improvement areas

### 4. Stakeholder Reporting

**Scenario:** Generate executive summaries

**Implementation:**
```bash
# Generate markdown report
specbridge report --trend --days 30 \
  --format markdown \
  --output monthly-compliance.md

# Export data for custom reports
curl http://localhost:3000/api/analytics/summary | \
  jq '{compliance: .averageCompliance, trend: .overallTrend}' > executive-summary.json
```

**Benefits:**
- Professional reports for stakeholders
- Data-driven compliance metrics
- Visual evidence of improvements

### 5. Team Performance Metrics

**Scenario:** Measure team's architectural adherence

**Implementation:**
```bash
# Sprint review
specbridge report --drift

# Team dashboard
specbridge dashboard --host 0.0.0.0

# Sprint-over-sprint comparison
specbridge analytics --days 14
```

**Benefits:**
- Objective compliance metrics
- Identify training needs
- Celebrate improvements

### 6. Architectural Review Process

**Scenario:** Regular architecture review meetings

**Implementation:**
```bash
# Pre-meeting: Generate comprehensive report
specbridge report --trend --drift --days 30 > review.txt

# During meeting: Show dashboard
specbridge dashboard

# Post-meeting: Export decisions for action items
curl http://localhost:3000/api/analytics/summary | \
  jq '.bottomDecisions'
```

**Benefits:**
- Data-driven discussions
- Clear action items
- Historical context

---

## Best Practices

### 1. Regular Report Generation

✅ **DO:**
- Generate reports daily via CI/CD
- Use `--save` to ensure persistence
- Automate with cron jobs or scheduled workflows

❌ **DON'T:**
- Generate reports only when problems occur
- Forget to save reports
- Rely on manual report generation

### 2. Dashboard Usage

✅ **DO:**
- Keep dashboard running during development
- Share dashboard URL with team
- Use in standups and reviews

❌ **DON'T:**
- Use dashboard as only monitoring tool
- Forget to secure dashboard in production
- Ignore insights shown in dashboard

### 3. API Integration

✅ **DO:**
- Integrate with monitoring tools
- Set up automated alerts
- Use for custom reporting

❌ **DON'T:**
- Poll API excessively
- Ignore error handling
- Hardcode credentials

### 4. Trend Analysis

✅ **DO:**
- Analyze trends over multiple sprints/releases
- Look for patterns and correlations
- Use data to inform decisions

❌ **DON'T:**
- React to single data points
- Ignore long-term trends
- Compare incomparable periods

### 5. Insights & Actions

✅ **DO:**
- Review insights regularly
- Create action items from warnings
- Celebrate successes highlighted

❌ **DON'T:**
- Ignore repeated warnings
- Dismiss insights without investigation
- Focus only on problems

---

## Performance Considerations

### Report Storage

- **Disk Usage**: ~10-50KB per report
- **90 days**: ~1-5MB total
- **Cleanup**: Automatic with configurable retention

### Analytics Processing

- **Small projects** (<100 files): Instant
- **Medium projects** (<1000 files): <1 second
- **Large projects** (>1000 files): <5 seconds

### Dashboard Performance

- **Initial load**: <500ms
- **API requests**: <100ms each
- **Chart rendering**: <200ms
- **Auto-refresh**: Polling-based (configurable)

### Optimization Tips

1. **Limit historical data**: Use `--days` to reduce processing
2. **Cache results**: API responses are lightweight
3. **Batch operations**: Generate reports once, analyze multiple times
4. **Database storage**: For very large histories, consider external DB

---

## Troubleshooting

### Problem: No Historical Data

**Symptoms:**
```
Not enough data for trend analysis
```

**Solutions:**
1. Generate more reports: `specbridge report --save`
2. Wait for automated reports to accumulate
3. Check storage directory: `.specbridge/reports/history/`

### Problem: Dashboard Not Accessible

**Symptoms:**
- Connection refused
- Blank page
- 404 errors

**Solutions:**
1. Verify server is running: `curl http://localhost:3000/api/health`
2. Check port availability: `lsof -i :3000`
3. Try different port: `specbridge dashboard --port 8080`
4. Check firewall settings

### Problem: Inaccurate Trends

**Symptoms:**
- Unexpected trend direction
- Missing data points
- Inconsistent compliance scores

**Solutions:**
1. Verify report generation frequency
2. Check for code changes affecting decisions
3. Review decision configurations
4. Ensure consistent verification scope

### Problem: API Errors

**Symptoms:**
```json
{
  "error": "Failed to load history",
  "message": "..."
}
```

**Solutions:**
1. Check `.specbridge/` directory exists
2. Verify file permissions
3. Ensure valid JSON in report files
4. Check server logs for details

---

## Migration Guide

### Migration Notes

Analytics features are backward compatible. No migration required.

**Automatic Benefits:**
- All new `specbridge report` commands auto-save to history
- Existing reports continue to work
- No configuration changes needed

**Optional Enhancements:**
1. Start using `--trend` and `--drift` flags
2. Launch dashboard for visualization
3. Integrate API into existing tools
4. Add analytics to CI/CD pipeline

### Importing Existing Reports

If you have existing reports outside the history directory:

```bash
# Copy to history directory
cp old-reports/*.json .specbridge/reports/history/

# Rename to correct format (report-YYYY-MM-DD.json)
# Then use normally
```

---

## Future Enhancements

### Planned Features

1. **Machine Learning Insights**
   - Predictive drift detection
   - Anomaly detection
   - Compliance forecasting

2. **Advanced Visualizations**
   - Heat maps
   - Network graphs
   - Custom dashboards

3. **Export Formats**
   - PDF reports
   - PowerPoint slides
   - Excel spreadsheets

4. **Integrations**
   - Jira/Linear issue tracking
   - Slack/Teams notifications
   - GitHub PR annotations

5. **Multi-Project Analytics**
   - Cross-project comparisons
   - Portfolio-level reporting
   - Shared compliance metrics

### Contributing

Want to contribute to analytics features?
1. Check [CONTRIBUTING.md](../../CONTRIBUTING.md)
2. Review [issues tagged "analytics"](https://github.com/nouatzi/specbridge/labels/analytics)
3. Join [discussions](https://github.com/nouatzi/specbridge/discussions)

---

## Support

- **Documentation**: [docs/](../)
- **Demo**: [demos/analytics-demo.md](../demos/analytics-demo.md)
- **API Reference**: [API.md](../API.md)
- **Issues**: [GitHub Issues](https://github.com/nouatzi/specbridge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nouatzi/specbridge/discussions)

---

*Last updated: February 2026*
