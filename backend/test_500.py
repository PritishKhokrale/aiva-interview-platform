"""
Test with a real interview ID from the database to reproduce 500 error.
"""
import sys, os
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
import traceback

from app import app
app.config['TESTING'] = True
app.config['PROPAGATE_EXCEPTIONS'] = True

from database.supabase_client import get_supabase_client

sb = get_supabase_client()

print("=== Finding completed interviews in DB ===")
try:
    iv_resp = sb.table('interviews').select('id, candidate_id, status').order('created_at', desc=True).limit(5).execute()
    print(f"Found {len(iv_resp.data)} interviews (anon query - may be RLS-filtered)")
    for iv in iv_resp.data:
        print(f"  ID: {iv['id']}, status: {iv['status']}")
except Exception as e:
    print(f"DB error: {e}")

print("\n=== Testing report render with fake session ===")
with app.test_client() as client:
    with client.session_transaction() as sess:
        sess['access_token'] = 'fake_token_for_test'
        sess['user_id'] = '00000000-0000-0000-0000-000000000000'

    try:
        resp = client.get('/api/report/00000000-0000-0000-0000-000000000002')
        print(f"Status: {resp.status_code}")
        data = resp.data.decode('utf-8')
        if resp.status_code != 200:
            # Show last 3000 chars which usually has the actual error
            print("Error content (last 3000 chars):")
            print(data[-3000:])
        else:
            print("Render OK")
    except Exception as e:
        traceback.print_exc()
