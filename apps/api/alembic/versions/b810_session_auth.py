"""Add credentials and sessions without changing existing users."""
from alembic import op
import sqlalchemy as sa

revision = "b810_session_auth"
down_revision = "a979f71dcfa1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("account_credentials",
        sa.Column("user_id", sa.String(40), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("password_hash", sa.String(256), nullable=False))
    op.create_table("auth_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])


def downgrade():
    op.drop_table("auth_sessions")
    op.drop_table("account_credentials")
