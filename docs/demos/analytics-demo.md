# Analytics & Insights - Interactive Demo Guide

This guide walks you through the analytics and insights features.

## Prerequisites

1. SpecBridge initialized in your project:
   ```bash
   specbridge init
   ```

2. At least one architectural decision:
   ```bash
   specbridge decision create
   ```

3. Generated at least one report:
   ```bash
   specbridge report
   ```

## Demo Walkthrough

### Part 1: Report Storage & History (5 minutes)

#### Step 1: Generate Your First Report

```bash
# Generate a baseline compliance report
specbridge report
```

**Expected Output:**
```
✓ Report generated

SpecBridge Compliance Report
============================

Project: your-project-name
Overall Compliance: 85%

Decision Compliance:
├─ auth-001: Authentication Strategy - 90%
├─ api-001: API Naming Conventions - 80%
└─ error-001: Error Handling - 85%

Violations by Severity:
├─ Critical: 0
├─ High: 2
├─ Medium: 5
└─ Low: 8
```

**What just happened?**
- SpecBridge verified your code against all active decisions
- Generated a compliance report with overall and per-decision scores
- **Automatically saved** the report to `.specbridge/reports/history/report-YYYY-MM-DD.json`

#### Step 2: Check Historical Reports

```bash
# List available report dates
ls .specbridge/reports/history/
```

**Expected Output:**
```
report-2024-02-02.json
```

**View a specific report:**
```bash
cat .specbridge/reports/history/report-2024-02-02.json | jq '.summary'
```

---

### Part 2: Trend Analysis (10 minutes)

#### Step 3: Make Some Code Changes

For this demo, let's simulate compliance improvement over time:

**Option A: Fix some violations**
1. Open files with violations
2. Fix 2-3 violations
3. Generate a new report

**Option B: Use the demo script (faster)**
```bash
# We'll create multiple reports with different compliance scores
# In real usage, these would be generated over time as you fix violations
```

#### Step 4: Generate Multiple Reports

```bash
# Day 1 (baseline - 70% compliance)
specbridge report --save

# Make improvements...
# Day 2 (improved - 80% compliance)
specbridge report --save

# More improvements...
# Day 3 (better - 90% compliance)
specbridge report --save
```

**Note:** In production, reports are generated automatically over time. For this demo, we're simulating multiple days.

#### Step 5: View Compliance Trend

```bash
specbridge report --trend --days 30
```

**Expected Output:**
```
✓ Report generated

=== Compliance Trend Analysis ===

Period: 2024-02-01 to 2024-02-03 (3 days)

Overall Compliance: 70% → 90% (+20.0%)
📈 Trend: IMPROVING

✅ Most Improved Decisions:
  • Authentication Strategy: 65% → 95% (+30.0%)
  • API Naming Conventions: 70% → 88% (+18.0%)

Report saved to: .specbridge/reports/health-2024-02-03.txt
```

**Key Features:**
- 📈 Visual trend indicators (improving/degrading/stable)
- Period summary showing start and end compliance
- Identification of most improved decisions
- Highlighting of degrading areas that need attention

---

### Part 3: Drift Detection (10 minutes)

#### Step 6: Analyze Drift Since Last Report

```bash
specbridge report --drift
```

**Expected Output:**
```
✓ Report generated

=== Drift Analysis ===

Comparing: 2024-02-02 vs 2024-02-03

Compliance Change: +10.0%
📈 Overall Trend: IMPROVING

✅ Fixed Violations: 8
  • Critical: 0
  • High: 2
  • Medium: 4
  • Low: 2

📈 Most Improved:
  • Authentication Strategy: 80% → 95% (+15.0%)
    -3 fixed violation(s)
  • Error Handling: 75% → 85% (+10.0%)
    -2 fixed violation(s)

⚠️  New Violations: 1
  • Low: 1
```

**Key Features:**
- Compares current report with previous report
- Shows exactly what changed (new vs. fixed violations)
- Breaks down changes by severity
- Identifies which decisions improved or degraded

#### Step 7: Combined Trend + Drift Analysis

```bash
# Get the full picture: long-term trends AND recent changes
specbridge report --trend --drift --days 30
```

**Use Case:** Perfect for weekly team reviews to see:
- Long-term trends (are we generally improving?)
- Recent drift (what changed since last week?)
- Which areas need immediate attention

---

### Part 4: Analytics Engine (15 minutes)

#### Step 8: Overall Analytics Summary

```bash
specbridge analytics --insights
```

