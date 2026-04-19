import os
from dotenv import load_dotenv
load_dotenv('.env')
from database.supabase_client import get_supabase_client

supabase = get_supabase_client()
print('Querying Supabase interviews...')
try:
    resp = supabase.table('interviews').select('id, candidate_id, created_at, status, role').order('created_at', desc=True).limit(5).execute()
    interviews = resp.data
    print(f'Recent interviews: {len(interviews)}')
    for iv in interviews:
        print(iv)
        
    print('\nQuerying Supabase interview_reports...')
    resp2 = supabase.table('interview_reports').select('interview_id, overall_score, created_at').order('created_at', desc=True).limit(5).execute()
    reports = resp2.data
    print(f'Recent reports: {len(reports)}')
    for r in reports:
        print(r)
except Exception as e:
    print(f'ERROR: {e}')
