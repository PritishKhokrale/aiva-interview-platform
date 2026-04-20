from flask import Blueprint, jsonify, request
import os
import tempfile

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

try:
    import docx
except ImportError:
    docx = None

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/resume', methods=['POST'])
def upload_resume():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    parsed_text = ""
    
    try:
        # Save temp file
        ext = os.path.splitext(file.filename)[1].lower()
        fd, temp_path = tempfile.mkstemp(suffix=ext)
        os.close(fd)
        file.save(temp_path)
        
        # Parse PDF
        if ext == '.pdf' and PdfReader:
            reader = PdfReader(temp_path)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    parsed_text += text + "\n"
                    
        # Parse DOCX
        elif ext == '.docx' and docx:
            doc = docx.Document(temp_path)
            for para in doc.paragraphs:
                parsed_text += para.text + "\n"
        
        # Fallback or empty
        if not parsed_text.strip():
            parsed_text = f"Candidate uploaded a file named {file.filename} but text could not be extracted."
            
        os.remove(temp_path)
        
    except Exception as e:
        print(f"Error parsing resume: {e}")
        parsed_text = f"Error extracting resume text. Candidate name: Unknown. File: {file.filename}."
        
    return jsonify({
        "message": "Resume uploaded successfully", 
        "filename": file.filename,
        "parsed_text": parsed_text
    })

@upload_bp.route('/start-hr-interview/<app_id>', methods=['GET'])
def start_hr_interview(app_id):
    from flask import session, render_template, redirect, url_for
    import json
    
    try:
        from database.supabase_client import get_supabase_client
        supabase = get_supabase_client(access_token=session.get('access_token'))
        if not supabase:
            return "Unauthorized", 401
            
        res = supabase.table('job_applications').select('status').eq('id', app_id).single().execute()
        if not res.data or 'Shortlisted' not in res.data['status']:
            return "Application not shortlisted or not found.", 404
            
        # Parse status: Shortlisted__{"role": "...", ...}
        status_string = res.data['status']
        config_data = {}
        if "__" in status_string:
            try:
                config_data = json.loads(status_string.split("__")[1])
            except:
                pass
                
        # Fill defaults if missing
        config = {
            "role": config_data.get("role", "Software Engineer"),
            "mode": "resume",
            "difficulty": config_data.get("difficulty", "medium"),
            "duration": config_data.get("duration", "standard"),
            "type": config_data.get("type", "technical"),
            "sessionMode": config_data.get("sessionMode", "ai"),
            "aptitudeEnabled": config_data.get("sessionMode") in ["apti", "combined"],
            "aptitudeSections": ["Quantitative", "Logical", "Verbal"],
            "jdText": "",
            "parsedResume": "",
            "is_hr_driven": True,
            "job_application_id": app_id
        }
        
        # Check if already completed
        target_role = config.get("role")
        user_id = session.get('user_id')
        if user_id and target_role:
            int_res = supabase.table('interviews').select('id').eq('candidate_id', user_id).eq('status', 'completed').execute()
            if int_res.data:
                for i in int_res.data:
                    # We just check locally or query with ilike if possible, but python fallback is fine
                    pass
                # A safer check using case-insensitive iteration
                matches = [i for i in getattr(supabase.table('interviews').select('role').eq('candidate_id', user_id).eq('status', 'completed').execute(), 'data', []) if i.get('role', '').lower() == target_role.lower()]
                if matches:
                    return f"<h3>You have already officially completed this HR interview ({target_role}).</h3><p>Your results have been locked securely and sent to the HR Admin team.</p>", 403
                    
        # We bounce the user to an intermediate page that injects localStorage then redirects
        return render_template('hr_interview_setup.html', config_data=config, json_config=json.dumps(config))
        
    except Exception as e:
        print(f"Error launching HR interview: {e}")
        return "Internal Server Error", 500