**Expected Output:**
```
✓ Loaded 10 historical report(s)

=== Overall Analytics ===

Summary:
  Total Decisions: 5
  Average Compliance: 87%
  Critical Issues: 0
  📈 Overall Trend: UP

✅ Top Performing Decisions:
  1. Authentication Strategy: 95%
  2. Error Handling: 90%
  3. API Naming Conventions: 88%

⚠️  Decisions Needing Attention:
  1. Testing Requirements: 65%
  2. Documentation Standards: 70%

=== Insights ===

✅ Positive Trends:
  • Compliance has improved by 18.0% over the past 10 days
    From 72% to 90%
  • 3 decision(s) have 100% compliance
    Authentication Strategy, Security Headers, Code Review Process

⚠️  Warnings:
  • 2 decision(s) have less than 50% compliance
    Legacy Code Migration (45%), Database Schema (35%)

💡 Suggestions:
  • Most violations are lower severity
    Consider addressing high-severity issues first for maximum impact

Data range: 2024-01-24 to 2024-02-03
Analyzing 10 report(s) over 90 days
```

**Key Features:**
- **Automated Insights**: AI-generated observations about your compliance
- **Top/Bottom Performers**: Quickly identify best and worst decisions
- **Trend Detection**: See if things are generally improving or degrading
- **Actionable Suggestions**: Get recommendations on what to focus on

#### Step 9: Per-Decision Analytics

```bash
# Analyze a specific decision in detail
specbridge analytics auth-001
```

**Expected Output:**
```
✓ Loaded 10 historical report(s)

=== Decision Analytics: Authentication Strategy ===

Overview:
  ID: auth-001
  Current Violations: 1
  Average Compliance: 88.5%
  📈 Trend: UP

Compliance History:
  ✅ 2024-02-03: 95% (1 violations)
  ✅ 2024-02-02: 90% (2 violations)
  ⚠️  2024-02-01: 85% (3 violations)
  ⚠️  2024-01-31: 80% (4 violations)
  ⚠️  2024-01-30: 75% (5 violations)
  ...

Data range: 2024-01-24 to 2024-02-03
```

**Use Cases:**
- Track progress on specific architectural decisions
- Understand compliance patterns over time
- Identify decisions that are consistently problematic
- Celebrate improvements in critical areas

#### Step 10: Export Analytics as JSON

```bash
# For programmatic use or integration with other tools
specbridge analytics --format json > analytics.json
```

**Use Cases:**
- Generate custom reports
- Feed data into monitoring systems
- Create executive dashboards
- Integrate with Slack/Teams notifications

---

### Part 5: Web Dashboard (10 minutes)

#### Step 11: Launch the Dashboard

```bash
specbridge dashboard
```

**Expected Output:**
```
Starting SpecBridge dashboard...

✓ Dashboard running at http://localhost:3000
  Press Ctrl+C to stop

API Endpoints:
  http://localhost:3000/api/health - Health check
  http://localhost:3000/api/report/latest - Latest report
  http://localhost:3000/api/decisions - All decisions
  http://localhost:3000/api/analytics/summary - Analytics
```

#### Step 12: Explore the Dashboard

Open your browser to **http://localhost:3000**

**Dashboard Features:**

1. **Compliance Score Card** (top left)
   - Large, prominent overall compliance percentage
   - Trend indicator (📈/📉/➡️)
   - Color-coded based on compliance level

2. **Summary Cards** (top row)
   - Decision counts and statistics
   - Violation breakdown by severity
   - Quick health overview

3. **Compliance Trend Chart**
   - Interactive line chart showing 30-day trend
   - Hover to see exact values
   - Visual representation of improvement/degradation

4. **Decision Breakdown Table**
   - All decisions with compliance scores
   - Violation counts
   - Color-coded status indicators

5. **Automated Insights Panel**
   - AI-generated warnings
   - Success highlights
   - Actionable suggestions

**Dashboard Auto-Refreshes:**
- Generate a new report in another terminal
- Watch the dashboard update automatically

#### Step 13: Explore the API

The dashboard is powered by a REST API you can use directly:

```bash
# Get latest report
curl http://localhost:3000/api/report/latest | jq '.summary'

# Get 30-day history
curl http://localhost:3000/api/report/history?days=30 | jq '.[].timestamp'

# Get analytics summary
curl http://localhost:3000/api/analytics/summary | jq '.insights'

# Get drift analysis
curl http://localhost:3000/api/drift | jq '.trend'

# Health check
curl http://localhost:3000/api/health
```

**Integration Examples:**

```bash
# Example: Slack notification if compliance drops
COMPLIANCE=$(curl -s http://localhost:3000/api/report/latest | jq '.summary.compliance')
if [ $COMPLIANCE -lt 80 ]; then
  curl -X POST $SLACK_WEBHOOK -d "{\"text\":\"⚠️ Compliance dropped to ${COMPLIANCE}%\"}"
fi

# Example: Export to CSV for executive report
curl -s http://localhost:3000/api/report/history?days=30 | \
  jq -r '.[] | [.timestamp, .report.summary.compliance] | @csv' > compliance.csv
```

