"""Install reference content only. Never create users, ventures or activity."""
from sqlalchemy.dialects.postgresql import insert
from app.db import SessionLocal
from app.models import TermsTemplate
from app.domain.contracts import OPERATOR_TEMPLATE


def bootstrap():
    with SessionLocal() as db:
        db.execute(insert(TermsTemplate).values(**OPERATOR_TEMPLATE).on_conflict_do_nothing(index_elements=["id"]))
        db.execute(insert(TermsTemplate).values(
            id="terms_v0", title="Counterpart pairing agreement (template v0)",
            review_note="Placeholder content. It requires review by a Philippine corporate lawyer before anyone signs it.",
            sections=[
                {"heading": "Proving run", "body": "The proving run lasts [PROVING_RUN_DAYS] days. No equity accrues during it."},
                {"heading": "No clawback", "body": "Equity that has vested is never reduced. [COUNSEL_TO_CONFIRM_ENFORCEABILITY]"},
            ],
        ).on_conflict_do_nothing(index_elements=["id"]))
        db.commit()


if __name__ == "__main__":
    bootstrap()
    from app.config import settings
    if settings.s3_access_key_id:
        from app.routers.assets import ensure_bucket
        ensure_bucket()
