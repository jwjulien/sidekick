"""Add storage lifecycle timestamps (first_added, last_stocked, last_used)

Revision ID: 8a1b2c3d4e5f
Revises: 7c9e01f28b43
Create Date: 2026-09-21 22:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a1b2c3d4e5f'
down_revision: Union[str, Sequence[str], None] = '7c9e01f28b43'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('storage', schema=None) as batch_op:
        batch_op.add_column(sa.Column('first_added', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('last_stocked', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('last_used', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('storage', schema=None) as batch_op:
        batch_op.drop_column('last_used')
        batch_op.drop_column('last_stocked')
        batch_op.drop_column('first_added')
