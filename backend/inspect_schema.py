import os
import sys
from dotenv import load_dotenv

# Add the project root to sys.path
sys.path.append(os.getcwd())

from database.supabase_client import get_supabase_client

load_dotenv()

def inspect_schema():
    print("--- AIVA Table Schema Extraction ---")
    supabase = get_supabase_client()
    if not supabase:
        print("ERROR: Supabase client failed.")
        return

    tables = ["interviews", "interview_reports", "candidates"]
    
    for table in tables:
        print(f"\n--- Table: {table} ---")
        try:
            # We can use a neat trick to get column names by doing a failed select or just a limit 1
            res = supabase.table(table).select("*").limit(1).execute()
            if res.data:
                print(f"Columns (from data sample): {list(res.data[0].keys())}")
            else:
                print("Table is empty, trying to infer from error or other means...")
                # Try inserting a completely empty dict to see what's required in the error hint
                try:
                    supabase.table(table).insert({}).execute()
                except Exception as insert_err:
                    print(f"Insert Hint / Error: {insert_err}")
        except Exception as e:
            print(f"Error inspecting {table}: {e}")

if __name__ == "__main__":
    inspect_schema()
