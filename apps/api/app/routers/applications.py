from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.models import User
from app.schemas import ApplicationIn, ApplicationOut, ReviewIn
from app.services import applications as svc
from app.services import ventures

router = APIRouter(tags=["applications"])


@router.post("/ventures/{slug}/applications", response_model=ApplicationOut, status_code=201)
def submit(slug: str, body: ApplicationIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = ventures.get_by_slug(db, slug)
    return svc.submit(db, user, v, body.model_dump())


@router.get("/ventures/{slug}/applications", response_model=list[ApplicationOut])
def queue(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = ventures.get_by_slug(db, slug)
    return svc.list_for_venture(db, user, v)


@router.post("/applications/{application_id}/review", response_model=ApplicationOut)
def review(application_id: str, body: ReviewIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.review(db, user, application_id, body.action)