---

### Part 6: CI/CD Integration (5 minutes)

#### Step 14: Add Dashboard to CI Pipeline

**GitHub Actions Example:**

```yaml
# .github/workflows/compliance-monitor.yml
name: Compliance Monitoring

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install SpecBridge
        run: npm install -g @ipation/specbridge

      - name: Generate Report
        run: specbridge report --save

      - name: Analyze Drift
        run: |
          specbridge report --drift > drift-report.txt
          cat drift-report.txt

      - name: Check Critical Issues
        run: |
          CRITICAL=$(specbridge analytics --format json | jq '.criticalIssues')
          if [ $CRITICAL -gt 0 ]; then
            echo "::error::Found $CRITICAL critical compliance issues"
            exit 1
          fi
```

**Benefits:**
- Automated daily compliance checks
- Historical data builds automatically
- Trend analysis available for team reviews
- Alerts on critical violations

---

## Demo Scenarios

### Scenario 1: New Team Member Onboarding

**Goal:** Show new team members current architectural decisions and compliance status

```bash
# 1. Show overall health
specbridge report

# 2. List all decisions
specbridge decision list

# 3. Show recent trends
specbridge report --trend --days 7

# 4. Launch dashboard for interactive exploration
specbridge dashboard
```

### Scenario 2: Weekly Team Review

**Goal:** Review compliance progress during weekly team meeting

```bash
# 1. Generate latest report with trends
specbridge report --trend --drift --days 7

# 2. Get detailed analytics
specbridge analytics --insights

# 3. Share dashboard URL for team to explore
specbridge dashboard --host 0.0.0.0
# Team accesses: http://your-ip:3000
```

### Scenario 3: Pre-Release Compliance Check

**Goal:** Ensure compliance before major release

```bash
# 1. Full verification
specbridge verify --level full

# 2. Check if compliance improved since last release
specbridge report --drift

# 3. Verify no critical issues
specbridge analytics --format json | jq '.criticalIssues'

# 4. Generate executive summary
specbridge report --format markdown --output release-compliance.md
```

### Scenario 4: Compliance Investigation

**Goal:** Investigate why compliance dropped

```bash
# 1. Check recent drift
specbridge report --drift

# 2. Identify problematic decisions
specbridge analytics --insights

# 3. Analyze specific decision
specbridge analytics <decision-id-with-issues>

# 4. View detailed violations
specbridge verify --level full
```

---

## Tips & Best Practices

### 1. **Generate Reports Regularly**
- Set up automated daily/weekly reports
- More data points = better trend analysis
- Consider post-commit hooks for automatic generation

### 2. **Use the Right Tool for the Job**
- **Quick check**: `specbridge report`
- **Weekly review**: `specbridge report --trend --drift`
- **Deep dive**: `specbridge analytics --insights`
- **Monitoring**: Dashboard + API integration

### 3. **Leverage Insights**
- Pay attention to automated insights
- Prioritize high-severity violations
- Celebrate improvements to motivate team

### 4. **Dashboard Best Practices**
- Keep dashboard running during development
- Use it in team meetings for visibility
- Set up on shared screen/monitor for continuous awareness

### 5. **API Integration Ideas**
- Slack/Teams notifications on drift
- Executive dashboard with historical trends
- Automated reports to stakeholders
- Integration with project management tools

---

## Troubleshooting

### No Historical Data

**Problem:** "Not enough data for trend analysis"

**Solution:**
```bash
# Generate reports over several days
# Or use --save to ensure reports are stored
specbridge report --save
```

### Dashboard Not Loading

**Problem:** Dashboard shows blank page

**Solution:**
```bash
# Check if server is running
curl http://localhost:3000/api/health

# Try different port
specbridge dashboard --port 8080

# Check logs for errors
```

### Missing Reports

**Problem:** Historical reports not found

**Solution:**
```bash
# Check storage directory
ls -la .specbridge/reports/history/

# Ensure .specbridge exists
specbridge init

# Regenerate reports with --save
specbridge report --save
```

---

## Next Steps

Now that you've seen Analytics & Insights in action:

1. **Set up automated reporting** in your CI/CD pipeline
2. **Schedule weekly reviews** using analytics commands
3. **Deploy the dashboard** for team visibility
4. **Integrate with monitoring tools** using the API
5. **Explore Phase 5** for framework-specific analyzers and decision packs

## Feedback & Questions

- Found a bug? [Report it](https://github.com/nouatzi/specbridge/issues)
- Have a feature idea? [Open a discussion](https://github.com/nouatzi/specbridge/discussions)
- Need help? Check the [documentation](../README.md)

---

**Happy analyzing! 📊✨**
