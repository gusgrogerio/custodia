from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, File, UploadFile, Query, Header, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
import bcrypt
import jwt
import secrets
import requests
from datetime import datetime, timezone, timedelta
from io import BytesIO
import csv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "default-secret-change-in-production")

# Password hashing
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# JWT Token Management
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Auth Helper
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("is_active") is False:
            raise HTTPException(status_code=401, detail=GENERIC_AUTH_ERROR if "GENERIC_AUTH_ERROR" in globals() else "Inativo")
        user["id"] = str(user["_id"])
        del user["_id"]
        user.pop("password_hash", None)
        # Defaults for legacy users
        user.setdefault("role", "operator")
        user.setdefault("region", None)
        user.setdefault("is_active", True)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Object Storage Configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "d1-custodia"
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("Storage initialized successfully")
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not initialized")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

def delete_object(path: str) -> bool:
    """Best-effort delete from Emergent Object Storage. Never raises."""
    try:
        key = init_storage()
        if not key:
            return False
        resp = requests.delete(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=30
        )
        return resp.status_code in (200, 202, 204, 404)
    except Exception as e:
        logger.warning(f"storage delete failed for {path}: {e}")
        return False

# Create the main app
app = FastAPI(title="D1 Custódia API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class UserLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "operator"          # "admin" | "operator"
    region: Optional[str] = None    # required when role == "operator"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    region: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None  # admin can reset

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str

class CustodyCreate(BaseModel):
    shipment_code: str
    client_name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    region: str = ""  # required at runtime - "São Paulo" or "Guarulhos"
    occurrence_type: str
    observation: Optional[str] = None
    volume_current: int = 1
    volume_total: int = 1

class CustodyUpdate(BaseModel):
    status: Optional[str] = None
    observation: Optional[str] = None
    responsible_id: Optional[str] = None
    region: Optional[str] = None

class BulkUpdateRequest(BaseModel):
    custody_ids: List[str]
    action: str  # mark_returned, update_responsible
    responsible_id: Optional[str] = None

# ---- Auth helpers (RBAC + brute-force + audit) ----

VALID_ROLES = {"admin", "operator"}
VALID_REGIONS = {"São Paulo", "Guarulhos"}
LOCKOUT_MAX_ATTEMPTS = 5
LOCKOUT_WINDOW_MIN = 15
GENERIC_AUTH_ERROR = "Acesso não autorizado. Procure o administrador."

def get_client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

async def log_audit(action: str, *, user: Optional[dict] = None, details: str = "",
                    ip: Optional[str] = None, target_id: Optional[str] = None):
    """Persist an audit log entry. Never fails the request."""
    try:
        await db.audit_logs.insert_one({
            "action": action,
            "user_id": (user or {}).get("id"),
            "user_email": (user or {}).get("email"),
            "user_name": (user or {}).get("name"),
            "details": details,
            "ip": ip,
            "target_id": target_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.warning(f"audit log failed: {e}")

async def is_locked_out(email: str) -> bool:
    """Returns True if 5+ failed attempts in last 15 minutes for this email."""
    window_start = (datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_WINDOW_MIN)).isoformat()
    count = await db.login_attempts.count_documents({
        "email": email,
        "success": False,
        "created_at": {"$gte": window_start}
    })
    return count >= LOCKOUT_MAX_ATTEMPTS

async def record_login_attempt(email: str, ip: str, success: bool):
    await db.login_attempts.insert_one({
        "email": email,
        "ip": ip,
        "success": success,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

async def clear_login_attempts(email: str):
    await db.login_attempts.delete_many({"email": email, "success": False})

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem executar esta ação.")
    return user

def can_modify_region(user: dict, region: str) -> bool:
    """Admins can modify any region; operators only their own."""
    if user.get("role") == "admin":
        return True
    return user.get("region") == region

# Helper function to generate box number
async def generate_box_number() -> str:
    """Generate unique box number in format CX-YYYYMMDD-NNN"""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"CX-{today}-"
    
    # Find the last box number for today
    last_custody = await db.custodies.find_one(
        {"box_number": {"$regex": f"^{prefix}"}},
        sort=[("box_number", -1)]
    )
    
    if last_custody and last_custody.get("box_number"):
        # Extract the sequence number and increment
        try:
            last_seq = int(last_custody["box_number"].split("-")[-1])
            new_seq = last_seq + 1
        except:
            new_seq = 1
    else:
        new_seq = 1
    
    return f"{prefix}{new_seq:03d}"

# Helper to calculate days without treatment
def calculate_days_without_treatment(custody: dict) -> dict:
    """Calculate days since last treatment and return status info"""
    last_treatment = custody.get("last_treatment_at") or custody.get("created_at")
    if isinstance(last_treatment, str):
        last_treatment_dt = datetime.fromisoformat(last_treatment.replace('Z', '+00:00'))
    else:
        last_treatment_dt = last_treatment
    
    now = datetime.now(timezone.utc)
    days_diff = (now - last_treatment_dt).days
    
    return {
        "days_without_treatment": days_diff,
        "days_until_return": max(0, 10 - days_diff),
        "is_near_return": days_diff >= 8,
        "is_ready_for_return": days_diff >= 10,
        "alert_type": "return" if days_diff >= 10 else ("warning" if days_diff >= 8 else None)
    }

class CustodyResponse(BaseModel):
    id: str
    shipment_code: str
    client_name: str
    phone: Optional[str]
    address: Optional[str]
    occurrence_type: str
    observation: Optional[str]
    status: str
    photos: List[dict]
    created_at: str
    updated_at: str
    responsible_id: str
    responsible_name: str
    history: List[dict]

# Auth Endpoints
@api_router.post("/auth/login")
async def login(data: UserLogin, request: Request, response: Response):
    email = data.email.lower().strip()
    ip = get_client_ip(request)
    
    # Brute-force lockout check
    if await is_locked_out(email):
        await log_audit("login_locked", user={"email": email}, ip=ip,
                        details=f"Muitas tentativas inválidas ({LOCKOUT_MAX_ATTEMPTS}+ em {LOCKOUT_WINDOW_MIN}min)")
        raise HTTPException(
            status_code=423,
            detail=f"Conta bloqueada temporariamente após {LOCKOUT_MAX_ATTEMPTS} tentativas inválidas. Aguarde {LOCKOUT_WINDOW_MIN} minutos."
        )
    
    user = await db.users.find_one({"email": email})
    
    # Generic error for any failure (security best practice)
    if not user or not verify_password(data.password, user["password_hash"]):
        await record_login_attempt(email, ip, success=False)
        await log_audit("login_failed", user={"email": email}, ip=ip, details="Credenciais inválidas")
        raise HTTPException(status_code=401, detail=GENERIC_AUTH_ERROR)
    
    # is_active check
    if user.get("is_active") is False:
        await record_login_attempt(email, ip, success=False)
        await log_audit("login_failed", user={"email": email}, ip=ip, details="Usuário inativo")
        raise HTTPException(status_code=401, detail=GENERIC_AUTH_ERROR)
    
    # Success
    await clear_login_attempts(email)
    await record_login_attempt(email, ip, success=True)
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    user_summary = {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "operator"),
        "region": user.get("region"),
    }
    await log_audit("login_success", user=user_summary, ip=ip)
    
    return {**user_summary, "is_active": user.get("is_active", True), "token": access_token}

# Public registration is DISABLED — closed system. Use POST /api/users (admin) instead.
@api_router.post("/auth/register", status_code=403)
async def register_disabled():
    raise HTTPException(
        status_code=403,
        detail="Cadastro público desabilitado. Solicite acesso ao administrador."
    )

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"])
        
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
        
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# Custody Endpoints
@api_router.post("/custodies")
async def create_custody(data: CustodyCreate, request: Request):
    user = await get_current_user(request)
    
    # Validate region
    if data.region not in ("São Paulo", "Guarulhos"):
        raise HTTPException(status_code=400, detail="Região inválida. Selecione 'São Paulo' ou 'Guarulhos'.")
    
    # RBAC: operators can only create in their own region
    if not can_modify_region(user, data.region):
        raise HTTPException(status_code=403, detail=f"Operadores só podem criar custódias em sua região ({user.get('region')}).")
    
    # Generate unique box number
    box_number = await generate_box_number()
    now = datetime.now(timezone.utc).isoformat()
    
    custody_doc = {
        "id": str(uuid.uuid4()),
        "box_number": box_number,
        "shipment_code": data.shipment_code,
        "client_name": data.client_name,
        "phone": data.phone,
        "address": data.address,
        "city": data.city,
        "state": data.state,
        "region": data.region,
        "occurrence_type": data.occurrence_type,
        "observation": data.observation,
        "volume_current": data.volume_current,
        "volume_total": data.volume_total,
        "status": "pending",
        "photos": [],
        "created_at": now,
        "updated_at": now,
        "last_treatment_at": now,
        "responsible_id": user["id"],
        "responsible_name": user["name"],
        "history": [{
            "action": "created",
            "timestamp": now,
            "user_id": user["id"],
            "user_name": user["name"],
            "details": f"Custódia criada - Caixa: {box_number} - Região: {data.region} - Volume: {data.volume_current}/{data.volume_total} - Ocorrência: {data.occurrence_type}"
        }]
    }
    
    await db.custodies.insert_one(custody_doc)
    custody_doc.pop("_id", None)
    
    # Add treatment info
    treatment_info = calculate_days_without_treatment(custody_doc)
    custody_doc.update(treatment_info)
    
    return custody_doc

@api_router.get("/custodies")
async def list_custodies(
    request: Request,
    status: Optional[str] = None,
    occurrence_type: Optional[str] = None,
    responsible_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    expired: Optional[bool] = None,
    near_return: Optional[bool] = None,
    ready_for_return: Optional[bool] = None,
    no_photos: Optional[bool] = None,
    no_treatment: Optional[bool] = None,
    search_code: Optional[str] = None,
    search_box: Optional[str] = None,
    search_query: Optional[str] = None,
    region: Optional[str] = None,
    sort_by: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    if occurrence_type:
        query["occurrence_type"] = occurrence_type
    if responsible_id:
        query["responsible_id"] = responsible_id
    if region:
        query["region"] = region
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    if expired:
        expired_threshold = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        query["status"] = "pending"
        query["created_at"] = {"$lt": expired_threshold}
    
    # Search by shipment code
    if search_code:
        query["shipment_code"] = {"$regex": search_code, "$options": "i"}
    
    # Search by box number
    if search_box:
        query["box_number"] = {"$regex": search_box, "$options": "i"}
    
    # Universal search (code, box, or client name)
    if search_query:
        query["$or"] = [
            {"shipment_code": {"$regex": search_query, "$options": "i"}},
            {"box_number": {"$regex": search_query, "$options": "i"}},
            {"client_name": {"$regex": search_query, "$options": "i"}}
        ]
    
    # Filter for no photos
    if no_photos:
        if "$or" not in query:
            query["$or"] = [{"photos": {"$exists": False}}, {"photos": {"$size": 0}}]
    
    # Filter for no treatment (never updated since creation)
    if no_treatment:
        query["$expr"] = {"$eq": ["$last_treatment_at", "$created_at"]}
    
    # Filter for near return (8+ days without treatment)
    if near_return:
        near_threshold = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
        query["status"] = {"$nin": ["resolved", "ready_for_return", "returned"]}
        query["last_treatment_at"] = {"$lt": near_threshold}
    
    # Filter for ready for return (10+ days without treatment)
    if ready_for_return:
        return_threshold = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        query["$or"] = [
            {"status": "ready_for_return"},
            {"status": {"$nin": ["resolved", "ready_for_return", "returned"]}, "last_treatment_at": {"$lt": return_threshold}}
        ]
    
    # Determine sort order
    sort_field = "created_at"
    sort_order = -1
    if sort_by == "days_without_treatment":
        sort_field = "last_treatment_at"
        sort_order = 1  # Oldest first (most days)
    elif sort_by == "updated_at":
        sort_field = "updated_at"
    
    custodies = await db.custodies.find(query, {"_id": 0}).sort(sort_field, sort_order).skip(skip).limit(limit).to_list(limit)
    
    # Add treatment info to each custody
    for custody in custodies:
        treatment_info = calculate_days_without_treatment(custody)
        custody.update(treatment_info)
    
    return custodies

# Central stats endpoint with more details
@api_router.get("/custodies/central-stats")
async def get_central_stats(request: Request, region: Optional[str] = None):
    await get_current_user(request)
    
    near_return_threshold = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    return_threshold = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    
    region_filter = {"region": region} if region else {}
    
    total = await db.custodies.count_documents(region_filter)
    
    # Aguardando retorno (pending, not near return)
    awaiting_return = await db.custodies.count_documents({
        **region_filter,
        "status": "pending",
        "last_treatment_at": {"$gte": near_return_threshold}
    })
    
    # Próximas da devolução (8-9 days)
    near_return = await db.custodies.count_documents({
        **region_filter,
        "status": {"$nin": ["resolved", "ready_for_return", "returned"]},
        "last_treatment_at": {"$lt": near_return_threshold, "$gte": return_threshold}
    })
    
    # Aptas para devolução (10+ days)
    ready_query = {
        "$or": [
            {"status": "ready_for_return"},
            {"status": {"$nin": ["resolved", "ready_for_return", "returned"]}, "last_treatment_at": {"$lt": return_threshold}}
        ]
    }
    if region:
        ready_query = {"$and": [{"region": region}, ready_query]}
    ready_for_return = await db.custodies.count_documents(ready_query)
    
    # Finalizadas
    finalized = await db.custodies.count_documents({**region_filter, "status": {"$in": ["resolved", "returned"]}})
    
    # Sem foto
    no_photos_query = {"$or": [{"photos": {"$exists": False}}, {"photos": {"$size": 0}}]}
    if region:
        no_photos_query = {"$and": [{"region": region}, no_photos_query]}
    no_photos = await db.custodies.count_documents(no_photos_query)
    
    return {
        "region": region,
        "total": total,
        "awaiting_return": awaiting_return,
        "near_return": near_return,
        "ready_for_return": ready_for_return,
        "finalized": finalized,
        "no_photos": no_photos
    }

# Region stats endpoint
@api_router.get("/custodies/region-stats")
async def get_region_stats(request: Request):
    await get_current_user(request)
    
    near_return_threshold = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    return_threshold = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    
    regions = ["São Paulo", "Guarulhos"]
    result = {}
    
    for region in regions:
        total = await db.custodies.count_documents({"region": region})
        
        # Near return (8-9 days)
        near_return = await db.custodies.count_documents({
            "region": region,
            "status": {"$nin": ["resolved", "ready_for_return", "returned"]},
            "last_treatment_at": {"$lt": near_return_threshold, "$gte": return_threshold}
        })
        
        # Ready for return (10+ days)
        ready_for_return = await db.custodies.count_documents({
            "region": region,
            "$or": [
                {"status": "ready_for_return"},
                {"status": {"$nin": ["resolved", "ready_for_return", "returned"]}, "last_treatment_at": {"$lt": return_threshold}}
            ]
        })
        
        result[region] = {
            "total": total,
            "near_return": near_return,
            "ready_for_return": ready_for_return,
            "has_alert": near_return > 0 or ready_for_return > 0,
            "alert_type": "red" if ready_for_return > 0 else ("yellow" if near_return > 0 else None)
        }
    
    return result

# Bulk update endpoint
@api_router.post("/custodies/bulk-update")
async def bulk_update_custodies(data: BulkUpdateRequest, request: Request):
    user = await get_current_user(request)
    
    now = datetime.now(timezone.utc).isoformat()
    updated_count = 0
    deleted_count = 0
    blocked_count = 0
    
    for custody_id in data.custody_ids:
        custody = await db.custodies.find_one({"id": custody_id})
        if not custody:
            continue
        
        # RBAC: operators only their region
        if not can_modify_region(user, custody.get("region")):
            blocked_count += 1
            continue
        
        # Hard delete branch (no history needed)
        if data.action == "delete":
            for p in custody.get("photos", []) or []:
                sp = p.get("storage_path")
                if sp:
                    delete_object(sp)
            await db.custodies.delete_one({"id": custody_id})
            deleted_count += 1
            continue
        
        update_data = {"updated_at": now}
        history_entry = {
            "timestamp": now,
            "user_id": user["id"],
            "user_name": user["name"]
        }
        
        if data.action == "mark_returned":
            update_data["status"] = "returned"
            update_data["last_treatment_at"] = now
            history_entry["action"] = "bulk_status_change"
            history_entry["details"] = "Marcado como devolvido (ação em massa)"
        elif data.action == "update_responsible" and data.responsible_id:
            # Get new responsible user
            new_responsible = await db.users.find_one({"_id": ObjectId(data.responsible_id)})
            if new_responsible:
                update_data["responsible_id"] = data.responsible_id
                update_data["responsible_name"] = new_responsible.get("name", "Desconhecido")
                history_entry["action"] = "bulk_responsible_change"
                history_entry["details"] = f"Responsável alterado para: {new_responsible.get('name')}"
        else:
            continue
        
        await db.custodies.update_one(
            {"id": custody_id},
            {
                "$set": update_data,
                "$push": {"history": history_entry}
            }
        )
        updated_count += 1
    
    await log_audit("bulk_update", user=user, ip=get_client_ip(request),
                    details=f"action={data.action}, atualizados={updated_count}, apagados={deleted_count}, bloqueados_rbac={blocked_count}")
    return {"updated_count": updated_count, "deleted_count": deleted_count, "blocked_count": blocked_count}

@api_router.get("/custodies/stats")
async def get_custody_stats(request: Request, region: Optional[str] = None):
    await get_current_user(request)
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    expired_threshold = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    near_return_threshold = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    return_threshold = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    
    # Region filter mixin (applied to every counter)
    region_filter = {"region": region} if region else {}
    
    total_today = await db.custodies.count_documents({**region_filter, "created_at": {"$gte": today_start}})
    pending = await db.custodies.count_documents({**region_filter, "status": "pending"})
    resolved = await db.custodies.count_documents({**region_filter, "status": "resolved"})
    expired = await db.custodies.count_documents({
        **region_filter,
        "status": "pending",
        "created_at": {"$lt": expired_threshold}
    })
    
    # Near return (8-9 days without treatment)
    near_return = await db.custodies.count_documents({
        **region_filter,
        "status": {"$nin": ["resolved", "ready_for_return"]},
        "last_treatment_at": {"$lt": near_return_threshold, "$gte": return_threshold}
    })
    
    # Ready for return (10+ days without treatment)
    ready_for_return = await db.custodies.count_documents({
        "$and": [
            region_filter if region_filter else {},
            {"$or": [
                {"status": "ready_for_return"},
                {"status": {"$nin": ["resolved", "ready_for_return"]}, "last_treatment_at": {"$lt": return_threshold}}
            ]}
        ]
    } if region_filter else {
        "$or": [
            {"status": "ready_for_return"},
            {"status": {"$nin": ["resolved", "ready_for_return"]}, "last_treatment_at": {"$lt": return_threshold}}
        ]
    })
    
    return {
        "region": region,
        "total_today": total_today,
        "pending": pending,
        "resolved": resolved,
        "expired": expired,
        "near_return": near_return,
        "ready_for_return": ready_for_return
    }

# Get alerts for dashboard
@api_router.get("/custodies/alerts")
async def get_custody_alerts(request: Request, region: Optional[str] = None):
    await get_current_user(request)
    
    near_return_threshold = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    return_threshold = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    
    region_filter = {"region": region} if region else {}
    
    alerts = []
    
    # Get custodies near return (8-9 days)
    near_custodies = await db.custodies.find({
        **region_filter,
        "status": {"$nin": ["resolved", "ready_for_return"]},
        "last_treatment_at": {"$lt": near_return_threshold, "$gte": return_threshold}
    }, {"_id": 0}).to_list(100)
    
    for custody in near_custodies:
        treatment_info = calculate_days_without_treatment(custody)
        alerts.append({
            "type": "warning",
            "custody_id": custody["id"],
            "box_number": custody.get("box_number", "N/A"),
            "shipment_code": custody["shipment_code"],
            "client_name": custody["client_name"],
            "days_without_treatment": treatment_info["days_without_treatment"],
            "days_until_return": treatment_info["days_until_return"],
            "message": f"A remessa {custody['shipment_code']} está há {treatment_info['days_without_treatment']} dias sem retorno. Faltam {treatment_info['days_until_return']} dias para poder devolver."
        })
    
    # Get custodies ready for return (10+ days)
    ready_query = {
        "$or": [
            {"status": "ready_for_return"},
            {"status": {"$nin": ["resolved", "ready_for_return"]}, "last_treatment_at": {"$lt": return_threshold}}
        ]
    }
    if region:
        ready_query = {"$and": [{"region": region}, ready_query]}
    return_custodies = await db.custodies.find(ready_query, {"_id": 0}).to_list(100)
    
    for custody in return_custodies:
        treatment_info = calculate_days_without_treatment(custody)
        alerts.append({
            "type": "return",
            "custody_id": custody["id"],
            "box_number": custody.get("box_number", "N/A"),
            "shipment_code": custody["shipment_code"],
            "client_name": custody["client_name"],
            "days_without_treatment": treatment_info["days_without_treatment"],
            "days_until_return": 0,
            "message": f"A remessa {custody['shipment_code']} está há {treatment_info['days_without_treatment']} dias sem tratativa do CO emissor e pode ser devolvida."
        })
        
        # Auto-update status to ready_for_return if not already
        if custody.get("status") != "ready_for_return":
            await db.custodies.update_one(
                {"id": custody["id"]},
                {
                    "$set": {"status": "ready_for_return", "updated_at": datetime.now(timezone.utc).isoformat()},
                    "$push": {"history": {
                        "action": "auto_status_change",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "user_id": "system",
                        "user_name": "Sistema",
                        "details": f"Status alterado automaticamente para 'Apta para Devolução' - {treatment_info['days_without_treatment']} dias sem tratativa"
                    }}
                }
            )
    
    return sorted(alerts, key=lambda x: x["days_without_treatment"], reverse=True)

@api_router.get("/custodies/{custody_id}")
async def get_custody(custody_id: str, request: Request):
    await get_current_user(request)
    
    custody = await db.custodies.find_one({"id": custody_id}, {"_id": 0})
    if not custody:
        raise HTTPException(status_code=404, detail="Custody not found")
    
    # Add treatment info
    treatment_info = calculate_days_without_treatment(custody)
    custody.update(treatment_info)
    
    return custody

@api_router.delete("/custodies/{custody_id}")
async def delete_custody(custody_id: str, request: Request):
    """Hard delete a custody. Admin (any region) or operator (own region only)."""
    user = await get_current_user(request)
    
    custody = await db.custodies.find_one({"id": custody_id})
    if not custody:
        raise HTTPException(status_code=404, detail="Custódia não encontrada.")
    
    # RBAC: operators only their own region
    if not can_modify_region(user, custody.get("region")):
        raise HTTPException(
            status_code=403,
            detail=f"Operadores só podem apagar custódias da própria região ({user.get('region')})."
        )
    
    # Best-effort: remove photos from Object Storage
    photos = custody.get("photos", []) or []
    for p in photos:
        sp = p.get("storage_path")
        if sp:
            delete_object(sp)
    
    # Hard delete from DB
    await db.custodies.delete_one({"id": custody_id})
    
    await log_audit(
        "custody_deleted",
        user=user,
        ip=get_client_ip(request),
        target_id=custody_id,
        details=(f"Custódia apagada: caixa={custody.get('box_number')} "
                 f"remessa={custody.get('shipment_code')} região={custody.get('region')} "
                 f"fotos_removidas={len(photos)}")
    )
    return {"message": "Custódia apagada com sucesso.", "id": custody_id}

@api_router.patch("/custodies/{custody_id}")
async def update_custody(custody_id: str, data: CustodyUpdate, request: Request):
    user = await get_current_user(request)
    
    custody = await db.custodies.find_one({"id": custody_id})
    if not custody:
        raise HTTPException(status_code=404, detail="Custody not found")
    
    # RBAC: operators can only modify their own region
    if not can_modify_region(user, custody.get("region")):
        raise HTTPException(status_code=403, detail=f"Operadores só podem editar custódias da própria região ({user.get('region')}).")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {"updated_at": now, "last_treatment_at": now}
    history_entry = {
        "timestamp": now,
        "user_id": user["id"],
        "user_name": user["name"]
    }
    
    if data.status:
        update_data["status"] = data.status
        history_entry["action"] = "status_changed"
        history_entry["details"] = f"Status alterado para: {data.status}"
    
    if data.observation:
        history_entry["action"] = "observation_added"
        history_entry["details"] = f"Nova observação: {data.observation}"
        # Append observation to existing
        existing_obs = custody.get("observation", "") or ""
        new_obs = f"{existing_obs}\n\n[{datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')} - {user['name']}]: {data.observation}"
        update_data["observation"] = new_obs.strip()
    
    await db.custodies.update_one(
        {"id": custody_id},
        {
            "$set": update_data,
            "$push": {"history": history_entry}
        }
    )
    
    updated = await db.custodies.find_one({"id": custody_id}, {"_id": 0})
    
    # Add treatment info
    treatment_info = calculate_days_without_treatment(updated)
    updated.update(treatment_info)
    
    return updated

# Photo Upload Endpoint
@api_router.post("/custodies/{custody_id}/photos")
async def upload_photo(
    custody_id: str,
    request: Request,
    file: UploadFile = File(...),
    photo_type: str = Query(..., description="etiqueta, caixa, or adicional")
):
    user = await get_current_user(request)
    
    custody = await db.custodies.find_one({"id": custody_id})
    if not custody:
        raise HTTPException(status_code=404, detail="Custody not found")
    
    # Read file content
    content = await file.read()
    
    # Generate storage path
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    file_id = str(uuid.uuid4())
    storage_path = f"{APP_NAME}/custodies/{custody_id}/{file_id}.{ext}"
    
    # Upload to storage
    try:
        result = put_object(storage_path, content, file.content_type or "image/jpeg")
    except Exception as e:
        logger.error(f"Failed to upload photo: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload photo")
    
    # Create photo record
    photo_record = {
        "id": file_id,
        "type": photo_type,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(content)),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": user["id"]
    }
    
    # Update custody with new photo
    await db.custodies.update_one(
        {"id": custody_id},
        {
            "$push": {
                "photos": photo_record,
                "history": {
                    "action": "photo_added",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "user_id": user["id"],
                    "user_name": user["name"],
                    "details": f"Foto adicionada: {photo_type}"
                }
            },
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return photo_record

@api_router.get("/files/{path:path}")
async def download_file(path: str, request: Request, auth: str = Query(None)):
    # Verify auth
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        elif auth:
            token = auth
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get file from storage
    try:
        data, content_type = get_object(path)
        return Response(content=data, media_type=content_type)
    except Exception as e:
        logger.error(f"Failed to get file: {e}")
        raise HTTPException(status_code=404, detail="File not found")

# Export Endpoint
@api_router.get("/custodies/export/csv")
async def export_custodies_csv(
    request: Request,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    region: Optional[str] = None
):
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    if region:
        query["region"] = region
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    custodies = await db.custodies.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    # Create CSV
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Data/Hora", "Nº Caixa", "Volume", "Código Remessa", "Cliente", "Telefone", "Endereço",
        "Cidade", "UF", "Região", "Ocorrência", "Observação", "Status", "Responsável", "Dias sem Tratativa", "Fotos"
    ])
    
    for c in custodies:
        photo_links = ", ".join([p.get("storage_path", "") for p in c.get("photos", [])])
        treatment_info = calculate_days_without_treatment(c)
        volume = f"{c.get('volume_current', 1)}/{c.get('volume_total', 1)}"
        writer.writerow([
            c.get("created_at", ""),
            c.get("box_number", ""),
            volume,
            c.get("shipment_code", ""),
            c.get("client_name", ""),
            c.get("phone", ""),
            c.get("address", ""),
            c.get("city", ""),
            c.get("state", ""),
            c.get("region", ""),
            c.get("occurrence_type", ""),
            c.get("observation", ""),
            c.get("status", ""),
            c.get("responsible_name", ""),
            treatment_info["days_without_treatment"],
            photo_links
        ])
    
    output.seek(0)
    content = output.getvalue().encode('utf-8-sig')  # Add BOM for Excel compatibility
    
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=custodias.csv"}
    )

# Generate label endpoint
@api_router.get("/custodies/{custody_id}/label")
async def get_custody_label(custody_id: str, request: Request):
    await get_current_user(request)
    
    custody = await db.custodies.find_one({"id": custody_id}, {"_id": 0})
    if not custody:
        raise HTTPException(status_code=404, detail="Custody not found")
    
    return {
        "box_number": custody.get("box_number", "N/A"),
        "shipment_code": custody.get("shipment_code", ""),
        "client_name": custody.get("client_name", ""),
        "volume": f"{custody.get('volume_current', 1)}/{custody.get('volume_total', 1)}",
        "created_at": custody.get("created_at", ""),
        "qr_data": custody.get("box_number", custody_id)
    }

# ============================================================================
# User Management (Admin only)
# ============================================================================

@api_router.get("/users")
async def list_users(request: Request):
    """Any authenticated user may list users (used in filters). Returns sanitized data."""
    await get_current_user(request)
    users = await db.users.find({}, {"password_hash": 0}).to_list(1000)
    out = []
    for u in users:
        u["id"] = str(u.pop("_id"))
        u.setdefault("role", "operator")
        u.setdefault("region", None)
        u.setdefault("is_active", True)
        out.append(u)
    return out

@api_router.post("/users", status_code=201)
async def create_user(data: UserCreate, request: Request):
    admin = await require_admin(request)
    
    email = data.email.lower().strip()
    if not email or not data.password or not data.name:
        raise HTTPException(status_code=400, detail="Nome, e-mail e senha são obrigatórios.")
    
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Tipo de acesso inválido. Use 'admin' ou 'operator'.")
    
    if data.role == "operator" and data.region not in VALID_REGIONS:
        raise HTTPException(status_code=400, detail="Operadores devem ser vinculados a uma região (Guarulhos ou São Paulo).")
    
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 6 caracteres.")
    
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Já existe um usuário com este e-mail.")
    
    user_doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name.strip(),
        "role": data.role,
        "region": data.region if data.role == "operator" else None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"],
    }
    result = await db.users.insert_one(user_doc)
    user_doc["id"] = str(result.inserted_id)
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    
    await log_audit("user_created", user=admin, ip=get_client_ip(request),
                    target_id=user_doc["id"],
                    details=f"Usuário criado: {email} ({data.role}{', ' + data.region if data.region else ''})")
    return user_doc

@api_router.patch("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, request: Request):
    admin = await require_admin(request)
    
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de usuário inválido.")
    
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    
    update_fields = {}
    changes = []
    
    if data.name is not None:
        update_fields["name"] = data.name.strip()
        changes.append(f"nome→{data.name.strip()}")
    if data.role is not None:
        if data.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Tipo de acesso inválido.")
        update_fields["role"] = data.role
        changes.append(f"role→{data.role}")
        # If becoming admin, clear region; operator must have region
        if data.role == "admin":
            update_fields["region"] = None
    if data.region is not None:
        new_role = update_fields.get("role", user.get("role"))
        if new_role == "operator" and data.region not in VALID_REGIONS:
            raise HTTPException(status_code=400, detail="Região inválida para operador.")
        update_fields["region"] = data.region if new_role == "operator" else None
        changes.append(f"região→{data.region}")
    if data.is_active is not None:
        update_fields["is_active"] = data.is_active
        changes.append(f"ativo→{data.is_active}")
    if data.password:
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 6 caracteres.")
        update_fields["password_hash"] = hash_password(data.password)
        changes.append("senha redefinida")
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nenhuma alteração informada.")
    
    # Final-state validation: if user ends up as operator, region must be valid
    final_role = update_fields.get("role", user.get("role"))
    final_region = update_fields.get("region", user.get("region"))
    if final_role == "operator" and final_region not in VALID_REGIONS:
        raise HTTPException(
            status_code=400,
            detail="Operadores devem estar vinculados a uma região (Guarulhos ou São Paulo)."
        )
    
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_fields["updated_by"] = admin["id"]
    await db.users.update_one({"_id": oid}, {"$set": update_fields})
    
    await log_audit("user_updated", user=admin, ip=get_client_ip(request),
                    target_id=user_id, details="; ".join(changes) or "atualização")
    
    updated = await db.users.find_one({"_id": oid}, {"password_hash": 0})
    updated["id"] = str(updated.pop("_id"))
    return updated

@api_router.delete("/users/{user_id}")
async def deactivate_user(user_id: str, request: Request):
    """Soft delete: marca is_active=False (preserva histórico)."""
    admin = await require_admin(request)
    
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Você não pode desativar a si mesmo.")
    
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de usuário inválido.")
    
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    
    await db.users.update_one({"_id": oid}, {"$set": {
        "is_active": False,
        "deactivated_at": datetime.now(timezone.utc).isoformat(),
        "deactivated_by": admin["id"]
    }})
    await log_audit("user_deleted", user=admin, ip=get_client_ip(request),
                    target_id=user_id, details=f"Usuário desativado: {user.get('email')}")
    return {"message": "Usuário desativado com sucesso."}

# ============================================================================
# Audit Logs (Admin only)
# ============================================================================

@api_router.get("/audit-logs")
async def list_audit_logs(
    request: Request,
    action: Optional[str] = None,
    user_email: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 200,
    skip: int = 0
):
    await require_admin(request)
    # Cap limit to prevent abuse
    limit = max(1, min(limit, 500))
    skip = max(0, skip)
    query = {}
    if action:
        query["action"] = action
    if user_email:
        query["user_email"] = {"$regex": user_email, "$options": "i"}
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return logs

# Health check
@api_router.get("/")
async def root():
    return {"message": "D1 Custódia API", "status": "running"}

# Include the router in the main app
app.include_router(api_router)

# CORS Configuration
frontend_url = os.environ.get('FRONTEND_URL', os.environ.get('CORS_ORIGINS', '*').split(',')[0])
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[frontend_url] if frontend_url != '*' else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup Events
@app.on_event("startup")
async def startup():
    # Initialize storage
    try:
        init_storage()
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.custodies.create_index("id", unique=True)
    await db.custodies.create_index("status")
    await db.custodies.create_index("created_at")
    await db.custodies.create_index("responsible_id")
    await db.custodies.create_index("region")
    await db.custodies.create_index([("region", 1), ("created_at", -1)])
    await db.custodies.create_index([("region", 1), ("status", 1)])
    await db.login_attempts.create_index("email")
    await db.login_attempts.create_index("created_at")
    await db.audit_logs.create_index("created_at")
    await db.audit_logs.create_index("action")
    await db.audit_logs.create_index("user_email")
    
    # Seed admin user
    admin_email = os.environ.get("ADMIN_EMAIL", "admin")
    admin_password = os.environ.get("ADMIN_PASSWORD", "123456789")
    
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Administrador",
            "role": "admin",
            "region": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    else:
        # Migration: ensure admin always has correct role/active
        updates = {}
        if existing.get("role") != "admin":
            updates["role"] = "admin"
        if existing.get("is_active") is False:
            updates["is_active"] = True
        if "region" not in existing:
            updates["region"] = None
        if not verify_password(admin_password, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_password)
        if updates:
            await db.users.update_one({"email": admin_email}, {"$set": updates})
            logger.info(f"Admin user migrated: {list(updates.keys())}")
    
    # Migration: legacy users without role default to operator/active
    await db.users.update_many(
        {"role": {"$exists": False}},
        {"$set": {"role": "operator", "is_active": True}}
    )
    await db.users.update_many(
        {"is_active": {"$exists": False}},
        {"$set": {"is_active": True}}
    )
    
    # Write test credentials
    Path("/app/memory").mkdir(exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n")
        f.write(f"## Admin User\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write(f"- Role: admin\n\n")
        f.write(f"## Auth Endpoints (login only — registration is closed)\n")
        f.write(f"- POST /api/auth/login\n")
        f.write(f"- GET /api/auth/me\n")
        f.write(f"- POST /api/auth/logout\n")
        f.write(f"- POST /api/auth/refresh\n\n")
        f.write(f"## User Management (admin only)\n")
        f.write(f"- GET /api/users\n")
        f.write(f"- POST /api/users (create)\n")
        f.write(f"- PATCH /api/users/{{id}} (update)\n")
        f.write(f"- DELETE /api/users/{{id}} (deactivate)\n\n")
        f.write(f"## Audit\n")
        f.write(f"- GET /api/audit-logs (admin only)\n")
    
    logger.info("D1 Custódia API started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
