"""One-time migration of legacy photos from Emergent Object Storage.

Run only during cutover and provide EMERGENT_LLM_KEY as a temporary environment
variable. The key is never written to disk by this script.

The Mongo database must already contain the custody/photo records to migrate.
"""

import os
from pathlib import Path

import requests
from pymongo import MongoClient


STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "d1_custodia")
STORAGE_ROOT = Path(os.environ.get("STORAGE_ROOT", "/data/uploads")).resolve()


def safe_target(object_path: str) -> Path:
    target = (STORAGE_ROOT / str(object_path).lstrip("/\\")).resolve()
    if target != STORAGE_ROOT and STORAGE_ROOT not in target.parents:
        raise ValueError(f"Unsafe storage path: {object_path}")
    return target


def main() -> None:
    if not EMERGENT_KEY:
        raise SystemExit("Defina EMERGENT_LLM_KEY temporariamente para executar a migração.")
    if not MONGO_URL:
        raise SystemExit("MONGO_URL não definido.")

    init = requests.post(
        f"{STORAGE_URL}/init",
        json={"emergent_key": EMERGENT_KEY},
        timeout=30,
    )
    init.raise_for_status()
    storage_key = init.json()["storage_key"]

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

    migrated = 0
    skipped = 0
    failed = 0

    for custody in db.custodies.find({}, {"photos": 1, "shipment_code": 1}):
        for photo in custody.get("photos") or []:
            object_path = photo.get("storage_path")
            if not object_path:
                continue

            target = safe_target(object_path)
            if target.is_file() and target.stat().st_size > 0:
                skipped += 1
                continue

            try:
                response = requests.get(
                    f"{STORAGE_URL}/objects/{object_path}",
                    headers={"X-Storage-Key": storage_key},
                    timeout=60,
                )
                response.raise_for_status()
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(response.content)
                migrated += 1
                print(f"OK  {object_path}")
            except Exception as exc:
                failed += 1
                print(f"ERRO {object_path}: {exc}")

    print("\nMigração concluída")
    print(f"Migradas: {migrated}")
    print(f"Já existentes: {skipped}")
    print(f"Falhas: {failed}")

    if failed:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
