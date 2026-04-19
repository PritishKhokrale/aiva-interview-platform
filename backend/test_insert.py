import os, random, string
from dotenv import load_dotenv
load_dotenv('.env')
from database.supabase_client import get_supabase_client
from supabase import create_client

supabase = get_supabase_client()

def rand_string(len=8):
    return ''.join(random.choices(string.ascii_lowercase, k=len))

print('Attempting to create test user and insert records...')
try:
    # 1. Sign up test user
    email = f"{rand_string()}@test.com"
    pwd = "Password123!"
    res = supabase.auth.sign_up({"email": email, "password": pwd, "options": {"data": {"full_name": "Test"}}})
    print("Signed up user.")

    token = res.session.access_token
    uid = res.user.id
    
    auth_client = get_supabase_client(access_token=token)
    
    # Insert candidate explicitly just to be safe
    auth_client.table('candidates').upsert({'id': uid, 'name': 'Test User', 'email': email}).execute()
    print("Upserted candidate.")

    # 2. Insert interview
    iv_data = {
        "candidate_id": uid,
        "role": "Test Role",
        "difficulty": "medium",
        "status": "in_progress",
        "history": []
    }
    iv_res = auth_client.table('interviews').insert(iv_data).execute()
    iv_id = iv_res.data[0]['id']
    print(f"Inserted interview: {iv_id}")
    
    # 3. Insert interview_reports
    rep_data = {
        "interview_id": iv_id,
        "overall_score": 50,
        "summary": "This is a test summary.",
        "strengths": ["test"],
        "weaknesses": ["test"],
        "metrics": {"technical": 50, "communication": 50}
    }
    
    try:
        rep_res = auth_client.table('interview_reports').insert(rep_data).execute()
        print(f"Inserted interview report successfully!")
    except Exception as rep_e:
        print(f"REPORT INSERT ERROR: {rep_e}")

except Exception as e:
    print(f"CRITICAL TEST ERROR: {e}")
