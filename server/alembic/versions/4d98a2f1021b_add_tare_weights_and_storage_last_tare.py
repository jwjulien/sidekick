"""Add tare weights table and storage last_tare_id column

Revision ID: 4d98a2f1021b
Revises: b5e28a9947fd
Create Date: 2026-08-24 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d98a2f1021b'
down_revision: Union[str, Sequence[str], None] = 'b5e28a9947fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'tare_weights',
        sa.Column('id', sa.String(length=36), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('weight', sa.Float(), nullable=False),
        sa.Column('created_on', sa.DateTime(), nullable=False, server_default=sa.text('(CURRENT_TIMESTAMP)')),
        sa.Column('modified_on', sa.DateTime(), nullable=True, server_default=sa.text('(CURRENT_TIMESTAMP)')),
    )
    with op.batch_alter_table('storage', schema=None) as batch_op:
        batch_op.add_column(sa.Column('last_tare_id', sa.String(length=36), sa.ForeignKey('tare_weights.id', name='fk_storage_last_tare_id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('storage', schema=None) as batch_op:
        batch_op.drop_column('last_tare_id')

    op.drop_table('tare_weights')
