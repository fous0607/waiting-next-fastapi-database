"""Add keypad style settings to store_settings

Revision ID: add_keypad_settings
Create Date: 2025-12-09

"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    # Add keypad_style column
    op.add_column('store_settings', 
        sa.Column('keypad_style', sa.String(), nullable=True, server_default='modern')
    )
    
    # Add keypad_font_size column
    op.add_column('store_settings',
        sa.Column('keypad_font_size', sa.String(), nullable=True, server_default='large')
    )
    
    # Update existing rows to have default values
    op.execute("UPDATE store_settings SET keypad_style = 'modern' WHERE keypad_style IS NULL")
    op.execute("UPDATE store_settings SET keypad_font_size = 'large' WHERE keypad_font_size IS NULL")


def downgrade():
    op.drop_column('store_settings', 'keypad_font_size')
    op.drop_column('store_settings', 'keypad_style')
