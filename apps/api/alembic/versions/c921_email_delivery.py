"""Track SMTP delivery without replaying historical outbox records."""
from alembic import op
import sqlalchemy as sa

revision = "c921_email_delivery"
down_revision = "b810_session_auth"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("outbox_emails", sa.Column("dispatch_after", sa.DateTime(timezone=True), nullable=True))
    op.add_column("outbox_emails", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("outbox_emails", sa.Column("attempts", sa.Integer(), server_default="0", nullable=False))
    op.add_column("outbox_emails", sa.Column("last_error", sa.String(200), nullable=True))


def downgrade():
    for column in ("last_error", "attempts", "delivered_at", "dispatch_after"):
        op.drop_column("outbox_emails", column)
