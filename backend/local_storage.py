"""Local persistent object storage for the standalone D1 Custódia deployment.

Files are stored below STORAGE_ROOT (default: /data/uploads).  The API keeps
using the same logical storage paths already saved in MongoDB, so no frontend
changes are required.
"""

import mimetypes
import os
from pathlib import Path


STORAGE_ROOT = Path(os.environ.get("STORAGE_ROOT", "/data/uploads")).resolve()


def _safe_path(object_path: str) -> Path:
    """Resolve an object path below STORAGE_ROOT and block path traversal."""
    normalized = str(object_path or "").lstrip("/\\")
    target = (STORAGE_ROOT / normalized).resolve()
    if target != STORAGE_ROOT and STORAGE_ROOT not in target.parents:
        raise ValueError("Invalid storage path")
    return target


def init_storage() -> str:
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    return str(STORAGE_ROOT)


def put_object(path: str, data: bytes, content_type: str = "application/octet-stream") -> dict:
    init_storage()
    target = _safe_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return {
        "path": str(path).lstrip("/\\"),
        "size": len(data),
        "content_type": content_type,
    }


def get_object(path: str) -> tuple[bytes, str]:
    target = _safe_path(path)
    if not target.is_file():
        raise FileNotFoundError(path)
    content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return target.read_bytes(), content_type


def delete_object(path: str) -> bool:
    """Best-effort delete. Missing files are considered successfully removed."""
    try:
        target = _safe_path(path)
        if target.exists():
            target.unlink()

        # Remove empty object folders without ever deleting STORAGE_ROOT itself.
        parent = target.parent
        while parent != STORAGE_ROOT and STORAGE_ROOT in parent.parents:
            try:
                parent.rmdir()
            except OSError:
                break
            parent = parent.parent
        return True
    except Exception:
        return False
