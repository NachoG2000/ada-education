# .github/ — repository automation

`workflows/ci.yml` installs the locked npm workspace on Node 24 and runs the
same `npm run check` entry point used locally. It runs for pull requests,
pushes to main, and manual dispatch. Provider checks use fake local binaries;
the workflow needs no provider credentials, database, or external service.

Keep permissions read-only and test data disposable. Add coverage through
the existing workspace checks before introducing another CI job or service.
`pull_request_template.md` asks for behavior, validation, and documentation
changes. CI does not deploy or publish packages.
