import os
import httpx
from datetime import datetime
from typing import List
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from . import models

security = HTTPBearer(auto_error=False)

# Load configuration
OIDC_ISSUER_URL = os.environ.get("OIDC_ISSUER_URL", "")
OIDC_AUDIENCE = os.environ.get("OIDC_AUDIENCE", "sidekick-client")
DEV_MODE = os.environ.get("DEV_MODE", "true").lower() in ("true", "1", "yes")

# In-memory caches for OIDC JWKS
jwks_cache = None
jwks_uri = None

def get_jwks_uri():
    global jwks_uri
    if not OIDC_ISSUER_URL:
        return None
    if jwks_uri:
        return jwks_uri
    
    try:
        # Standard OIDC Discovery
        well_known_url = f"{OIDC_ISSUER_URL.rstrip('/')}/.well-known/openid-configuration"
        response = httpx.get(well_known_url, timeout=5.0)
        response.raise_for_status()
        jwks_uri = response.json().get("jwks_uri")
        return jwks_uri
    except Exception as e:
        print(f"OIDC metadata discovery failed: {e}. Falling back to default certs path.")
        jwks_uri = f"{OIDC_ISSUER_URL.rstrip('/')}/protocol/openid-connect/certs"
        return jwks_uri

def get_jwks():
    global jwks_cache
    if jwks_cache:
        return jwks_cache
    
    uri = get_jwks_uri()
    if not uri:
        return None
        
    try:
        response = httpx.get(uri, timeout=5.0)
        response.raise_for_status()
        jwks_cache = response.json()
        return jwks_cache
    except Exception as e:
        print(f"Failed to fetch JWKS from {uri}: {e}")
        return None

def verify_oidc_token(token: str) -> dict:
    """
    Decodes and validates an OIDC token against the provider's JWKS.
    Returns the claims dict if valid.
    """
    jwks = get_jwks()
    if not jwks:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OIDC provider keys are unavailable."
        )

    try:
        # Get the unverified header to locate the kid (key id)
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        
        # Find matching key in JWKS
        rsa_key = {}
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                rsa_key = {
                    "kty": key.get("kty"),
                    "kid": key.get("kid"),
                    "use": key.get("use"),
                    "n": key.get("n"),
                    "e": key.get("e")
                }
                break
                
        if not rsa_key:
            raise JWTError("Public key not found in JWKS.")
            
        # Verify the signature and claims
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=OIDC_AUDIENCE,
            issuer=OIDC_ISSUER_URL
        )
        return payload
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid OIDC token: {str(e)}"
        )

def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    """
    Dependency that extracts the credentials, validates them (or simulates them in DEV_MODE),
    and retrieves the corresponding local database User profile.
    """
    token = credentials.credentials if credentials else request.query_params.get("token")
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    claims = {}
    if DEV_MODE or not OIDC_ISSUER_URL:
        # DEV MODE MOCK CLAIMS
        # Token string can be "dev-admin", "dev-stocker", "dev-puller", etc.
        # Otherwise, parse claims without validating signature.
        if token.startswith("dev-"):
            role = token.split("-")[1]
            if role not in ("admin", "designer", "stocker", "puller", "analyst", "viewer"):
                role = "viewer"
            claims = {
                "sub": f"dev_sub_{role}",
                "email": f"{role}@dev.sidekick",
                "preferred_username": f"Dev {role.capitalize()}",
                "dev_role": role
            }
        else:
            try:
                # Parse without verifying signature in dev mode if it looks like a real JWT
                claims = jwt.get_unverified_claims(token)
            except JWTError:
                claims = {
                    "sub": "dev_sub_admin",
                    "email": "admin@dev.sidekick",
                    "preferred_username": "Dev Admin Default",
                    "dev_role": "admin"
                }
    else:
        # PRODUCTION OIDC VERIFICATION
        claims = verify_oidc_token(token)

    sub = claims.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing subject claim ('sub')."
        )
        
    # Check if user exists locally
    user = db.query(models.User).filter(models.User.oidc_sub == sub).first()
    
    if not user:
        # Automatic provisioning for first-time login
        # Assign 'admin' to first user if database is empty, otherwise 'viewer'
        is_first_user = db.query(models.User).count() == 0
        assigned_role = "admin" if is_first_user else "viewer"
        
        # Override if dev_role is specifically sent in mock token
        if "dev_role" in claims:
            assigned_role = claims["dev_role"]

        user = models.User(
            oidc_sub=sub,
            email=claims.get("email"),
            username=claims.get("preferred_username") or claims.get("name") or sub,
            role=assigned_role
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update last login and metadata if changed
        user.last_login = datetime.utcnow()
        if claims.get("email") and user.email != claims.get("email"):
            user.email = claims.get("email")
        if claims.get("preferred_username") and user.username != claims.get("preferred_username"):
            user.username = claims.get("preferred_username")
        db.commit()
        db.refresh(user)
        
    return user

class RoleChecker:
    """
    Dependency generator for checking user roles.
    """
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: models.User = Depends(get_current_user)) -> models.User:
        # 'admin' has override privileges for all routes
        if user.role == "admin" or user.role in self.allowed_roles:
            return user
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{user.role}' does not have permission to perform this action. Required: one of {self.allowed_roles}."
        )

# Helper instances for router level access checks
require_admin = RoleChecker(["admin"])
require_designer = RoleChecker(["admin", "designer"])
require_stocker = RoleChecker(["admin", "stocker"])
require_puller = RoleChecker(["admin", "puller"])
require_analyst = RoleChecker(["admin", "designer", "stocker", "puller", "analyst"])
require_any_user = RoleChecker(["admin", "designer", "stocker", "puller", "analyst", "viewer"])
