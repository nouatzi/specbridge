#!/bin/bash
# Generate Sample Historical Data for SpecBridge Analytics Demo
# This script creates realistic historical compliance reports for demonstration

set -e

echo "🎯 SpecBridge Analytics Demo - Sample Data Generator"
echo "=================================================="
echo ""

# Check if .specbridge exists
if [ ! -d ".specbridge" ]; then
    echo "❌ Error: .specbridge directory not found"
    echo "   Please run 'specbridge init' first"
    exit 1
fi

# Create history directory
HISTORY_DIR=".specbridge/reports/history"
mkdir -p "$HISTORY_DIR"

echo "📁 Creating sample historical reports..."
echo "   Location: $HISTORY_DIR"
echo ""

# Function to generate a sample report
generate_report() {
    local date=$1
    local compliance=$2
    local critical=$3
    local high=$4
    local medium=$5
    local low=$6

    cat > "$HISTORY_DIR/report-$date.json" << EOF
{
  "timestamp": "${date}T10:00:00.000Z",
  "project": "demo-project",
  "summary": {
    "totalDecisions": 5,
    "activeDecisions": 5,
    "totalConstraints": 25,
    "violations": {
      "critical": $critical,
      "high": $high,
      "medium": $medium,
      "low": $low
    },
    "compliance": $compliance
  },
  "byDecision": [
    {
      "decisionId": "auth-001",
      "title": "Authentication Strategy",
      "status": "active",
      "constraints": 5,
      "violations": $(( (100 - compliance) / 20 )),
      "compliance": $(( compliance + 5 ))
    },
    {
      "decisionId": "api-001",
      "title": "API Naming Conventions",
      "status": "active",
      "constraints": 5,
      "violations": $(( (100 - compliance) / 15 )),
      "compliance": $(( compliance - 3 ))
    },
    {
      "decisionId": "error-001",
      "title": "Error Handling Standards",
      "status": "active",
      "constraints": 5,
      "violations": $(( (100 - compliance) / 18 )),
      "compliance": $compliance
    },
    {
      "decisionId": "test-001",
      "title": "Testing Requirements",
      "status": "active",
      "constraints": 5,
      "violations": $(( (100 - compliance) / 12 )),
      "compliance": $(( compliance - 8 ))
    },
    {
      "decisionId": "docs-001",
      "title": "Documentation Standards",
      "status": "active",
      "constraints": 5,
      "violations": $(( (100 - compliance) / 16 )),
      "compliance": $(( compliance + 2 ))
    }
  ]
}
EOF

    echo "   ✓ Generated report for $date (${compliance}% compliance)"
}

# Generate 30 days of historical data showing improvement trend
echo "📊 Generating 30-day improvement trend..."
echo ""

# Simulate a realistic improvement journey
# Week 1: Initial state (low compliance)
generate_report "2024-01-05" 65 3 8 12 15
generate_report "2024-01-06" 66 3 8 11 15
generate_report "2024-01-07" 67 2 8 11 14

# Week 2: Some improvements
generate_report "2024-01-08" 68 2 7 10 14
generate_report "2024-01-09" 69 2 7 10 13
generate_report "2024-01-10" 70 2 6 9 13
generate_report "2024-01-11" 72 1 6 9 12
generate_report "2024-01-12" 73 1 6 8 12

# Week 3: Focused effort
generate_report "2024-01-15" 75 1 5 8 11
generate_report "2024-01-16" 76 1 5 7 10
generate_report "2024-01-17" 78 1 4 7 10
generate_report "2024-01-18" 79 0 4 6 9
generate_report "2024-01-19" 80 0 4 6 8

# Week 4: Continued progress
generate_report "2024-01-22" 82 0 3 5 8
generate_report "2024-01-23" 83 0 3 5 7
generate_report "2024-01-24" 84 0 3 4 7
generate_report "2024-01-25" 85 0 2 4 6
generate_report "2024-01-26" 86 0 2 4 6

# Week 5: Reaching goals
generate_report "2024-01-29" 87 0 2 3 5
generate_report "2024-01-30" 88 0 1 3 5
generate_report "2024-01-31" 89 0 1 3 4
generate_report "2024-02-01" 90 0 1 2 4
generate_report "2024-02-02" 91 0 1 2 3

# Week 6: Excellence
generate_report "2024-02-05" 92 0 0 2 3
generate_report "2024-02-06" 93 0 0 2 2
generate_report "2024-02-07" 94 0 0 1 2
generate_report "2024-02-08" 95 0 0 1 1

echo ""
echo "✅ Sample data generation complete!"
echo ""
echo "📈 Generated 28 historical reports showing:"
echo "   • Starting compliance: 65%"
echo "   • Ending compliance: 95%"
echo "   • Overall improvement: +30%"
echo "   • Trend: 📈 IMPROVING"
echo ""
echo "🎯 You can now try:"
echo "   specbridge report --trend --days 30"
echo "   specbridge report --drift"
echo "   specbridge analytics --insights"
echo "   specbridge dashboard"
echo ""
echo "🎬 Happy demoing!"
