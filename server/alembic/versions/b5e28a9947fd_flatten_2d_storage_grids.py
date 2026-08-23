"""Flatten 2D storage grids by removing intermediate row containers

Revision ID: b5e28a9947fd
Revises: 13619e4c106a
Create Date: 2026-08-23 14:48:00.000000

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5e28a9947fd'
down_revision: Union[str, Sequence[str], None] = '13619e4c106a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database data to flatten 2D storage locations."""
    bind = op.get_bind()
    
    # Query all storage locations that have dimensions defined
    storages = bind.execute(sa.text("SELECT id, dimensions FROM storage WHERE dimensions IS NOT NULL")).fetchall()
    
    for storage_row in storages:
        storage_id = storage_row[0]
        raw_dims = storage_row[1]
        if not raw_dims:
            continue
        try:
            dims = json.loads(raw_dims) if isinstance(raw_dims, str) else raw_dims
        except Exception:
            continue

        if isinstance(dims, list) and len(dims) == 2:
            cols, rows = dims[0], dims[1]
            
            # Find intermediate row children
            row_children = bind.execute(
                sa.text("SELECT id, `index` FROM storage WHERE parent_id = :parent_id"),
                {"parent_id": storage_id}
            ).fetchall()
            
            for row_child in row_children:
                row_id, row_idx = row_child[0], row_child[1]
                
                # Find grandchildren (cells) under row_child
                cell_children = bind.execute(
                    sa.text("SELECT id, `index` FROM storage WHERE parent_id = :parent_id"),
                    {"parent_id": row_id}
                ).fetchall()
                
                for cell in cell_children:
                    cell_id, col_idx = cell[0], cell[1]
                    flat_idx = (row_idx * cols) + col_idx
                    
                    # Update cell to have grid as direct parent and flat index
                    bind.execute(
                        sa.text("UPDATE storage SET parent_id = :grid_id, `index` = :flat_idx WHERE id = :cell_id"),
                        {"grid_id": storage_id, "flat_idx": flat_idx, "cell_id": cell_id}
                    )
                
                # Delete intermediate row container node
                bind.execute(
                    sa.text("DELETE FROM storage WHERE id = :row_id"),
                    {"row_id": row_id}
                )


def downgrade() -> None:
    """Downgrade schema / data (no-op since structure is equivalent)."""
    pass
