# CI/CD Integration

This guide shows how to integrate SpecBridge into your CI/CD pipeline.

## GitHub Actions

### Basic Setup

Create `.github/workflows/specbridge.yml`:

```yaml
name: SpecBridge Verification

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run SpecBridge verification
        run: npx specbridge verify --level pr

      - name: Generate compliance report
        if: always()
        run: npx specbridge report --format markdown --output specbridge-report.md

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: specbridge-report
          path: specbridge-report.md
```

### With PR Comments

Add PR comments with verification results:

```yaml
- name: Run SpecBridge verification
  id: verify
  continue-on-error: true
  run: |
    npx specbridge verify --level pr --json > verification-result.json
    echo "result=$(cat verification-result.json)" >> $GITHUB_OUTPUT

- name: Comment PR
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const result = JSON.parse(fs.readFileSync('verification-result.json', 'utf8'));

      let body = '## SpecBridge Verification\n\n';

      if (result.success) {
        body += '✅ All checks passed!\n\n';
        body += `- Files checked: ${result.checked}\n`;
        body += `- Duration: ${result.duration}ms`;
      } else {
        body += '❌ Verification failed\n\n';
        body += `- Violations found: ${result.violations.length}\n`;
        body += `- Critical: ${result.violations.filter(v => v.severity === 'critical').length}\n`;
        body += `- High: ${result.violations.filter(v => v.severity === 'high').length}\n\n`;
        body += '<details><summary>View violations</summary>\n\n';

        for (const v of result.violations.slice(0, 10)) {
          body += `**${v.file}:${v.line}**\n`;
          body += `- ${v.message}\n`;
          body += `- Severity: ${v.severity}\n\n`;
        }

        if (result.violations.length > 10) {
          body += `\n... and ${result.violations.length - 10} more\n`;
        }

        body += '</details>';
      }

      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: body
      });

- name: Fail if violations
  if: steps.verify.outcome == 'failure'
  run: exit 1
```

### Caching

Speed up runs with caching:

```yaml
- name: Cache SpecBridge inference
  uses: actions/cache@v4
  with:
    path: .specbridge/inferred
    key: specbridge-inference-${{ hashFiles('src/**/*.ts') }}
    restore-keys: |
      specbridge-inference-
```

## GitLab CI

Create `.gitlab-ci.yml`:

```yaml
specbridge:verify:
  stage: test
  image: node:20
  script:
    - npm ci
    - npx specbridge verify --level pr
  artifacts:
    when: always
    reports:
      junit: specbridge-report.xml
    paths:
      - specbridge-report.md
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'

specbridge:report:
  stage: test
  image: node:20
  script:
    - npm ci
    - npx specbridge report --format markdown --output specbridge-report.md
  artifacts:
    paths:
      - specbridge-report.md
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
```

## Jenkins

Create `Jenkinsfile`:

```groovy
pipeline {
    agent any

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Verify') {
            steps {
                script {
                    def exitCode = sh(
                        script: 'npx specbridge verify --level pr',
                        returnStatus: true
                    )

                    if (exitCode != 0) {
                        currentBuild.result = 'FAILURE'
                        error('SpecBridge verification failed')
                    }
                }
            }
        }

        stage('Report') {
            when {
                expression { currentBuild.result != 'FAILURE' }
            }
            steps {
                sh 'npx specbridge report --format markdown --save'
                archiveArtifacts artifacts: '.specbridge/reports/*.md'
            }
        }
    }

    post {
        always {
            sh 'npx specbridge report --format json --output specbridge-report.json'
            archiveArtifacts artifacts: 'specbridge-report.json'
        }
    }
}
```

## CircleCI

Create `.circleci/config.yml`:

```yaml
version: 2.1

jobs:
  verify:
    docker:
      - image: cimg/node:20.19
    steps:
      - checkout
      - restore_cache:
          keys:
            - node-deps-{{ checksum "package-lock.json" }}
      - run:
          name: Install dependencies
          command: npm ci
      - save_cache:
          key: node-deps-{{ checksum "package-lock.json" }}
          paths:
            - node_modules
      - run:
          name: Run SpecBridge
          command: npx specbridge verify --level pr
      - run:
          name: Generate report
          command: npx specbridge report --format json --output specbridge-report.json
          when: always
      - store_artifacts:
          path: specbridge-report.json

workflows:
  version: 2
  verify:
    jobs:
      - verify
```

