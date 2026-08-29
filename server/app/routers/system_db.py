import os
import glob
import re
import shutil
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel

from ..database import (
    DATA_DIR,
    PROD_DB_PATH,
    TESTING_DB_PATH,
    get_active_mode,
    set_active_mode,
    get_active_db_path,
    flush_and_checkpoint_db,
    dispose_engines,
    dispose_engine_for_path,
    calculate_db_hash
)


router = APIRouter(prefix="/system/db", tags=["system-database"])

# Regex pattern for snapshot filenames: Sidekick_YYYY-MM-DD_HHMMSS.db
SNAPSHOT_PATTERN = r"^Sidekick_\d{4}-\d{2}-\d{2}_\d{6}\.db$"

SNAPSHOTS_DIR = os.path.join(DATA_DIR, "snapshots")
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

class ModeSwitchRequest(BaseModel):
    mode: str  # "prod" or "testing"
    copy_prod_to_testing: bool = False

class RestoreRequest(BaseModel):
    create_snapshot_first: bool = False

def run_migrations_on_db(db_path: str):
    """Run Alembic migrations programmatically against a target SQLite database file."""
    try:
        from alembic.config import Config
        from alembic import command
        
        alembic_ini = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "alembic.ini")
        if os.path.exists(alembic_ini):
            alembic_cfg = Config(alembic_ini)
            # Temporarily point sqlalchemy.url in alembic_cfg to target db_path
            alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{os.path.normpath(db_path)}")
            command.upgrade(alembic_cfg, "head")
    except Exception as e:
        print(f"Alembic migration warning for {db_path}: {e}")

def get_snapshot_files() -> List[dict]:
    """Glob and parse all snapshot files in data/snapshots directory sorted newest first."""
    snapshots = []
    pattern = os.path.join(SNAPSHOTS_DIR, "Sidekick_*.db")
    filepaths = glob.glob(pattern)

    
    for filepath in filepaths:
        filename = os.path.basename(filepath)
        if re.match(SNAPSHOT_PATTERN, filename):
            try:
                stat = os.stat(filepath)
                # Parse timestamp from filename: Sidekick_YYYY-MM-DD_HHMMSS.db
                parts = filename.replace(".db", "").split("_")
                created_str = f"{parts[1]} {parts[2][:2]}:{parts[2][2:4]}:{parts[2][4:6]}"
                db_hash = calculate_db_hash(filepath)
                
                snapshots.append({
                    "filename": filename,
                    "filepath": filepath,
                    "created_at": created_str,
                    "mtime": stat.st_mtime,
                    "size_bytes": stat.st_size,
                    "hash": db_hash
                })
            except Exception as e:
                print(f"Error processing snapshot {filename}: {e}")
                
    # Sort reverse chronologically by timestamp filename (newest first)
    snapshots.sort(key=lambda x: x["filename"], reverse=True)
    return snapshots


@router.get("/status")
def get_db_status():
    """Retrieve active DB mode, active database file path, latest snapshot details, and change status."""
    active_mode = get_active_mode()
    active_db_path = get_active_db_path()
    active_hash = calculate_db_hash(active_db_path)
    
    snapshots = get_snapshot_files()
    latest_snapshot = snapshots[0] if snapshots else None
    
    # Determine if current active DB differs from latest snapshot
    has_changes = True
    if latest_snapshot and latest_snapshot.get("hash") and active_hash:
        has_changes = (active_hash != latest_snapshot.get("hash"))

    return {
        "active_mode": active_mode,
        "active_db_file": os.path.basename(active_db_path),
        "active_db_path": active_db_path,
        "active_db_hash": active_hash,
        "latest_snapshot": latest_snapshot,
        "has_changes_since_snapshot": has_changes
    }

