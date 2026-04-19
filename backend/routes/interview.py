from flask import Blueprint, jsonify, request, session
import os
import tempfile
from services.ai_engine import generate_next_interaction, evaluate_full_interview
from services.speech_engine import speech_to_text
from database.supabase_client import get_supabase_client

interview_bp = Blueprint('interview', __name__)

# Global state for prototype: mapping interview_id (str) -> dict
current_interviews: dict = {}

@interview_bp.route('/start', methods=['POST'])
def start_interview():
    global current_interviews
    config = request.json or {}
    
    # Normally this comes from an uploaded resume parsed via resume_parser.py
    candidate_profile = {
        "name": "Applicant",
        "email": "candidate@example.com",
        "skills": ["Not specified"],
        "experience": "Not specified",
        "role": config.get("role", "Software Engineer")
    }
    
    if config.get("mode") == "resume" and config.get("parsedResume"):
        candidate_profile["resume_text"] = config.get("parsedResume")
    
    # Supabase Integration
    access_token = session.get('access_token')
    candidate_id = session.get('user_id')
    supabase = get_supabase_client(access_token=access_token)
    interview_id = config.get("interview_id", "demo_id")
    
    if supabase and candidate_id:
        try:
            # If interview_id is provided, check if it exists
            if interview_id != "demo_id":
                existing = supabase.table("interviews").select("*").eq("id", interview_id).execute()
                if existing.data and len(existing.data) > 0:
                    # Session exists, just return it
                    first_question = generate_next_interaction([], candidate_profile, config)
                    return jsonify({
                        "interview_id": interview_id,
                        "first_question": first_question
                    })
            
            # Insert Interview
            data_to_insert = {
                "candidate_id": candidate_id,
                "role": candidate_profile["role"],
                "difficulty": config.get("difficulty", "medium"),
                "session_mode": config.get("sessionMode", "ai"), # Store mode
                "status": "in_progress",
                "history": []
            }
            interview_resp = supabase.table("interviews").insert(data_to_insert).execute()
            
            if not interview_resp.data:
                raise Exception(f"Supabase returned empty data on insert: {interview_resp}")
                
            interview_id = interview_resp.data[0]["id"]
            
        except Exception as e:
            import traceback
            print(f"CRITICAL: Supabase Insert Error in /start: {e}")
            traceback.print_exc()
            # If DB fails, we fallback but log it clearly
            interview_id = "demo_id"
    else:
        print(f"WARNING: Starting interview in DEMO MODE. Reason: supabase={bool(supabase)}, candidate_id={candidate_id}")
        interview_id = "demo_id"
            
    # Initialize state for this specific interview
    current_interviews[interview_id] = {
        "history": [],
        "profile": candidate_profile,
        "config": config,
        "evaluation": {},
        "access_token": access_token,
        "candidate_id": candidate_id
    }

    # Generate the VERY FIRST question by passing empty history
    history_list = current_interviews[interview_id]["history"]
    first_question_text = generate_next_interaction([], candidate_profile, config)
    
    # Save the AI's question to the history
    if isinstance(history_list, list):
        history_list.append({"role": "assistant", "content": first_question_text})
        
        # Optionally update Supabase history immediately
        if supabase and interview_id != "demo_id":
             supabase.table("interviews").update({"history": history_list}).eq("id", interview_id).execute()

    return jsonify({
        "message": "Interview started", 
        "first_question": first_question_text,
        "interview_id": interview_id
    })


@interview_bp.route('/submit-answer', methods=['POST'])
def submit_answer():
    global current_interviews
    
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
        
    audio_file = request.files['audio']
    interview_id = request.form.get('interview_id', 'demo_id')
    
    if interview_id not in current_interviews:
        return jsonify({"error": "Interview session not found or expired"}), 404
        
    iv_session = current_interviews[interview_id]
    
    # Save audio temporarily
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, "answer.wav")
    audio_file.save(temp_path)
    
    # 1. Convert Speech to Text
    transcript = speech_to_text(temp_path)
    print(f"\n[Candidate Answer]: {transcript}\n")
    
    if os.path.exists(temp_path):
        try: os.remove(temp_path)
        except: pass
            
    # 2. Add User's answer to history
    history_list = iv_session["history"]
    if isinstance(history_list, list):
        history_list.append({"role": "user", "content": transcript})
    
    # 3. Generate the AI's natural follow-up response / question
    ai_response = generate_next_interaction(
        history_list, 
        iv_session.get("profile", {}), 
        iv_session.get("config", {})
    )
    
    # 4. Add AI's answer to history
    if isinstance(history_list, list):
        history_list.append({"role": "assistant", "content": ai_response})
        
        # Update Supabase history using the pinned token
        access_token = iv_session.get('access_token')
        supabase = get_supabase_client(access_token=access_token)
        if supabase and interview_id != "demo_id":
             supabase.table("interviews").update({"history": history_list}).eq("id", interview_id).execute()
    
    return jsonify({
        "status": "success",
        "transcript": transcript,
        "next_question": ai_response,
        "history": history_list
    })

