# Phase 4 Analytics - Quick Start Guide

Get started with SpecBridge Analytics & Insights in 5 minutes!

## Prerequisites

- SpecBridge installed: `npm install -g @ipation/specbridge`
- Initialized project: `specbridge init`

## Option 1: Quick Demo with Sample Data (Recommended)

Perfect for first-time users who want to see features immediately.

### Step 1: Generate Sample Data

```bash
# Navigate to your SpecBridge project
cd your-project

# Run the sample data generator
./docs/demos/generate-sample-data.sh
```

This creates 28 days of historical reports showing a realistic improvement journey (65% → 95% compliance).

### Step 2: Try Analytics Features

```bash
# View compliance trend
specbridge report --trend --days 30

# Analyze recent drift
specbridge report --drift

# Get comprehensive analytics
specbridge analytics --insights

# Launch interactive dashboard
specbridge dashboard
```

Then open http://localhost:3000 to see the visual dashboard!

### Step 3: Explore the Dashboard

The dashboard shows:
- **Compliance Score**: Large prominent score with trend indicator
- **Trend Chart**: 30-day visualization of compliance changes
- **Decision Breakdown**: Per-decision compliance scores
- **Automated Insights**: Warnings, successes, and suggestions

### Step 4: Try the API

```bash
# Get latest compliance
curl http://localhost:3000/api/report/latest | jq '.summary.compliance'

# Get analytics summary
curl http://localhost:3000/api/analytics/summary | jq '.overallTrend'

# Get drift analysis
curl http://localhost:3000/api/drift | jq
```

---

## Option 2: Real Project Usage

For actual project monitoring (data accumulates over time).

### Step 1: Generate Initial Report

```bash
specbridge report --save
```

This creates your baseline compliance report.

### Step 2: Verify Daily

Add to your CI/CD pipeline or run manually:

```bash
# Daily verification with auto-save
specbridge report --save
```

**GitHub Actions Example:**
```yaml
name: Daily Compliance
on:
  schedule:
    - cron: '0 9 * * *'  # 9 AM daily

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @ipation/specbridge
      - run: specbridge report --save
```

### Step 3: Weekly Reviews

Every week, run:

```bash
# See 7-day trend and recent drift
specbridge report --trend --drift --days 7
```

### Step 4: Launch Dashboard

For continuous monitoring:

```bash
# Start dashboard
specbridge dashboard

# Or bind to network interface for team access
specbridge dashboard --host 0.0.0.0
```

---

## Common Commands Reference

### Reporting
```bash
specbridge report                        # Basic report
specbridge report --save                 # Save to history
specbridge report --trend --days 30      # 30-day trend
specbridge report --drift                # Compare with previous
specbridge report --format json          # JSON output
specbridge report --format markdown -o report.md  # Markdown file
```

### Analytics
```bash
specbridge analytics                     # Overall summary
specbridge analytics --insights          # With AI insights
specbridge analytics auth-001            # Specific decision
specbridge analytics --format json       # JSON output
specbridge analytics --days 90           # 90-day analysis
```

### Dashboard
```bash
specbridge dashboard                     # Start on :3000
specbridge dashboard --port 8080         # Custom port
specbridge dashboard --host 0.0.0.0      # Network access
```

---

## Integration Examples

### Slack Notification

```bash
#!/bin/bash
# Send Slack alert if compliance drops below 80%

COMPLIANCE=$(curl -s http://localhost:3000/api/report/latest | jq '.summary.compliance')

if [ $COMPLIANCE -lt 80 ]; then
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"⚠️ Compliance dropped to ${COMPLIANCE}%\"}"
fi
```

### Weekly Email Report

```bash
#!/bin/bash
# Generate and email weekly compliance report

specbridge report --trend --drift --days 7 \
  --format markdown \
  --output weekly-compliance.md

# Send via email (using mail command or API)
mail -s "Weekly Compliance Report" team@company.com < weekly-compliance.md
```

### Pre-Release Check

```bash
#!/bin/bash
# Ensure compliance before release

# Full verification
specbridge verify --level full

# Check for critical issues
CRITICAL=$(specbridge analytics --format json | jq '.criticalIssues')

if [ $CRITICAL -gt 0 ]; then
  echo "❌ Cannot release: $CRITICAL critical compliance issues"
  specbridge analytics --insights  # Show details
  exit 1
fi

echo "✅ Compliance check passed"
```

---

## Troubleshooting

### "Not enough data for trend analysis"

**Solution:** Generate more historical reports

```bash
# For demo: Use sample data
./docs/demos/generate-sample-data.sh

# For real project: Generate reports over several days
specbridge report --save  # Run daily
```

### Dashboard shows "No report data available"

**Solution:** Generate at least one report

```bash
specbridge report --save
```

Then refresh the dashboard.

### Port 3000 already in use

**Solution:** Use a different port

```bash
specbridge dashboard --port 8080
```

---

## Next Steps

1. **Read the Full Demo**: [phase4-analytics-demo.md](phase4-analytics-demo.md)
2. **Explore Documentation**: [analytics-and-insights.md](../features/analytics-and-insights.md)
3. **Set Up Automation**: Add to CI/CD pipeline
4. **Integrate with Tools**: Use API for custom integrations
5. **Share with Team**: Launch dashboard for team visibility

---

## Getting Help

- **Documentation**: [docs/features/](../features/)
- **Examples**: [docs/demos/](../demos/)
- **Issues**: [GitHub Issues](https://github.com/nouatzi/specbridge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nouatzi/specbridge/discussions)

---

**Happy analyzing! 📊✨**
