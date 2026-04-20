from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, flash
import os
from database.supabase_client import get_supabase_client
from functools import wraps

hr_bp = Blueprint('hr', __name__)

def hr_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get('role') != 'hr' or not session.get('access_token'):
            flash("You do not have permission to access the HR portal.", "error")
            return redirect(url_for('auth.login_page'))
        return f(*args, **kwargs)
    return decorated_function

@hr_bp.route('/config', methods=['GET'])
@hr_required
def config_page():
    # Fetch existing drives for this HR admin
    drives = []
    try:
        supabase = get_supabase_client(access_token=session.get('access_token'))
        # Using RLS, this will automatically just return their own job drives (or we can filter manually for safety)
        res = supabase.table('job_drives').select('*').order('created_at', desc=True).execute()
        if res.data:
            drives = res.data
    except Exception as e:
        print(f"Error fetching job drives: {e}")
        
    return render_template('hr_config.html', drives=drives)

@hr_bp.route('/config/create', methods=['POST'])
@hr_required
def create_drive():
    try:
        company_name = request.form.get('company_name')
        job_role = request.form.get('job_role')
        ctc = request.form.get('ctc')
        bond = request.form.get('bond')
        min_rank = request.form.get('min_rank')
        difficulty = request.form.get('difficulty')
        
        # Convert min_rank to integer if supplied, otherwise pass None
        rank_val = None
        if min_rank and min_rank.strip():
            try:
                rank_val = int(min_rank)
            except:
                pass
                
        supabase = get_supabase_client(access_token=session.get('access_token'))
        hr_id = session.get('user_id')
        
        payload = {
            'hr_id': hr_id,
            'company_name': company_name,
            'job_role': job_role,
            'ctc': ctc,
            'bond': bond,
            'min_rank': rank_val,
            'difficulty': difficulty
        }
        
        supabase.table('job_drives').insert(payload).execute()
        flash("Job Drive successfully launched and broadcasted!", "success")
        
    except Exception as e:
        print(f"Error creating job drive: {e}")
        flash(f"Failed to create Job Drive. Make sure the database table exists. {str(e)}", "error")
        
    return redirect(url_for('hr.config_page'))

@hr_bp.route('/candidate/<candidate_id>', methods=['GET'])
@hr_required
def review_candidate(candidate_id):
    app_id = request.args.get('app_id')
    candidate_profile = None
    interviews = []
    
    # Aggregation Stats
    total_tests = 0
    avg_score = 0
    highest_score = 0
    recommended_roles = []
    
    try:
        supabase = get_supabase_client(access_token=session.get('access_token'))
        
        # 1. Fetch Candidate Base Info
        cand_res = supabase.table('candidates').select('*').eq('id', candidate_id).single().execute()
        candidate_profile = cand_res.data
        
        # 2. Fetch all Interviews for this candidate to calculate stats
        # Require 'candidates' RLS to be open, and 'interviews' RLS to be open for HR
        int_res = supabase.table('interviews').select('*, interview_reports(overall_score)').eq('candidate_id', candidate_id).execute()
        if int_res.data:
            interviews = int_res.data
            total_tests = len(interviews)
            
            scores = []
            for i in interviews:
                # If reports exist and have a score
                if 'interview_reports' in i and i['interview_reports']:
                    # We might get a list of reports or a single report based on 1:1 or 1:many relation mapping
                    reports = i['interview_reports']
                    if isinstance(reports, list) and len(reports) > 0:
                        score = reports[0].get('overall_score', 0)
                        scores.append(score)
                    elif isinstance(reports, dict):
                        score = reports.get('overall_score', 0)
                        scores.append(score)
                        
            if scores:
                highest_score = max(scores)
                avg_score = sum(scores) / len(scores)
                avg_score = round(avg_score, 1)
                
            # AI Recommendation: Unique roles across all historical interviews (Max 2)
            if interviews:
                unique_roles = list(set([i.get('role') for i in interviews if i.get('role')]))
                # Filter out 'Unknown' if we have other valid roles
                valid_roles = [r for r in unique_roles if r.lower() != 'unknown']
                
                if not valid_roles and unique_roles:
                    valid_roles = unique_roles
                    
                recommended_roles = valid_roles[:2]
                
    except Exception as e:
        print(f"Error fetching candidate profile in HR view: {e}")
        flash("Could not fetch candidate details. Ensure RLS policies are set.", "error")
        
    return render_template(
        'hr_candidate_profile.html', 
        candidate=candidate_profile, 
        total_tests=total_tests, 
        avg_score=avg_score, 
        highest_score=highest_score,
        recommended_roles=recommended_roles,
        app_id=app_id
    )

@hr_bp.route('/shortlist/<app_id>', methods=['POST'])
@hr_required
def shortlist_candidate(app_id):
    try:
        import json
        config = {
            "role": request.form.get("role", "Software Engineer"),
            "sessionMode": request.form.get("sessionMode", "ai"),
            "duration": request.form.get("duration", "standard"),
            "type": request.form.get("type", "technical"),
            "difficulty": request.form.get("difficulty", "medium"),
            "is_hr_driven": True
        }
        status_string = f"Shortlisted__{json.dumps(config)}"
        supabase = get_supabase_client(access_token=session.get('access_token'))
        res = supabase.table("job_applications").update({"status": status_string}).eq("id", app_id).execute()
        
        if hasattr(res, 'data') and len(res.data) == 0:
            flash("Failed to shortlist candidate: RLS Policy blocked the update. Please run the SQL command in Supabase.", "error")
        else:
            flash("Candidate successfully advanced to Shortlist. Targeted AI Interview configured.", "success")
    except Exception as e:
        print(f"Error shortlisting: {e}")
        flash("Failed to shortlist candidate. Check DB credentials.", "error")
    return redirect(url_for('hr.candidate_pool'))

@hr_bp.route('/candidates', methods=['GET'])
@hr_required
def candidate_pool():
    applicants = []
    try:
        supabase = get_supabase_client(access_token=session.get('access_token'))
        # RLS policy automatically filters this to ONLY applications for this HR's job drives
        res = supabase.table('job_applications').select('*, candidates(name, email), job_drives(job_role, company_name)').order('applied_at', desc=True).execute()
        
        if res.data:
            applicants = res.data
            # Now we attach matching completed interviews for HR specific job_roles
            # We map this manually because job_applications does not foreign-key interviews.
            cand_ids = [app.get('candidate_id') for app in applicants if app.get('candidate_id')]
            if cand_ids:
                 int_res = supabase.table('interviews').select('id, candidate_id, role, status').in_('candidate_id', cand_ids).eq('status', 'completed').execute()
                 if int_res.data:
                      for app in applicants:
                          target_role = app.get('job_drives', {}).get('job_role', '')
                          # Find an interview for this candidate matching the role
                          matches = [i for i in int_res.data if i['candidate_id'] == app['candidate_id'] and i['role'] == target_role]
                          if matches:
                              app['completed_interview_id'] = matches[0]['id']
    except Exception as e:
        print(f"Error fetching HR applicants: {e}")
        flash("Failed to fetch candidate pool. Please check permissions.", "error")
        
    return render_template('hr_candidates.html', applicants=applicants)
