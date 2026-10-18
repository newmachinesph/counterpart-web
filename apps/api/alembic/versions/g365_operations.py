"""Extend review cases into the operations queue without replacing existing cases."""
from alembic import op
import sqlalchemy as sa

revision = "g365_operations"
down_revision = "f254_commercial_agreements"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ventures", sa.Column("moderation_hold", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column("review_cases", "pairing_id", existing_type=sa.String(40), nullable=True)
    op.add_column("review_cases", sa.Column("venture_id", sa.String(40), sa.ForeignKey("ventures.id")))
    op.add_column("review_cases", sa.Column("category", sa.String(20), nullable=False, server_default="dispute"))
    op.add_column("review_cases", sa.Column("subject", sa.String(160), nullable=False, server_default="Engagement review"))
    op.add_column("review_cases", sa.Column("assigned_to", sa.String(40), sa.ForeignKey("users.id")))
    op.add_column("review_cases", sa.Column("events", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("review_cases", sa.Column("version", sa.Integer(), nullable=False, server_default="0"))
    for column in ("venture_id", "category", "assigned_to"):
        op.create_index(f"ix_review_cases_{column}", "review_cases", [column])


def downgrade():
    raise RuntimeError("Operations cases contain support history; restore a reviewed backup instead of dropping records.")
