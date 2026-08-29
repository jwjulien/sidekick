import os
import hashlib
from typing import Dict, Optional
from fastapi import Request
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Get absolute path to the project root directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Resolve SQLite file paths inside the data directory
PROD_DB_PATH = os.path.normpath(os.path.join(DATA_DIR, 'sidekick.db'))
TESTING_DB_PATH = os.path.normpath(os.path.join(DATA_DIR, 'sidekick_testing.db'))
SIDEKICK_DB_PATH = PROD_DB_PATH
REFERENCE_DB_PATH = os.path.normpath(os.path.join(DATA_DIR, 'sidekick_reference.db'))
DATABASE_URL = f"sqlite:///{PROD_DB_PATH}"

# Active system database mode: "prod" or "testing"
ACTIVE_MODE: str = "prod"

# Cache of SQLAlchemy engines per DB file path
_engines: Dict[str, any] = {}

def get_engine_for_path(db_path: str):
    db_path = os.path.normpath(db_path)
    if db_path not in _engines:
        db_url = f"sqlite:///{db_path}"
        connect_args = {"check_same_thread": False}
        _engines[db_path] = create_engine(db_url, connect_args=connect_args)
    return _engines[db_path]

def dispose_engines():
    """Dispose all engines to release file handles before copying or replacing DB files."""
    for eng in list(_engines.values()):
        try:
            eng.dispose()
        except Exception as e:
            print(f"Error disposing engine: {e}")
    _engines.clear()

def flush_and_checkpoint_db(db_path: Optional[str] = None):
    """Flush WAL write-ahead log to disk for the given database file or all active databases."""
    target_paths = [db_path] if db_path else [PROD_DB_PATH, TESTING_DB_PATH]
    for path in target_paths:
        if os.path.exists(path):
            try:
                eng = get_engine_for_path(path)
                with eng.connect() as conn:
                    conn.execute(text("PRAGMA wal_checkpoint(FULL);"))
                    conn.commit()
            except Exception as e:
                print(f"WAL checkpoint warning for {path}: {e}")

def calculate_db_hash(db_path: str) -> Optional[str]:
    """Compute SHA256 hash of a database file after flushing pending WAL writes."""
    if not os.path.exists(db_path):
        return None
    flush_and_checkpoint_db(db_path)
    sha256 = hashlib.sha256()
    try:
        with open(db_path, "rb") as f:
            while chunk := f.read(65536):
                sha256.update(chunk)
        return sha256.hexdigest()
    except Exception as e:
        print(f"Failed to calculate DB hash for {db_path}: {e}")
        return None

def get_active_db_path() -> str:
    global ACTIVE_MODE
    if ACTIVE_MODE == "testing":
        return TESTING_DB_PATH
    return PROD_DB_PATH

def get_active_mode() -> str:
    global ACTIVE_MODE
    return ACTIVE_MODE

def set_active_mode(mode: str) -> str:
    global ACTIVE_MODE
    if mode in ["prod", "testing"]:
        ACTIVE_MODE = mode
    return ACTIVE_MODE

# Default engine export for startup migrations / metadata bindings
engine = get_engine_for_path(PROD_DB_PATH)
Base = declarative_base()

def get_db(request: Request = None):
    target_path = get_active_db_path()
    if request is not None and hasattr(request, "headers"):
        header_mode = request.headers.get("X-Database-Mode") or request.headers.get("x-database-mode")
        if header_mode == "testing":
            target_path = TESTING_DB_PATH
        elif header_mode in ["prod", "production"]:
            target_path = PROD_DB_PATH

    eng = get_engine_for_path(target_path)
    SessionMaker = sessionmaker(autocommit=False, autoflush=False, bind=eng)
    db: Session = SessionMaker()
    try:
        yield db
    finally:
        db.close()


