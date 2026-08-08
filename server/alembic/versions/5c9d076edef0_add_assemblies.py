"""Add assemblies

Revision ID: 5c9d076edef0
Revises: 0ac2ca7a47c1
Create Date: 2026-08-08 13:10:30.644570

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5c9d076edef0'
down_revision: Union[str, Sequence[str], None] = '0ac2ca7a47c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create assemblies table
    op.create_table('assemblies',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_on', sa.DateTime(), nullable=False),
    sa.Column('modified_on', sa.DateTime(), nullable=True),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_assemblies_id'), 'assemblies', ['id'], unique=False)
    
    # 2. Add assembly_id column to revisions
    with op.batch_alter_table('revisions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('assembly_id', sa.Integer(), nullable=True))

    # 3. Data migration: Create default assemblies and update revisions
    connection = op.get_bind()
    projects = connection.execute(sa.text("SELECT DISTINCT project_id FROM revisions")).fetchall()
    
    for row in projects:
        project_id = row[0]
        # create assembly for this project
        result = connection.execute(sa.text(
            "INSERT INTO assemblies (created_on, modified_on, project_id, name) "
            "VALUES (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, :project_id, 'default') "
            "RETURNING id"
        ), {"project_id": project_id})
        assembly_id = result.fetchone()[0]
        
        # update revisions to point to this assembly
        connection.execute(sa.text(
            "UPDATE revisions SET assembly_id = :assembly_id WHERE project_id = :project_id"
        ), {"assembly_id": assembly_id, "project_id": project_id})

    # 4. Drop old column and add FK constraint
    # Note: SQLite drops are best handled by batch_alter_table
    with op.batch_alter_table('revisions', schema=None) as batch_op:
        # Recreate table without project_id and with proper NOT NULL and FK
        batch_op.alter_column('assembly_id', existing_type=sa.Integer(), nullable=False)
        batch_op.drop_column('project_id')
        batch_op.create_foreign_key('fk_revisions_assembly_id', 'assemblies', ['assembly_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    # 1. Revert revisions table
    with op.batch_alter_table('revisions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('project_id', sa.Integer(), nullable=True))
        batch_op.drop_constraint('fk_revisions_assembly_id', type_='foreignkey')
        batch_op.create_foreign_key('fk_revisions_project_id', 'projects', ['project_id'], ['id'], ondelete='CASCADE')

    # Data migration backwards
    connection = op.get_bind()
    revisions = connection.execute(sa.text("SELECT id, assembly_id FROM revisions")).fetchall()
    for rev in revisions:
        rev_id, assembly_id = rev
        # get project_id from assembly
        result = connection.execute(sa.text(
            "SELECT project_id FROM assemblies WHERE id = :assembly_id"
        ), {"assembly_id": assembly_id}).fetchone()
        if result:
            project_id = result[0]
            connection.execute(sa.text(
                "UPDATE revisions SET project_id = :project_id WHERE id = :id"
            ), {"project_id": project_id, "id": rev_id})

    # Finish reverting revisions table
    with op.batch_alter_table('revisions', schema=None) as batch_op:
        batch_op.alter_column('project_id', existing_type=sa.Integer(), nullable=False)
        batch_op.drop_column('assembly_id')

    # Drop assemblies table
    op.drop_index(op.f('ix_assemblies_id'), table_name='assemblies')
    op.drop_table('assemblies')
