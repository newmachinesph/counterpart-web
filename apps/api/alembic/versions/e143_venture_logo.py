"""Optional project logo. Existing ventures are preserved."""
from alembic import op
import sqlalchemy as sa
revision = "e143_venture_logo"
down_revision = "d032_integrations"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("ventures", sa.Column("logo_url", sa.String(2000), nullable=True))

def downgrade():
    op.drop_column("ventures", "logo_url")