@interview_bp.route('/evaluate', methods=['POST'])
def finish_and_evaluate():
    """ Called when the interview is explicitly ended to generate the final report """
    global current_interviews
    request_data = request.json or {}
    interview_id = request_data.get('interview_id', 'demo_id')
    
    if interview_id not in current_interviews:
        return jsonify({"error": "Interview session not found"}), 404
        
    iv_session = current_interviews[interview_id]
    
    evaluation_result = evaluate_full_interview(
        iv_session.get("history", []),
        iv_session.get("profile", {}),
        iv_session.get("config", {})
    )
    
    # Store it in memory for the report page to fetch initially
    iv_session["evaluation"] = evaluation_result
    
    # DB Persistence
    access_token = iv_session.get('access_token')
    candidate_id = iv_session.get('candidate_id')
    supabase = get_supabase_client(access_token=access_token)
    if supabase and interview_id != "demo_id":
        try:
            # Mark interview complete
            supabase.table("interviews").update({"status": "completed"}).eq("id", interview_id).execute()
            
            summary_dict = evaluation_result.get("summary", {})
            summary_text = summary_dict.get("overview", "") if isinstance(summary_dict, dict) else summary_dict

            # Sanitize overall_score to ensure Postgres integer column safety
            raw_score = evaluation_result.get("overall_score", 0)
            if isinstance(raw_score, str):
                import re
                match = re.search(r'\d+', str(raw_score))
                safe_score = int(match.group()) if match else 0
            else:
                try: safe_score = int(raw_score)
                except: safe_score = 0
                
            # Ensure strengths and weaknesses are strictly lists
            strengths = evaluation_result.get("strengths", [])
            weaknesses = evaluation_result.get("weaknesses", [])
            if not isinstance(strengths, list): strengths = [str(strengths)]
            if not isinstance(weaknesses, list): weaknesses = [str(weaknesses)]

            # Save report
            supabase.table("interview_reports").insert({
                "interview_id": interview_id,
                "overall_score": safe_score,
                "summary": str(summary_text),
                "strengths": strengths,
                "weaknesses": weaknesses,
                "metrics": {
                    **(evaluation_result.get("metrics") if isinstance(evaluation_result.get("metrics"), dict) else {}),
                    "extended_data": {
                        "red_flags": evaluation_result.get("red_flags", []),
                        "final_verdict": evaluation_result.get("final_verdict", "Borderline"),
                        "improvement_plan": evaluation_result.get("improvement_plan", {}),
                        "question_analysis": evaluation_result.get("question_analysis", []),
                        "type": summary_dict.get("type", "Unknown") if isinstance(summary_dict, dict) else "Unknown",
                        "difficulty_faced": summary_dict.get("difficulty_faced", "Unknown") if isinstance(summary_dict, dict) else "Unknown"
                    }
                }
            }).execute()
        except Exception as e:
            print(f"CRITICAL: Failed to save report to Supabase: {e}")
            with open("db_error.txt", "w") as f:
                f.write(f"Interview ID: {interview_id}\nCandidate ID: {candidate_id}\nError: {str(e)}\n\n")
            import traceback
            traceback.print_exc()
    else:
        print(f"INFO: Skipped Supabase persistence in /evaluate. interview_id={interview_id}, has_supabase={bool(supabase)}")
            
    return jsonify(evaluation_result)

@interview_bp.route('/report-data', methods=['GET'])
def get_report_data():
    """ Used by the report UI to fetch the final state """
    interview_id = request.args.get('interview_id', 'demo_id')
    iv_session = current_interviews.get(interview_id, {})
    
    return jsonify({
        "history": iv_session.get("history", []),
        "evaluation": iv_session.get("evaluation", {})
    })

@interview_bp.route('/<interview_id>', methods=['DELETE'])
def delete_interview(interview_id):
    access_token = session.get('access_token')
    supabase = get_supabase_client(access_token=access_token)
    
    if supabase and interview_id != "demo_id":
        try:
            # Delete child record first to satisfy foreign key constraint
            supabase.table("interview_reports").delete().eq("interview_id", interview_id).execute()
            # Then delete parent
            resp = supabase.table("interviews").delete().eq("id", interview_id).execute()
        except Exception as e:
            print(f"Delete Error: {e}")
            return jsonify({"error": "Internal Server Error"}), 500
            
    # Remove from memory if it exists
    if interview_id in current_interviews:
        del current_interviews[interview_id]
        
    return jsonify({"success": True}), 200
