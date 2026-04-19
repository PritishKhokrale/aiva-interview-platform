import os
from dotenv import load_dotenv
load_dotenv() # Load from .env file

from flask import Flask, render_template, session, request
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

app.register_blueprint(interview_bp, url_prefix='/api/interview')
app.register_blueprint(upload_bp, url_prefix='/api/upload')
app.register_blueprint(report_bp, url_prefix='/api/report')
app.register_blueprint(aptitude_bp, url_prefix='/api/aptitude')
app.register_blueprint(auth_bp, url_prefix='/auth')

@app.route('/')
def landing_page():
    return render_template('landing.html')

@app.route('/dashboard')
@login_required
def dashboard_page():
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
        supabase = get_supabase_client()
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
