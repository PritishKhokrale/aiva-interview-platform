from flask import Blueprint, jsonify, request
from services.ai_engine import generate_aptitude_questions, evaluate_aptitude_test
from database.supabase_client import get_supabase_client

aptitude_bp = Blueprint('aptitude', __name__)

# Global state for prototype: mapping aptitude_id -> dict
current_aptitude_sessions = {}

@aptitude_bp.route('/generate', methods=['POST'])
def generate_test():
    global current_aptitude_sessions
    data = request.json or {}
    sections = data.get("sections", ["Quantitative", "Logical", "Verbal"])
    role = data.get("role", "Software Engineer")
    difficulty = data.get("difficulty", "medium")
    
    questions = generate_aptitude_questions(sections, role, difficulty)
    
    # Store briefly in memory to validate answers later
    import uuid
    session_id = str(uuid.uuid4())
    current_aptitude_sessions[session_id] = {
        "questions": questions,
        "role": role,
        "sections": sections
    }
    
    return jsonify({
        "session_id": session_id,
        "questions": questions
    })

@aptitude_bp.route('/evaluate', methods=['POST'])
def submit_and_evaluate():
    global current_aptitude_sessions
    data = request.json or {}
    session_id = data.get("session_id")
    user_answers = data.get("answers", {}) # { "1": "Option A" }
    interview_id = data.get("interview_id") # Link to the interview row

    if session_id not in current_aptitude_sessions:
        return jsonify({"error": "Session expired or not found"}), 404
        
    session = current_aptitude_sessions[session_id]
    evaluation = evaluate_aptitude_test(session["questions"], user_answers)
    
    # DB Persistence
    supabase = get_supabase_client()
    if supabase and interview_id and interview_id != "demo_id":
        try:
            # Check session mode to determine if we should mark it completed
            existing = supabase.table("interviews").select("session_mode").eq("id", interview_id).execute()
            status_val = "in_progress"
            if existing.data and len(existing.data) > 0:
                if existing.data[0].get("session_mode") == "apti":
                    status_val = "completed"
                    
            # Update the interview row with aptitude results
            update_data = {
                "aptitude_score": evaluation["overall_score"],
                "aptitude_data": evaluation,
            }
            # Only update status if it's an apti-only session
            if status_val == "completed":
                update_data["status"] = "completed"
                
            resp = supabase.table("interviews").update(update_data).eq("id", interview_id).execute()
            
            if not resp.data:
                print(f"Update returned no data for interview_id: {interview_id}")
        except Exception as e:
            print(f"Supabase Persistence Error: {e}")

    return jsonify(evaluation)

@aptitude_bp.route('/session-data/<session_id>', methods=['GET'])
def get_session_data(session_id):
    session = current_aptitude_sessions.get(session_id)
    if not session:
        return jsonify({"error": "Not found"}), 404
    return jsonify(session)
