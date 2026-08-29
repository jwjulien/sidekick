"""Add part_lists and part_list_items tables

Revision ID: 39bdbf1910e6
Revises: 4d98a2f1021b
Create Date: 2026-08-28 20:45:15.835346

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39bdbf1910e6'
down_revision: Union[str, Sequence[str], None] = '4d98a2f1021b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'part_lists',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_on', sa.DateTime(), nullable=False),
        sa.Column('modified_on', sa.DateTime(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(length=50), nullable=False, server_default='General'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_part_lists_id'), 'part_lists', ['id'], unique=False)

    op.create_table(
        'part_list_items',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_on', sa.DateTime(), nullable=False),
        sa.Column('modified_on', sa.DateTime(), nullable=True),
        sa.Column('list_id', sa.String(length=36), nullable=False),
        sa.Column('part_id', sa.String(length=36), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['list_id'], ['part_lists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['part_id'], ['parts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_part_list_items_id'), 'part_list_items', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_part_list_items_id'), table_name='part_list_items')
    op.drop_table('part_list_items')
    op.drop_index(op.f('ix_part_lists_id'), table_name='part_lists')
    op.drop_table('part_lists')
