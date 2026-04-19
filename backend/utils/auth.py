import os
import json
import urllib.request
import base64
from functools import wraps
from flask import request, jsonify
import jwt
from jwt.algorithms import RSAAlgorithm

CLERK_PUBLISHABLE_KEY = os.environ.get("CLERK_PUBLISHABLE_KEY", "")
CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")

def get_frontend_api():
    if not CLERK_PUBLISHABLE_KEY:
        return None
    try:
        parts = CLERK_PUBLISHABLE_KEY.split("_")
        if len(parts) >= 3:
            # Decode the piece after pk_test_ or pk_live_
            # Add padding to avoid b64decode errors
            b64_str = parts[2]
            b64_str += "=" * ((4 - len(b64_str) % 4) % 4)
            decoded = base64.b64decode(b64_str).decode('utf-8')
            if decoded.endswith('$'):
                decoded = decoded[:-1]
            return decoded
    except Exception as e:
        print(f"Error extracting Clerk Frontend API from publishable key: {e}")
    return None

def get_jwks():
    domain = get_frontend_api()
    if not domain:
        return None
        
    url = f"https://{domain}/.well-known/jwks.json"
    try:
        # User-Agent header is often required by Clerk's edge servers
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Failed to fetch JWKS from {url}: {e}")
        return None

def get_current_user_id():
    """Extract user ID from cookie for SSR pages like the Dashboard."""
    token = request.cookies.get("__session")
    if not token:
        # Fallback to authorization header if present
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        return "demo_user"
        
    try:
        # Decode without verifying signature strictly because it's just for non-destructive UI filtering.
        # Strict API endpoints use @require_auth which performs full RSA signature validation.
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("sub", "demo_user")
    except Exception as e:
        print(f"Failed to extract sub from session cookie: {e}")
        return "demo_user"

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Bypass auth if NO secret key is provided so we don't break the app until set
        if not CLERK_SECRET_KEY or not CLERK_PUBLISHABLE_KEY:
             print("WARNING: Clerk keys missing in .env. Falling back to demo_user.")
             request.current_user_id = "demo_user"
             return f(*args, **kwargs)
             
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401
            
        token = auth_header.split(" ")[1]
        
        try:
            # Decode the unverified header to get the 'kid'
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")
            if not kid:
                raise Exception("No kid in JWT header")
                
            jwks = get_jwks()
            if not jwks:
                raise Exception("Could not retrieve Clerk JWKS")
                
            # Find the corresponding public key
            rsa_key = {}
            for key in jwks.get("keys", []):
                if key["kid"] == kid:
                    rsa_key = {
                        "kty": key["kty"],
                        "kid": key["kid"],
                        "use": key["use"],
                        "n": key["n"],
                        "e": key["e"]
                    }
                    break
            
            if not rsa_key:
                raise Exception("Unable to find appropriate key in JWKS")
                
            public_key = RSAAlgorithm.from_jwk(json.dumps(rsa_key))
            
            # Verify the token
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                options={"verify_aud": False}
            )
            
            # Store clerk_id
            request.current_user_id = payload.get("sub")
            
        except Exception as e:
            print(f"Token verification failed: {e}")
            return jsonify({"error": "Invalid token", "details": str(e)}), 401
            
        return f(*args, **kwargs)
    return decorated
