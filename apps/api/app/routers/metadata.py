import http.client
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.auth import require_role
from app.models import User
from app.services.metadata import fetch_metadata
from app.services.rate_limit import check

router = APIRouter()

class PreviewIn(BaseModel):
    url: str = Field(min_length=8, max_length=2000)

@router.post("/website-preview")
def preview(body: PreviewIn, user: User = Depends(require_role("builder"))):
    check("website-preview", user.id, 10)
    try:
        return fetch_metadata(body.url)
    except (OSError, ValueError, http.client.HTTPException):
        raise HTTPException(422, "No website preview found. You can upload an image or paste its URL.")