@router.post("/mode")
def switch_db_mode(req: ModeSwitchRequest):
    """Switch active database mode between 'prod' and 'testing'. Optionally copy prod -> testing."""
    if req.mode not in ["prod", "testing"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mode. Must be 'prod' or 'testing'."
        )

    try:
        flush_and_checkpoint_db()
        dispose_engines()
        
        if req.mode == "testing":
            # If testing database does not exist or user explicitly requested copy
            if req.copy_prod_to_testing or not os.path.exists(TESTING_DB_PATH):
                if os.path.exists(PROD_DB_PATH):
                    shutil.copy2(PROD_DB_PATH, TESTING_DB_PATH)
            
            run_migrations_on_db(TESTING_DB_PATH)
            set_active_mode("testing")
            msg = "Switched to Testing Sandbox mode (sidekick_testing.db)."
            if req.copy_prod_to_testing:
                msg = "Copied Production database to Testing sandbox and switched modes."
        else:
            if os.path.exists(PROD_DB_PATH):
                run_migrations_on_db(PROD_DB_PATH)
            set_active_mode("prod")
            msg = "Switched to Production mode (sidekick.db)."

        return {
            "status": "success",
            "message": msg,
            "active_mode": get_active_mode(),
            "active_db_file": os.path.basename(get_active_db_path())
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to switch database mode: {str(e)}"
        )

@router.get("/snapshots")
def list_snapshots():
    """List all available database snapshots stored in the data/snapshots directory."""
    return get_snapshot_files()

@router.post("/snapshots")
def create_snapshot():
    """Flush the active database and copy it to a new snapshot file in data/snapshots/: Sidekick_YYYY-MM-DD_HHMMSS.db."""
    try:
        active_path = get_active_db_path()
        if not os.path.exists(active_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Active database file not found at {active_path}."
            )
            
        flush_and_checkpoint_db(active_path)
        dispose_engines()
        
        now_str = datetime.now().strftime("Sidekick_%Y-%m-%d_%H%M%S.db")
        snapshot_path = os.path.join(SNAPSHOTS_DIR, now_str)
        
        shutil.copy2(active_path, snapshot_path)
        
        # Calculate hash of new snapshot
        new_hash = calculate_db_hash(snapshot_path)
        stat = os.stat(snapshot_path)
        
        parts = now_str.replace(".db", "").split("_")
        created_str = f"{parts[1]} {parts[2][:2]}:{parts[2][2:4]}:{parts[2][4:6]}"

        return {
            "status": "success",
            "message": f"Database snapshot created: {now_str}",
            "snapshot": {
                "filename": now_str,
                "filepath": snapshot_path,
                "created_at": created_str,
                "size_bytes": stat.st_size,
                "hash": new_hash
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create snapshot: {str(e)}"
        )

@router.delete("/snapshots/{filename}")
def delete_snapshot(filename: str):
    """Delete a snapshot file from disk."""
    if not re.match(SNAPSHOT_PATTERN, filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid snapshot filename pattern."
        )
        
    snapshot_path = os.path.join(SNAPSHOTS_DIR, filename)
    if not os.path.exists(snapshot_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Snapshot file {filename} not found."
        )
        
    try:
        dispose_engine_for_path(snapshot_path)
        dispose_engines()
        os.remove(snapshot_path)
        return {
            "status": "success",
            "message": f"Snapshot file '{filename}' was deleted successfully."
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete snapshot file: {str(e)}"
        )

@router.post("/snapshots/{filename}/restore")
def restore_snapshot(filename: str, req: RestoreRequest):
    """Restore target snapshot file into production database (sidekick.db), run migrations, and switch to prod."""
    if not re.match(SNAPSHOT_PATTERN, filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid snapshot filename pattern."
        )
        
    snapshot_path = os.path.join(SNAPSHOTS_DIR, filename)
    if not os.path.exists(snapshot_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Snapshot file '{filename}' not found."
        )

    try:
        flush_and_checkpoint_db()
        dispose_engines()

        # Optionally create a safety snapshot of current active DB first
        if req.create_snapshot_first and os.path.exists(PROD_DB_PATH):
            now_str = datetime.now().strftime("Sidekick_%Y-%m-%d_%H%M%S.db")
            safety_path = os.path.join(SNAPSHOTS_DIR, now_str)
            shutil.copy2(PROD_DB_PATH, safety_path)

        # Overwrite Production DB with snapshot file
        shutil.copy2(snapshot_path, PROD_DB_PATH)
        
        # Run Alembic migrations on Production DB
        run_migrations_on_db(PROD_DB_PATH)
        
        # Mount and switch system mode to production
        set_active_mode("prod")

        return {
            "status": "success",
            "message": f"Production database restored from snapshot '{filename}' and migrations applied successfully.",
            "active_mode": "prod",
            "active_db_file": os.path.basename(PROD_DB_PATH)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restore snapshot: {str(e)}"
        )

