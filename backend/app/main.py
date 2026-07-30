from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import Base, engine
from app.routes.upload import router as upload_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DataSense AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "DataSense AI backend is running",
    }


@app.get("/database/health")
def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "ok",
            "message": "SQLite database is connected",
            "dataset_table": "datasets",
        }
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        )
@app.get("/")
def home():
    return {
        "message": "Welcome to DataSense AI Backend",
        "docs": "/docs",
        "health": "/health"
    }