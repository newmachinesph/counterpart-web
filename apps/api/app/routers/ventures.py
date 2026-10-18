from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import current_user, require_role
from app.db import get_db
from app.models import User
from app.schemas import BenchCardOut, VentureIn, VentureOut
from app.services import ventures as svc

router = APIRouter(tags=["ventures"])


@router.get("/bench", response_model=list[BenchCardOut])
def bench(category: str | None = None, stage: str | None = None, equity_min: float | None = None, equity_max: float | None = None, hours_max: int | None = None, db: Session = Depends(get_db)):
    return [{"venture": c["venture"], "applicant_count": c["applicant_count"], "total_on_offer_pct": c["total_on_offer_pct"]} for c in svc.list_bench(db, category, stage, equity_min, equity_max, hours_max)]


@router.get("/ventures/{slug}", response_model=VentureOut)
def venture(slug: str, db: Session = Depends(get_db)):
    v = svc.get_by_slug(db, slug)
    if v.status not in ("published", "development"):
        # drafts are invisible unless you manage them; keep it simple: 404
        from app.services.common import NotFound
        raise NotFound("Venture not found")
    return v


@router.post("/ventures", response_model=VentureOut, status_code=201)
def create(body: VentureIn, user: User = Depends(require_role("builder")), db: Session = Depends(get_db)):
    return svc.create(db, user, body.model_dump())


@router.post("/ventures/{venture_id}/publish", response_model=VentureOut)
def publish(venture_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.publish(db, user, venture_id)


@router.post("/ventures/{venture_id}/unpublish", response_model=VentureOut)
def unpublish(venture_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.unpublish(db, user, venture_id)
