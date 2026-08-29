# Rule: Mandatory Alembic Database Migrations

Whenever modifying SQLAlchemy database models in `server/app/models.py` (such as adding, altering, or removing tables, columns, indexes, or constraints), you MUST automatically:

1. **Generate an Alembic Migration Script:** Create a new timestamped migration file in `server/alembic/versions/` with `upgrade()` and `downgrade()` functions reflecting the exact SQL changes.
2. **Update Documentation:** Update `docs/inventory_database_schema.md` to reflect the updated database tables and columns.

Never modify `server/app/models.py` without defining a corresponding Alembic migration script.
