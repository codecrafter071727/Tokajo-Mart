## What and why

<!-- One or two sentences. Link the issue/ticket. -->

## Checklist

- [ ] Tests added or updated
- [ ] Migration included and reversible (expand → migrate → contract)
- [ ] `@qc/contracts` updated for any changed DTO, enum, error code or event
- [ ] OpenAPI / `@qc/api-client` regenerated (`pnpm gen:api`)
- [ ] Events versioned if a payload changed (new `eventVersion` + dual-publish window)
- [ ] `docs/ARCHITECTURE.md` / ADR updated if this contradicts it
