import os
import uuid
from dotenv import load_dotenv
load_dotenv('.env')
from database.supabase_client import get_supabase_client

supabase = get_supabase_client()
print('Testing insert WITHOUT candidate_id but valid UUID...')
test_uuid = str(uuid.uuid4())
try:
    resp = supabase.table('interview_reports').insert({'interview_id': test_uuid, 'overall_score': 0}).execute()
    print('SUCCESS')
except Exception as e:
    print(f'ERROR: {e}')
