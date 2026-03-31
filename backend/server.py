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
        user["id"] = str(user["_id"])
        del user["_id"]
        user.pop("password_hash", None)
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

# Create the main app
app = FastAPI(title="D1 Custódia API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    email: str
    password: str
    name: str

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
    occurrence_type: str
    observation: Optional[str] = None

class CustodyUpdate(BaseModel):
    status: Optional[str] = None
    observation: Optional[str] = None

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
async def login(data: UserLogin, response: Response):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user"),
        "token": access_token
    }

@api_router.post("/auth/register")
async def register(data: UserRegister, response: Response):
    email = data.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(data.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": data.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {
        "id": user_id,
        "email": email,
        "name": data.name,
        "role": "user",
        "token": access_token
    }

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
    
    custody_doc = {
        "id": str(uuid.uuid4()),
        "shipment_code": data.shipment_code,
        "client_name": data.client_name,
        "phone": data.phone,
        "address": data.address,
        "occurrence_type": data.occurrence_type,
        "observation": data.observation,
        "status": "pending",
        "photos": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "responsible_id": user["id"],
        "responsible_name": user["name"],
        "history": [{
            "action": "created",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": user["id"],
            "user_name": user["name"],
            "details": f"Custódia criada - Ocorrência: {data.occurrence_type}"
        }]
    }
    
    await db.custodies.insert_one(custody_doc)
    custody_doc.pop("_id", None)
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
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    if expired:
        # Consider expired if pending and older than 24 hours
        expired_threshold = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        query["status"] = "pending"
        query["created_at"] = {"$lt": expired_threshold}
    
    custodies = await db.custodies.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return custodies

@api_router.get("/custodies/stats")
async def get_custody_stats(request: Request):
    await get_current_user(request)
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    expired_threshold = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    
    total_today = await db.custodies.count_documents({"created_at": {"$gte": today_start}})
    pending = await db.custodies.count_documents({"status": "pending"})
    resolved = await db.custodies.count_documents({"status": "resolved"})
    expired = await db.custodies.count_documents({
        "status": "pending",
        "created_at": {"$lt": expired_threshold}
    })
    
    return {
        "total_today": total_today,
        "pending": pending,
        "resolved": resolved,
        "expired": expired
    }

@api_router.get("/custodies/{custody_id}")
async def get_custody(custody_id: str, request: Request):
    await get_current_user(request)
    
    custody = await db.custodies.find_one({"id": custody_id}, {"_id": 0})
    if not custody:
        raise HTTPException(status_code=404, detail="Custody not found")
    return custody

@api_router.patch("/custodies/{custody_id}")
async def update_custody(custody_id: str, data: CustodyUpdate, request: Request):
    user = await get_current_user(request)
    
    custody = await db.custodies.find_one({"id": custody_id})
    if not custody:
        raise HTTPException(status_code=404, detail="Custody not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    history_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
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
    date_to: Optional[str] = None
):
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
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
        "Data/Hora", "Código Remessa", "Cliente", "Telefone", "Endereço",
        "Ocorrência", "Observação", "Status", "Responsável", "Fotos"
    ])
    
    for c in custodies:
        photo_links = ", ".join([p.get("storage_path", "") for p in c.get("photos", [])])
        writer.writerow([
            c.get("created_at", ""),
            c.get("shipment_code", ""),
            c.get("client_name", ""),
            c.get("phone", ""),
            c.get("address", ""),
            c.get("occurrence_type", ""),
            c.get("observation", ""),
            c.get("status", ""),
            c.get("responsible_name", ""),
            photo_links
        ])
    
    output.seek(0)
    content = output.getvalue().encode('utf-8-sig')  # Add BOM for Excel compatibility
    
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=custodias.csv"}
    )

# Users list for filters
@api_router.get("/users")
async def list_users(request: Request):
    await get_current_user(request)
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    for u in users:
        if "_id" in u:
            u["id"] = str(u["_id"])
            del u["_id"]
    return users

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
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info(f"Admin password updated: {admin_email}")
    
    # Write test credentials
    Path("/app/memory").mkdir(exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n")
        f.write(f"## Admin User\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write(f"- Role: admin\n\n")
        f.write(f"## Auth Endpoints\n")
        f.write(f"- POST /api/auth/login\n")
        f.write(f"- POST /api/auth/register\n")
        f.write(f"- GET /api/auth/me\n")
        f.write(f"- POST /api/auth/logout\n")
        f.write(f"- POST /api/auth/refresh\n")
    
    logger.info("D1 Custódia API started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
