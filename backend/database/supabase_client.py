import os
from supabase import create_client, Client, ClientOptions

def get_supabase_client(access_token=None) -> Client:
    """
    Returns an initialized Supabase client using environment variables.
    If access_token is provided, it uses it in the headers for Row Level Security.
    """
    url: str = os.environ.get("SUPABASE_URL", "")
    key: str = os.environ.get("SUPABASE_KEY", "")
    
    if not url or not key:
        print("Warning: Missing SUPABASE_URL or SUPABASE_KEY environment variables.")
        return None
        
    options = None
    if access_token:
        options = ClientOptions(headers={"Authorization": f"Bearer {access_token}"})
        return create_client(url, key, options=options)
        
    return create_client(url, key)
