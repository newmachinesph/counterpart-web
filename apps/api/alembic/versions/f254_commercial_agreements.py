"""Accepted commercial agreements; preserve all historical records."""
from alembic import op
import sqlalchemy as sa

revision = "f254_commercial_agreements"
down_revision = "e143_venture_logo"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("platform_terms_version", sa.String(40)))
    op.add_column("ventures", sa.Column("commercial_terms", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("openings", sa.Column("compensation_details", sa.Text(), nullable=False, server_default=""))
    op.add_column("job_applications", sa.Column("offer_snapshot", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("pairings", sa.Column("application_id", sa.String(40), sa.ForeignKey("applications.id")))
    op.add_column("pairings", sa.Column("protocol", sa.String(30), nullable=False, server_default="legacy"))
    for column in ("offered_at", "accepted_at", "continuation_requested_at"):
        op.add_column("pairings", sa.Column(column, sa.DateTime(timezone=True)))
    op.add_column("pairings", sa.Column("agreement", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("pairings", sa.Column("milestone_snapshot", sa.JSON(), nullable=False, server_default="[]"))
    op.execute("""
        CREATE TABLE account_tokens (token_hash VARCHAR(64) PRIMARY KEY, user_id VARCHAR(40) NOT NULL REFERENCES users(id), purpose VARCHAR(20) NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ);
        CREATE INDEX ix_account_tokens_user_id ON account_tokens(user_id);
        CREATE TABLE ledger_revisions (id VARCHAR(40) PRIMARY KEY, entry_id VARCHAR(40) NOT NULL REFERENCES ledger_entries(id), author_id VARCHAR(40) NOT NULL REFERENCES users(id), snapshot JSON NOT NULL, created_at TIMESTAMPTZ NOT NULL);
        CREATE INDEX ix_ledger_revisions_entry_id ON ledger_revisions(entry_id);
        CREATE TABLE review_cases (id VARCHAR(40) PRIMARY KEY, pairing_id VARCHAR(40) NOT NULL REFERENCES pairings(id), opened_by VARCHAR(40) NOT NULL REFERENCES users(id), message TEXT NOT NULL, status VARCHAR(20) NOT NULL, resolution TEXT, resolved_by VARCHAR(40) REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL, resolved_at TIMESTAMPTZ);
        CREATE INDEX ix_review_cases_pairing_id ON review_cases(pairing_id);
        CREATE TABLE commercial_deals (id VARCHAR(40) PRIMARY KEY, pairing_id VARCHAR(40) NOT NULL REFERENCES pairings(id), reference VARCHAR(120) NOT NULL, evidence TEXT NOT NULL, registered_at TIMESTAMPTZ NOT NULL, CONSTRAINT uq_deal_reference UNIQUE(pairing_id, reference));
        CREATE INDEX ix_commercial_deals_pairing_id ON commercial_deals(pairing_id);
        CREATE TABLE compensation_claims (id VARCHAR(40) PRIMARY KEY, pairing_id VARCHAR(40) NOT NULL REFERENCES pairings(id), deal_id VARCHAR(40) REFERENCES commercial_deals(id), kind VARCHAR(20) NOT NULL, reference VARCHAR(120) NOT NULL, collected_at TIMESTAMPTZ NOT NULL, eligible_revenue_php NUMERIC(16,2) NOT NULL, amount_php NUMERIC(16,2) NOT NULL, evidence TEXT NOT NULL, status VARCHAR(30) NOT NULL, due_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL, events JSON NOT NULL, CONSTRAINT uq_claim_reference UNIQUE(pairing_id,reference));
        CREATE INDEX ix_compensation_claims_pairing_id ON compensation_claims(pairing_id);
        CREATE TABLE equity_grants (id VARCHAR(40) PRIMARY KEY, pairing_id VARCHAR(40) NOT NULL REFERENCES pairings(id), venture_id VARCHAR(40) NOT NULL REFERENCES ventures(id), terms JSON NOT NULL, status VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL, accepted_at TIMESTAMPTZ);
        CREATE INDEX ix_equity_grants_pairing_id ON equity_grants(pairing_id);
        CREATE INDEX ix_equity_grants_venture_id ON equity_grants(venture_id);
    """)
    # Snapshot existing schedules before future activity; do not overwrite grants or rights.
    op.execute("""UPDATE pairings p SET milestone_snapshot = COALESCE((SELECT json_agg(row_to_json(m) ORDER BY m.sequence) FROM milestones m WHERE m.venture_id = p.venture_id), '[]'::json)""")


def downgrade():
    raise RuntimeError("This migration preserves accepted agreements and payment history. Roll forward; do not drop financial records.")