## Azure Pipelines

Create `azure-pipelines.yml`:

```yaml
trigger:
  branches:
    include:
      - main
      - develop

pr:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
    displayName: 'Install Node.js'

  - script: npm ci
    displayName: 'Install dependencies'

  - script: npx specbridge verify --level pr
    displayName: 'Run SpecBridge verification'
    continueOnError: true

  - script: npx specbridge report --format json --output $(Build.ArtifactStagingDirectory)/specbridge-report.json
    displayName: 'Generate compliance report'
    condition: always()

  - task: PublishBuildArtifacts@1
    inputs:
      pathToPublish: '$(Build.ArtifactStagingDirectory)'
      artifactName: 'specbridge-reports'
    condition: always()
```

## Blocking Strategy

### Block on Critical Violations

```bash
# In CI script
npx specbridge verify --level pr --severity critical
if [ $? -ne 0 ]; then
  echo "Critical violations found - blocking merge"
  exit 1
fi
```

### Warning on High Violations

```bash
# Check high severity but don't block
npx specbridge verify --level pr --severity high || true
```

### Progressive Enforcement

```yaml
# .specbridge/config.yaml
verification:
  levels:
    commit:
      severity: [critical]
    pr:
      severity: [critical, high]
    scheduled:
      severity: [critical, high, medium, low]
```

## Scheduled Compliance Checks

### GitHub Actions - Daily Report

```yaml
name: Daily Compliance Report

on:
  schedule:
    - cron: '0 9 * * 1-5'  # 9 AM weekdays
  workflow_dispatch:

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - run: npm ci

      - name: Generate full report
        run: npx specbridge report --format markdown --save

      - name: Send to Slack
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "Daily SpecBridge Compliance Report",
              "attachments": [
                {
                  "color": "good",
                  "text": "$(cat .specbridge/reports/health-latest.md)"
                }
              ]
            }
```

## Monorepo Support

### Verify Multiple Packages

```yaml
jobs:
  verify-packages:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [api, web, shared]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - run: npm ci

      - name: Verify ${{ matrix.package }}
        working-directory: packages/${{ matrix.package }}
        run: npx specbridge verify --level pr
```

## Performance Optimization

### Only Check Changed Files

```bash
# Get changed files
CHANGED_FILES=$(git diff --name-only origin/main...HEAD -- '*.ts' '*.tsx')

if [ -n "$CHANGED_FILES" ]; then
  # Convert to comma-separated list
  FILES=$(echo "$CHANGED_FILES" | tr '\n' ',' | sed 's/,$//')
  npx specbridge verify --level pr --files "$FILES"
else
  echo "No TypeScript files changed"
fi
```

### Parallel Execution

```yaml
jobs:
  verify:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4

      - run: npm ci

      - name: Verify shard ${{ matrix.shard }}
        run: |
          # Split files into shards
          FILES=$(find src -name "*.ts" | awk "NR % 4 == ${{ matrix.shard }} - 1")
          npx specbridge verify --files "$FILES"
```

## Integration with Other Tools

### ESLint Integration

```yaml
- name: Run ESLint
  run: npm run lint

- name: Run SpecBridge
  run: npx specbridge verify --level pr

- name: Combine results
  if: always()
  run: |
    echo "## Code Quality Report" > report.md
    echo "### ESLint" >> report.md
    npm run lint -- -f markdown >> report.md || true
    echo "### SpecBridge" >> report.md
    npx specbridge report --format markdown >> report.md
```

### SonarQube Integration

```yaml
- name: SonarQube Scan
  uses: sonarsource/sonarqube-scan-action@master
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

- name: SpecBridge Verification
  run: |
    npx specbridge verify --level pr --json > specbridge-results.json
    # Convert to SonarQube generic issue format if needed
```

## Troubleshooting CI

### Timeout Issues

```yaml
# Increase timeout
- name: Run SpecBridge
  run: npx specbridge verify --level pr
  timeout-minutes: 10
```

### Memory Issues

```yaml
- name: Run with more memory
  run: NODE_OPTIONS="--max-old-space-size=4096" npx specbridge verify
```

### Debug Mode

```yaml
- name: Run with debug output
  run: DEBUG=specbridge:* npx specbridge verify --level pr
```
