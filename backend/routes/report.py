from flask import Blueprint, render_template, request, jsonify, session
from routes.interview import current_interviews
from database.supabase_client import get_supabase_client

report_bp = Blueprint('report', __name__)

@report_bp.route('/<string:interview_id>', methods=['GET'])
def get_report(interview_id):
    # Try fetching from Supabase first
    access_token = session.get('access_token')
    supabase = get_supabase_client(access_token=access_token)
    
    if supabase and interview_id != "demo_id":
        try:
            # Query reports and join interviews
            resp = supabase.table("interview_reports").select("*, interviews(*)").eq("interview_id", interview_id).execute()
            
            if resp.data and len(resp.data) > 0:
                report_row = resp.data[0]
                interview_row = report_row.get("interviews", {})
                
                # Unpack metrics and extended data payload dynamically
                metrics_dict = report_row.get("metrics", {})
                extended = metrics_dict.pop("extended_data", {})
                
                # Clean up history and question analysis for better display
                history = interview_row.get("history", [])
                
                # Sanitize question analysis: ensure empty answers are handled
                qa_list = extended.get("question_analysis", [])
                for qa in qa_list:
                    ans = qa.get("candidate_answer", "")
                    if ans and isinstance(ans, str):
                        # If answers are just spaces or tiny snippets that are empty, clear them
                        if not ans.strip():
                            qa["candidate_answer"] = None
                    elif not ans:
                        qa["candidate_answer"] = None

                eval_data = {
                    "role": interview_row.get("role", "Software Engineer"),
                    "overall_score": report_row.get("overall_score", 0),
                    "summary": {
                        "overview": report_row.get("summary", ""),
                        "type": extended.get("type", "Unknown"),
                        "difficulty_faced": extended.get("difficulty_faced", "Unknown")
                    },
                    "strengths": report_row.get("strengths", []),
                    "weaknesses": report_row.get("weaknesses", []),
                    "metrics": metrics_dict,
                    "red_flags": extended.get("red_flags", []),
                    "final_verdict": extended.get("final_verdict", "Borderline"),
                    "improvement_plan": extended.get("improvement_plan", {}),
                    "question_analysis": qa_list
                }
                
                return render_template('report.html', 
                                      evaluation=eval_data,
                                      history=history,
                                      overall_score=eval_data["overall_score"])
            else:
                # NEW FAILSAFE: If no report in interview_reports, check interviews.history
                iv_resp = supabase.table("interviews").select("*").eq("id", interview_id).execute()
                if iv_resp.data and len(iv_resp.data) > 0:
                    history = iv_resp.data[0].get("history", [])
                    if history and len(history) > 0 and isinstance(history[-1], dict) and history[-1].get("role") == "evaluation":
                        import json
                        try:
                            eval_data = json.loads(history[-1].get("content", "{}"))
                            return render_template('report.html', 
                                                   evaluation=eval_data, 
                                                   history=history[:-1], 
                                                   overall_score=eval_data.get('overall_score', 0))
                        except Exception as p_err:
                            print(f"Failed parsing failsafe evaluation: {p_err}")
        except Exception as e:
            print(f"Failed to fetch report from Supabase: {e}")

    # Fallback to local memory (demo mode)
    iv_session = current_interviews.get(interview_id, {})
    eval_data = iv_session.get("evaluation", {})
    history = iv_session.get("history", [])
    overall_score = eval_data.get("overall_score", 0)
    config = iv_session.get("config", {})
    
    # Sanitize question analysis for local demo mode too
    qa_list = eval_data.get("question_analysis", [])
    for qa in qa_list:
        ans = qa.get("candidate_answer", "")
        if ans and isinstance(ans, str):
            if not ans.strip():
                qa["candidate_answer"] = None
        elif not ans:
            qa["candidate_answer"] = None
            
    if "role" not in eval_data:
        eval_data["role"] = config.get("role", "Software Engineer")
    
    return render_template('report.html', 
                          evaluation=eval_data,
                          history=history,
                          overall_score=overall_score)

@report_bp.route('/live-webhook', methods=['POST'])
def save_live_meeting():
    """
    Called by the React Meeting Room when a Live Human Interview is completed.
    Receives transcript logs and generates a unified report using the AI evaluating engine.
    """
    request_data = request.json or {}
    interview_id = request_data.get('interview_id')
    raw_transcript = request_data.get('transcript', []) # list of {name, text}
    candidate_profile = request_data.get('candidate', {"name": "Candidate"})
    host_profile = request_data.get('host', {"name": "Host"})
    
    if not interview_id:
        return jsonify({"error": "Missing interview_id"}), 400

    # 1. Fetch config from Supabase to inform AI
    supabase = get_supabase_client()
    config = {"role": "Software Engineer", "type": "Live Technical Match"}
    candidate_id = None
    if supabase and interview_id != "demo_id":
        existing = supabase.table("interviews").select("*").eq("id", interview_id).execute()
        if existing.data:
            config["role"] = existing.data[0].get("role", config["role"])
            config["difficulty"] = existing.data[0].get("difficulty", "medium")
            candidate_id = existing.data[0].get("candidate_id")

    # 2. Translate Live Transcript to AI Engine Expected Format
    history_list = []
    for entry in raw_transcript:
        name = entry.get("name", "")
        text = entry.get("text", "")
        # If it's from the candidate, role is 'user', otherwise 'assistant' (interviewer)
        role = "user" if candidate_profile["name"] in name or name == "Guest" else "assistant"
        history_list.append({"role": role, "content": text})

    # Add a fallback if missing transcript
    if not history_list:
        history_list.append({"role": "assistant", "content": "Welcome to the live interview."})
        history_list.append({"role": "user", "content": "Hello, thank you for having me."})

    # 3. Evaluate using the exact same function as AI Mock interviews
    from services.ai_engine import evaluate_full_interview
    evaluation_result = evaluate_full_interview(history_list, candidate_profile, config)

    # 4. Save to DB exactly like the AI engine does
    if supabase and interview_id != "demo_id":
        try:
            # Update history and status
            supabase.table("interviews").update({
                "status": "completed",
                "history": history_list
            }).eq("id", interview_id).execute()
            
            summary_dict = evaluation_result.get("summary", {})
            summary_text = summary_dict.get("overview", "") if isinstance(summary_dict, dict) else summary_dict

            # Sanitize score
            raw_score = evaluation_result.get("overall_score", 0)
            try: safe_score = int(str(raw_score).replace('%','').strip())
            except: safe_score = 0
            
            strengths = evaluation_result.get("strengths", [])
            weaknesses = evaluation_result.get("weaknesses", [])
            if not isinstance(strengths, list): strengths = [str(strengths)]
            if not isinstance(weaknesses, list): weaknesses = [str(weaknesses)]

            insert_data = {
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
                        "type": "Live Formatting",
                        "difficulty_faced": config.get("difficulty", "Unknown")
                    }
                }
            }
            supabase.table("interview_reports").insert(insert_data).execute()
        except Exception as e:
            print(f"Failed to save live report to Supabase: {e}")
            import traceback
            traceback.print_exc()

    return jsonify({"status": "success", "evaluation": evaluation_result})
