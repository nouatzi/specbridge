# Analytics & Insights - Quick Reference Card

Fast reference for analytics features. Keep this handy! 📋

---

## 🚀 Quick Commands

```bash
# Basic reporting
specbridge report                        # Generate report
specbridge report --save                 # Save to history

# Trend analysis
specbridge report --trend                # Show trend
specbridge report --trend --days 7       # 7-day trend
specbridge report --drift                # Compare with previous

# Analytics
specbridge analytics                     # Overall summary
specbridge analytics --insights          # With AI insights
specbridge analytics auth-001            # Specific decision
specbridge analytics --format json       # JSON output

# Dashboard
specbridge dashboard                     # Start on :3000
specbridge dashboard --port 8080         # Custom port
```

---

## 📊 CLI Options Reference

### `specbridge report`
| Option | Description | Example |
|--------|-------------|---------|
| `--trend` | Show compliance trend | `--trend --days 30` |
| `--drift` | Analyze drift | `--drift` |
| `--days <n>` | Analysis period | `--days 7` |
| `--save` | Save to history | `--save` |
| `-f, --format` | Output format | `--format json` |
| `-o, --output` | Output file | `-o report.md` |

### `specbridge analytics`
| Option | Description | Example |
|--------|-------------|---------|
| `[decision-id]` | Analyze specific decision | `analytics auth-001` |
| `--insights` | Show AI insights | `--insights` |
| `--days <n>` | Analysis period | `--days 90` |
| `-f, --format` | Output format | `--format json` |

### `specbridge dashboard`
| Option | Description | Example |
|--------|-------------|---------|
| `-p, --port` | Port number | `--port 8080` |
| `-h, --host` | Host address | `--host 0.0.0.0` |

---

## 🔌 API Endpoints

**Base URL**: `http://localhost:3000/api`

### Reports
```
GET  /health                    - Health check
GET  /report/latest             - Latest report
GET  /report/history?days=30    - Historical reports
GET  /report/dates              - Available dates
GET  /report/:date              - Specific report
```

### Decisions
```
GET  /decisions                 - All decisions
GET  /decisions/:id             - Decision by ID
```

### Analytics
```
GET  /analytics/summary?days=90 - Analytics summary
GET  /analytics/decision/:id    - Decision analytics
GET  /drift?days=2              - Drift analysis
GET  /trend?days=30             - Trend analysis
```

---

## 💻 Code Examples

### TypeScript/JavaScript

```typescript
// Report Storage
import { ReportStorage } from '@ipation/specbridge';
const storage = new ReportStorage(cwd);
await storage.save(report);
const history = await storage.loadHistory(30);

// Drift Detection
import { detectDrift } from '@ipation/specbridge';
const drift = await detectDrift(current, previous);

// Analytics
import { AnalyticsEngine } from '@ipation/specbridge';
const engine = new AnalyticsEngine();
const summary = await engine.generateSummary(history);
```

### Bash/cURL

```bash
# Get latest compliance
curl http://localhost:3000/api/report/latest | jq '.summary.compliance'

# Get trend
curl 'http://localhost:3000/api/trend?days=7' | jq '.overall.trend'

# Get insights
curl http://localhost:3000/api/analytics/summary | jq '.insights'
```

---

## 📁 File Locations

```
.specbridge/
└── reports/
    └── history/
        ├── report-2024-02-01.json
        ├── report-2024-02-02.json
        └── report-2024-02-03.json

docs/
├── demos/
│   ├── analytics-demo.md           - Full demo
│   ├── QUICKSTART.md               - Quick start
│   └── generate-sample-data.sh     - Sample data
├── features/
│   └── analytics-and-insights.md   - Features
├── API.md                          - API reference
```

---

## 🎯 Common Workflows

### Daily Monitoring
```bash
# Run in CI/CD
specbridge report --save
specbridge report --drift > drift-report.txt
```

### Weekly Review
```bash
# Team meeting
specbridge report --trend --drift --days 7
specbridge analytics --insights
specbridge dashboard  # Share screen
```

### Pre-Release Check
```bash
# Before deploying
specbridge verify --level full
specbridge analytics --format json | jq '.criticalIssues'
```

### Integration
```bash
# Slack notification
COMPLIANCE=$(curl -s localhost:3000/api/report/latest | jq '.summary.compliance')
if [ $COMPLIANCE -lt 80 ]; then
  # Send alert
fi
```

---

## 🔍 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Not enough data" | Run `./docs/demos/generate-sample-data.sh` |
| Dashboard blank | Check `curl localhost:3000/api/health` |
| Port in use | Use `--port 8080` |
| Missing reports | Run `specbridge report --save` |

---

## 📚 Learn More

- **5-minute start**: [QUICKSTART.md](demos/QUICKSTART.md)
- **Full demo**: [analytics-demo.md](demos/analytics-demo.md)
- **API docs**: [API.md](API.md)
- **Features**: [analytics-and-insights.md](features/analytics-and-insights.md)

---

## 🎨 Visual Indicators

When you see:
- **📈** = Improving trend
- **📉** = Degrading trend
- **➡️** = Stable trend
- **🟢** = Success/Good
- **🟠** = Warning
- **🔴** = Critical
- **💡** = Suggestion

---

**Print this page and keep it handy!** 📋✨
