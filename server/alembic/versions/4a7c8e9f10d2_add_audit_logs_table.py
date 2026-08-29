"""Add audit_logs table

Revision ID: 4a7c8e9f10d2
Revises: 39bdbf1910e6
Create Date: 2026-08-28 21:09:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a7c8e9f10d2'
down_revision: Union[str, Sequence[str], None] = '39bdbf1910e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('part_id', sa.String(length=36), nullable=True),
        sa.Column('location_id', sa.String(length=36), nullable=True),
        sa.Column('project_id', sa.String(length=36), nullable=True),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('entity_id', sa.String(), nullable=False),
        sa.Column('action_type', sa.String(), nullable=False),
        sa.Column('reason_code', sa.String(), nullable=True),
        sa.Column('quantity_change', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('previous_state', sa.JSON(), nullable=True),
        sa.Column('new_state', sa.JSON(), nullable=True),
        sa.Column('method', sa.String(), nullable=True, server_default='manual'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['location_id'], ['storage.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['part_id'], ['parts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_action_type'), 'audit_logs', ['action_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_audit_logs_entity_id'), 'audit_logs', ['entity_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_entity_type'), 'audit_logs', ['entity_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_audit_logs_location_id'), 'audit_logs', ['location_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_part_id'), 'audit_logs', ['part_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_project_id'), 'audit_logs', ['project_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_reason_code'), 'audit_logs', ['reason_code'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_reason_code'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_project_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_part_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_location_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_entity_type'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_entity_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action_type'), table_name='audit_logs')
    op.drop_table('audit_logs')
