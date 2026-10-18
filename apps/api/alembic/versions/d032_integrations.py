"""Add chat, assets, optional verification and durable delivery records."""
from alembic import op
import sqlalchemy as sa

revision = "d032_integrations"
down_revision = "c921_email_delivery"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("chat_messages",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("pairing_id", sa.String(40), sa.ForeignKey("pairings.id"), nullable=False),
        sa.Column("author_id", sa.String(40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("client_id", sa.String(80), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("pairing_id", "author_id", "client_id", name="uq_chat_client_message"))
    op.create_index("ix_chat_messages_pairing_id", "chat_messages", ["pairing_id"])
    op.create_index("ix_chat_messages_created_at", "chat_messages", ["created_at"])
    op.create_table("realtime_events",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("channel", sa.String(180), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("dispatch_after", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False))
    op.create_table("assets",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("owner_id", sa.String(40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("object_key", sa.String(250), nullable=False, unique=True),
        sa.Column("content_type", sa.String(80), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_assets_owner_id", "assets", ["owner_id"])
    op.create_table("verification_sessions",
        sa.Column("id", sa.String(80), primary_key=True),
        sa.Column("user_id", sa.String(40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("workflow_id", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("provider_updated_at", sa.Integer(), server_default="0", nullable=False))
    op.create_index("ix_verification_sessions_user_id", "verification_sessions", ["user_id"])
    op.create_table("webhook_receipts",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False))


def downgrade():
    for table in ("webhook_receipts", "verification_sessions", "assets", "realtime_events", "chat_messages"):
        op.drop_table(table)
