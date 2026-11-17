from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

db_url = settings.DATABASE_URL
# Handle postgres URLs and enforce psycopg2 driver if unspecified
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

try:
    if "sqlite" in db_url:
        engine = create_engine(
            db_url,
            connect_args={"check_same_thread": False}
        )
    else:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20
        )
except Exception as e:
    print(f"[DB] Failed to initialize {db_url}: {e}. Falling back to SQLite.")
    engine = create_engine(
        "sqlite:///./smart_remote.db",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    try:
        import app.models.entities  # Ensure models are imported
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[DB] init_db warning (will continue): {e}")
