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
