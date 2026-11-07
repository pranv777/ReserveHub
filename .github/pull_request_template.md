## What & why

## Checklist
- [ ] Backend: `ruff check .`, `mypy app`, `pytest` pass
- [ ] Frontend: `npm run lint && npm run typecheck && npm test && npm run build` pass
- [ ] New schema changes have an Alembic revision AND a matching `database/sql/migrations/*.sql` (and enable RLS on any new table)
- [ ] Docs updated (README / docs/*)
- [ ] No secrets committed
