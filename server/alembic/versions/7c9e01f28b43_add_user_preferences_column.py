"""Add preferences column to users table

Revision ID: 7c9e01f28b43
Revises: 4a7c8e9f10d2
Create Date: 2026-08-28 22:36:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c9e01f28b43'
down_revision: Union[str, Sequence[str], None] = '4a7c8e9f10d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('preferences', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'preferences')
