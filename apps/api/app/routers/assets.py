from io import BytesIO

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.auth import require_role
from app.config import settings
from app.db import get_db
from app.models import Asset, User
from app.services.common import new_id, now_utc
from app.services.rate_limit import check

router = APIRouter(tags=["assets"])
MAX_BYTES = 4 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 16_000_000


def storage():
    if not settings.s3_access_key_id or not settings.s3_secret_access_key:
        raise HTTPException(503, "Image uploads are not configured")
    return boto3.client("s3", endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id, aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region, config=Config(signature_version="s3v4", connect_timeout=5, read_timeout=15, s3={"addressing_style": "path"}))


def ensure_bucket():
    client = storage()
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
    except ClientError as error:
        if error.response["Error"]["Code"] not in ("404", "NoSuchBucket", "NotFound"):
            raise
        client.create_bucket(Bucket=settings.s3_bucket)


@router.post("/assets", status_code=201)
async def upload(file: UploadFile = File(...), user: User = Depends(require_role("builder")), db: Session = Depends(get_db)):
    check("upload", user.id, 12)
    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "Images must be 4 MB or smaller")
    try:
        with Image.open(BytesIO(raw)) as picture:
            if picture.format not in ("PNG", "JPEG", "WEBP") or picture.width * picture.height > Image.MAX_IMAGE_PIXELS:
                raise ValueError()
            picture.load()
            cleaned = picture.convert("RGBA" if picture.mode in ("RGBA", "LA") else "RGB")
            output = BytesIO()
            cleaned.save(output, format="WEBP", quality=88)
            content = output.getvalue()
    except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, "Choose a PNG, JPEG or WebP image under 16 megapixels")
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "Please use a smaller image")
    identifier = new_id("asset")
    key = f"screenshots/{user.id}/{identifier}.webp"
    client = storage()
    try:
        client.put_object(Bucket=settings.s3_bucket, Key=key, Body=content, ContentType="image/webp")
        db.add(Asset(id=identifier, owner_id=user.id, object_key=key, content_type="image/webp", size=len(content), created_at=now_utc()))
        db.commit()
    except (BotoCoreError, ClientError):
        db.rollback()
        raise HTTPException(503, "Image storage is temporarily unavailable")
    url = f"{settings.s3_public_url.rstrip('/')}/{key}" if settings.s3_public_url else f"{settings.public_api_url}/assets/{identifier}"
    return {"id": identifier, "url": url, "size": len(content)}


@router.get("/assets/{asset_id}")
def image(asset_id: str, db: Session = Depends(get_db)):
    """Public venture screenshots only; identity documents are never uploaded here."""
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Image not found")
    try:
        response = storage().get_object(Bucket=settings.s3_bucket, Key=asset.object_key)
    except (BotoCoreError, ClientError):
        raise HTTPException(503, "Image storage is temporarily unavailable")
    stream = response["Body"]
    def chunks():
        try:
            yield from stream.iter_chunks(chunk_size=65536)
        finally:
            stream.close()
    return StreamingResponse(chunks(), media_type=asset.content_type, headers={
        "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'", "Content-Length": str(asset.size)})
