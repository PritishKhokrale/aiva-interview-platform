import os
import sys
from dotenv import load_dotenv

# Add the project root to sys.path
sys.path.append(os.getcwd())

from database.supabase_client import get_supabase_client

load_dotenv()

def diagnostic_test():
    print("--- AIVA Database Diagnostic Test ---")
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    
    print(f"SUPABASE_URL: {url}")
    print(f"SUPABASE_KEY: {'[SET]' if key else '[MISSING]'}")
    
    if not url or not key:
        print("ERROR: Environment variables missing.")
        return

    # 1. Test basic connection
    try:
        supabase = get_supabase_client()
        if not supabase:
            print("ERROR: get_supabase_client returned None.")
            return
        print("SUCCESS: Supabase client initialized.")
        
        # 2. Try to fetch a user to test connectivity
        try:
            res = supabase.table("candidates").select("*").limit(1).execute()
            print(f"SUCCESS: Successfully queried 'candidates' table. Found {len(res.data)} records.")
        except Exception as e:
            print(f"ERROR: Failed to query 'candidates' table: {e}")

        # 3. Try a dummy insert into 'interviews'
        # We need a valid user_id if RLS is on, but we'll try anonymized first if possible
        # Or just check the schema by listing columns
        print("\nAttempting dummy insert into 'interviews'...")
        dummy_data = {
            "role": "Diagnostic Test",
            "difficulty": "none",
            "status": "in_progress",
            "history": []
        }
        
        try:
            # Note: This might fail if candidate_id is required
            res = supabase.table("interviews").insert(dummy_data).execute()
            print(f"SUCCESS: Inserted dummy interview. ID: {res.data[0]['id']}")
            # Cleanup
            supabase.table("interviews").delete().eq("id", res.data[0]['id']).execute()
            print("SUCCESS: Deleted dummy interview.")
        except Exception as e:
            print(f"ERROR during 'interviews' insert: {e}")
            print("TIP: If this fails with 'violates foreign key constraint' or 'is null', it means candidate_id is mandatory.")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")

if __name__ == "__main__":
    diagnostic_test()
