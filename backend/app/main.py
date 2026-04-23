import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import init_db
from app.api.lessons import router as lessons_router
from app.api.segments import router as segments_router
from app.api.upload import router as upload_router
from app.api.checkpoints import router as checkpoints_router, lesson_checkpoints_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.course_paths import router as course_paths_router
from app.api.courses import router as courses_router, course_lookup_router
from app.api.sections import router as sections_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    await init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="A Scrimba-like interactive code editor and video recording tool API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lessons_router)
app.include_router(segments_router)
app.include_router(checkpoints_router)
app.include_router(lesson_checkpoints_router)
app.include_router(upload_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(course_paths_router)
app.include_router(courses_router)
app.include_router(course_lookup_router)
app.include_router(sections_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
