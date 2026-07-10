# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.x     | :white_check_mark: |
| 2.x     | :x:                |
| 1.x     | :x:                |
| 0.x     | :x:                |

## Reporting a Security Issue

If you discover a security vulnerability in SpecBridge, please report it by emailing the maintainers directly rather than using the public issue tracker.

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and provide a timeline for the fix.

## Security Best Practices

When using SpecBridge:

1. Keep SpecBridge updated to the latest version
2. Review decision files before committing them
3. Use version control for all `.specbridge/` configurations
4. Restrict write access to `.specbridge/decisions/` in production
5. Run `npm audit` regularly to check dependencies

## Plugin Execution Model

Custom verifier files under `.specbridge/verifiers/` are imported and executed by the
`specbridge verify` process. They run with the full privileges of that process: file-system
access, environment variables, network access available to the process, and any credentials
present in the execution environment.

Treat verifier plugins like ESLint plugins or build scripts. Cloning an untrusted repository
and running `specbridge verify` can execute code from that repository if it contains custom
verifiers. Review `.specbridge/verifiers/` before running verification on third-party or
untrusted code, protect changes to that directory with code review, and run verification in a
restricted CI/container environment when repository trust is unclear.

Advanced sandboxing for custom verifiers is planned, but current releases do not isolate plugin
execution.

## Disclosure Policy

When we receive a security report, we will:

1. Confirm the issue and determine affected versions
2. Develop and test a fix
3. Release a patch as soon as possible
4. Credit the reporter (unless they prefer to remain anonymous)

## Contact

For security concerns, use GitHub Private Vulnerability Reporting:
https://github.com/nouatzi/specbridge/security/advisories
