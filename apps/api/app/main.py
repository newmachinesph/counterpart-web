from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.domain.ledger import LedgerValidation, WeekClosed
from app.domain.pairing import IllegalTransition
from app.routers import applications, meta, openings, pairings, ventures
from app.services.common import Forbidden, NotFound, Validation
from app.accounts import router as accounts_router
from app.routers.workspace import router as workspace_router
from app.routers.chat import router as chat_router
from app.routers.assets import router as assets_router
from app.routers.verification import router as verification_router
from app.routers.jobs import router as jobs_router
from app.routers.email_queue import router as email_queue_router
from app.routers.metadata import router as metadata_router
from app.routers.commercial import router as commercial_router
from app.routers.operations import router as operations_router

app = FastAPI(title="Counterpart API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for exc_type, status in ((NotFound, 404), (Forbidden, 403), (Validation, 400), (LedgerValidation, 400), (WeekClosed, 409), (IllegalTransition, 409)):

    def _handler(request: Request, exc: Exception, status=status):
        return JSONResponse(status_code=status, content={"detail": str(exc)})

    app.add_exception_handler(exc_type, _handler)

app.include_router(meta.router)
app.include_router(ventures.router)
app.include_router(applications.router)
app.include_router(pairings.router)
app.include_router(openings.router)
app.include_router(accounts_router)
app.include_router(workspace_router)
app.include_router(chat_router)
app.include_router(assets_router)
app.include_router(verification_router)
app.include_router(jobs_router)
app.include_router(email_queue_router)
app.include_router(metadata_router)
app.include_router(commercial_router)
app.include_router(operations_router)
