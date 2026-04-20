import os
from dotenv import load_dotenv
load_dotenv() # Load from .env file

from flask import Flask, render_template, session, request, redirect, url_for, flash
from flask_cors import CORS

app = Flask(__name__, template_folder='../frontend/templates', static_folder='../frontend/static')
app.secret_key = os.environ.get("SECRET_KEY", "b3d5c6f8a1e2f3d4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a")
CORS(app)

# Register Blueprints
from routes.interview import interview_bp
from routes.upload import upload_bp
from routes.report import report_bp
from routes.aptitude import aptitude_bp
from routes.auth import auth_bp, login_required
from routes.hr import hr_bp

app.register_blueprint(interview_bp, url_prefix='/api/interview')
app.register_blueprint(upload_bp, url_prefix='/api/upload')
app.register_blueprint(report_bp, url_prefix='/api/report')
app.register_blueprint(aptitude_bp, url_prefix='/api/aptitude')
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(hr_bp, url_prefix='/hr')

@app.route('/')
def landing_page():
    return render_template('landing.html')

@app.route('/job_drives')
def job_drives_page():
    drives = []
    try:
        from database.supabase_client import get_supabase_client
        access_token = session.get('access_token')
        supabase = get_supabase_client(access_token=access_token)
        if supabase:
            # Fetch all public job drives
            res = supabase.table('job_drives').select('*').order('created_at', desc=True).execute()
            if res.data:
                drives = res.data
            else:
                print("Job drives returned empty from Supabase (potentially RLS or empty table).")
                
            # Fetch user applications
            user_id = session.get('user_id')
            applied_map = {}
            if user_id:
                app_res = supabase.table('job_applications').select('id, job_drive_id, status, job_drives(job_role)').eq('candidate_id', user_id).execute()
                if app_res.data:
                    int_res = supabase.table('interviews').select('id, role, status').eq('candidate_id', user_id).eq('status', 'completed').execute()
                    
                    for app in app_res.data:
                        target_role = app.get('job_drives', {}).get('job_role', '')
                        status_string = app.get('status', '')
                        
                        has_completed = False
                        if "Shortlisted__" in status_string:
                            import json
                            try:
                                config_json = json.loads(status_string.split('__')[1])
                                if 'role' in config_json:
                                    target_role = config_json['role']
                            except: pass
                            
                            if int_res.data:
                                matches = [i for i in int_res.data if i['role'].lower() == target_role.lower()]
                                if matches:
                                    has_completed = True
                        
                        applied_map[app['job_drive_id']] = {
                            "status": status_string,
                            "id": app['id'],
                            "completed": has_completed
                        }
    except Exception as e:
        print(f"Error fetching job drives for candidates: {e}")
        applied_map = {}
        
    return render_template('student_job_drives.html', drives=drives, applied_map=applied_map)

@app.route('/apply/<job_id>', methods=['POST'])
@login_required
def apply_job(job_id):
    if session.get('role') != 'candidate':
        flash("Only candidates can apply to job drives.", "error")
        return redirect(url_for('job_drives_page'))
        
    try:
        from database.supabase_client import get_supabase_client
        access_token = session.get('access_token')
        user_id = session.get('user_id')
        supabase = get_supabase_client(access_token=access_token)
        
        if supabase:
            # Upsert fails safely, or we let constraint block duplicates
            payload = {
                'job_drive_id': job_id,
                'candidate_id': user_id,
                'status': 'Pending Review'
            }
            supabase.table('job_applications').insert(payload).execute()
            flash("Application submitted successfully! The HR team will review your profile.", "success")
    except Exception as e:
        err_msg = str(e)
        if "duplicate key" in err_msg.lower() or "unique constraint" in err_msg.lower():
            flash("You have already applied for this job drive.", "error")
        else:
            flash("Failed to submit application. Please make sure the applications table exists.", "error")
            print(f"Application Error: {e}")
            
    return redirect(url_for('job_drives_page'))

@app.route('/hr_dashboard')
@login_required
def hr_dashboard_page():
    if session.get('role') != 'hr':
        return redirect(url_for('dashboard_page'))
    return render_template('hr_dashboard.html')

@app.route('/dashboard')
@login_required
def dashboard_page():
    if session.get('role') == 'hr':
        return redirect(url_for('hr_dashboard_page'))
        
    recent_interviews = []
    total_practices = 0
    avg_score = 0
    highest_score = 0
    
    try:
        from database.supabase_client import get_supabase_client
        
        access_token = session.get('access_token')
        supabase = get_supabase_client(access_token=access_token)
        if supabase:
            # Fetch user's interviews (RLS guarantees correct filtering if token is provided)
            # If RLS isn't properly set, we can also explicitly filter just in case
            user_id = session.get('user_id')
            query = supabase.table("interviews") \
                .select("id, role, created_at, status, session_mode, aptitude_score, candidates(name), interview_reports(overall_score)")
            
            if user_id:
                query = query.eq("candidate_id", user_id)
                
            resp = query.order("created_at", desc=True).execute()
            
            if resp.data:
                recent_interviews = resp.data
                total_practices = len(recent_interviews)
                
                # Compute scores from completed interviews that have reports
                scores = []
                for iv in recent_interviews:
                    report = iv.get("interview_reports")
                    if report and isinstance(report, dict) and report.get("overall_score") is not None:
                        scores.append(report["overall_score"])
                    elif report and isinstance(report, list) and len(report) > 0 and report[0].get("overall_score") is not None:
                        scores.append(report[0]["overall_score"])
                    else:
                        # FAILSAFE FALLBACK check history
                        hist = iv.get("history", [])
                        if hist and len(hist) > 0 and isinstance(hist[-1], dict) and hist[-1].get("role") == "evaluation":
                            import json
                            try:
                                fall_score = json.loads(hist[-1]["content"]).get("overall_score", 0)
                                scores.append(fall_score)
                            except: pass
                
                if scores:
                    avg_score = round(sum(scores) / len(scores))
                    highest_score = max(scores)
                    
                # Only show the 10 most recent in the table
                recent_interviews = recent_interviews[:10]
    except Exception as e:
        import traceback
        print(f"ERROR fetching dashboard data: {e}")
        traceback.print_exc()
        
    return render_template('dashboard.html', 
                           recent_interviews=recent_interviews,
                           total_practices=total_practices,
                           avg_score=avg_score,
                           highest_score=highest_score)

@app.route('/upload')
@login_required
def upload_page():
    return render_template('upload.html')

@app.route('/my-interviews')
@login_required
def my_interviews_page():
    all_interviews = []
    try:
        from database.supabase_client import get_supabase_client
        access_token = session.get('access_token')
        supabase = get_supabase_client(access_token=access_token)
        if supabase:
            user_id = session.get('user_id')
            query = supabase.table("interviews") \
                .select("*, candidates(name), interview_reports(*)")
            if user_id:
                query = query.eq("candidate_id", user_id)
                
            resp = query.order("created_at", desc=True).execute()
            if resp.data:
                for iv in resp.data:
                    rep = iv.get("interview_reports")
                    if not rep or (isinstance(rep, list) and len(rep) == 0):
                        hist = iv.get("history", [])
                        if hist and len(hist) > 0 and isinstance(hist[-1], dict) and hist[-1].get("role") == "evaluation":
                            import json
                            try:
                                fallback_eval = json.loads(hist[-1]["content"])
                                iv["interview_reports"] = [{
                                    "overall_score": fallback_eval.get("overall_score", 0),
                                    "summary": fallback_eval.get("summary", {}).get("overview", "Evaluated") if isinstance(fallback_eval.get("summary"), dict) else fallback_eval.get("summary", "Evaluated"),
                                    "metrics": fallback_eval.get("metrics", {})
                                }]
                            except: pass
                all_interviews = resp.data
    except Exception as e:
        print(f"Error fetching interviews: {e}")
        
    return render_template('my_interviews.html', interviews=all_interviews)

@app.route('/interview')
@login_required
def interview_page():
    return render_template('interview.html')

@app.route('/aptitude')
@login_required
def aptitude_page():
    return render_template('aptitude.html')

@app.route('/aptitude-report')
@login_required
def aptitude_report_page():
    from flask import request
    interview_id = request.args.get('interview_id')
    results = None
    if interview_id:
        from database.supabase_client import get_supabase_client
        access_token = session.get('access_token')
        supabase = get_supabase_client(access_token=access_token)
        if supabase:
            resp = supabase.table("interviews").select("aptitude_data").eq("id", interview_id).execute()
            if resp.data and len(resp.data) > 0:
                results = resp.data[0].get("aptitude_data")
                
    return render_template('aptitude_report.html', results=results)

@app.route('/report')
@login_required
def report_page():
    return render_template('report.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
