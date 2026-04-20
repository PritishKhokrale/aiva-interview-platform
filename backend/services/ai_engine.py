import os
import json
from groq import Groq
import google.generativeai as genai
from dotenv import load_dotenv

# Load env vars before doing anything else
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

def get_groq_client():
    return Groq(api_key=os.environ.get("GROQ_API_KEY", "dummy_key"))

def get_gemini_model():
    """Returns a configured Gemini 2.0 Flash model for question generation."""
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
    return genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        generation_config=genai.GenerationConfig(temperature=0.7)
    )

def generate_next_interaction(conversation_history, candidate_profile, config):
    """
    Acts as a structured AI Interviewer. Uses the full conversation history
    to determine the current phase and generate the next professional response.
    
    Interview Phases:
        1. Introduction (Turn 0)       — Greet, explain format, ask "Tell me about yourself"
        2. Resume Deep-Dive (Turns 1-3) — Ask about projects, skills, internships, education
        3. Type-Specific Core (Turns 4-8) — Technical / HR / Mixed questions
        4. Closing (Turn 9+)            — Ask if they have questions, then sign off
    """
    role = config.get("role", "Software Engineer")
    difficulty = config.get("difficulty", "medium")
    interview_type = config.get("type", "mixed")
    mode = config.get("mode", "resume")
    
    # Count how many questions the AI has already asked
    ai_turn_count = sum(1 for msg in conversation_history if msg.get("role") == "assistant")
    
    # Map duration to question count
    duration_map = {
        "short": 5,
        "standard": 10,
        "intensive": 15
    }
    total_target = duration_map.get(config.get("duration", "standard"), 10)
    
    # --- Build the Resume / JD Context ---
    if mode == "jd":
        jd_text = config.get("jdText", "")
        resume_context = f"""
SOURCE: Job Description
The interview is based on the following Job Description:
---
{jd_text}
---
Ask questions that evaluate if the candidate meets these specific requirements.
"""
    else:
        resume_text = candidate_profile.get("resume_text", "")
        if resume_text:
            resume_context = f"""
SOURCE: Candidate Resume
The candidate has uploaded their resume. Here is the parsed text:
---
{resume_text}
---
Use this resume to ask specific questions about their projects, skills, internships, education, and experience. 
Reference specific items from their resume by name (e.g., project names, company names, technologies).
"""
        else:
            resume_context = f"""
SOURCE: Candidate Profile
The candidate's profile is: {candidate_profile}.
Ask questions tailored to their stated experience and skills.
"""
    
    # --- Build Interview Type Instructions ---
    if interview_type == "technical":
        type_instructions = """
INTERVIEW TYPE: Technical Interview
During the Type-Specific Core phase, focus on:
- Programming languages and frameworks listed in the resume
- Data structures and algorithms (ask 1-2 problem-solving questions)
- System design concepts relevant to their experience level
- Technologies and tools they've used in projects
- Debugging approaches and code quality practices
Ask practical questions like "How would you design..." or "Walk me through how you'd solve..."
"""
    elif interview_type == "hr":
        type_instructions = """
INTERVIEW TYPE: HR / Behavioral Interview
During the Type-Specific Core phase, focus on:
- Teamwork and collaboration experiences
- Conflict resolution and handling disagreements
- Leadership and initiative examples
- Motivation, career goals, and professional growth
- Handling pressure, deadlines, and failure
Use the STAR method prompts like "Tell me about a time when..." or "Describe a situation where..."
"""
    else:  # mixed
        type_instructions = """
INTERVIEW TYPE: Mixed Interview (Technical + Behavioral)
During the Type-Specific Core phase, alternate between:
- Technical questions (programming, system design, problem-solving)
- Behavioral questions (teamwork, leadership, conflict resolution)
Aim for roughly 50/50 split. Transition naturally between technical and behavioral topics.
For example, after a technical question about a project, ask a behavioral question about challenges they faced in that project.
"""
    
    # --- Build Difficulty Instructions ---
    difficulty_instructions = {
        "easy": "Start with basic foundational questions and keep them approachable throughout. Focus on core concepts rather than edge cases.",
        "medium": "Start with intermediate questions. Gradually increase complexity. Include some challenging follow-ups if the candidate demonstrates strong knowledge.",
        "hard": "Start at an intermediate level and quickly move to advanced topics. Ask deep follow-ups, edge cases, and complex scenario-based questions. Challenge the candidate's thinking."
    }
    
    # --- Determine Current Phase ---
    if ai_turn_count == 0:
        phase_instruction = """
CURRENT PHASE: Introduction (Question 1)
This is the VERY FIRST interaction. You must:
1. Greet the candidate warmly and professionally
2. Briefly introduce yourself
3. Ask them to introduce themselves to begin the session

Example opening:
"Hello! Welcome to your AIVA practice interview for the [Role] position. I'm excited to learn more about your background and experience today. To get us started, could you please tell me a bit about yourself?"

DO NOT mention the exact number of questions. Keep it natural and welcoming.
DO NOT ask any technical or behavioral questions yet. Just the introduction.
"""
    elif ai_turn_count <= 3:
        phase_instruction = f"""
CURRENT PHASE: Resume Deep-Dive (Question {ai_turn_count + 1} of ~{total_target})
Focus on the candidate's resume/background:
- Ask about specific projects they mentioned
- Inquire about technologies they've used
- Discuss their internships or work experience
- Ask about their education and what drew them to this field

Reference SPECIFIC items from their resume. Don't ask generic questions — mention project names, company names, or specific skills they listed.
Difficulty: Start easy and build up.
"""
    elif ai_turn_count <= 8:
        phase_instruction = f"""
CURRENT PHASE: Type-Specific Core Questions (Question {ai_turn_count + 1} of ~{total_target})
{type_instructions}

DIFFICULTY PROGRESSION: {difficulty_instructions.get(difficulty, difficulty_instructions["medium"])}
Question difficulty should be at the {"basic" if ai_turn_count <= 5 else "intermediate" if ai_turn_count <= 7 else "advanced"} level for this turn.

Remember to acknowledge their previous answer before asking the next question.
"""
    else:
        phase_instruction = f"""
CURRENT PHASE: Closing (Question {ai_turn_count + 1} — Final)
The interview is wrapping up. You should:
1. Briefly acknowledge their last answer
2. Ask if they have any questions for you (the interviewer)
3. If they already asked/answered that, provide a warm closing message like:
   "Thank you so much for participating in this interview. Your responses have been recorded and will now be evaluated. Best of luck!"

Keep it professional and encouraging. This should feel like the natural end of an interview.
"""
    
    # --- Assemble the Full System Prompt ---
    system_prompt = f"""You are an expert AI Interviewer and Talent Evaluator conducting a professional structured interview for a **{role}** position.

{resume_context}

INTERVIEW STRUCTURE & FLOW:
You are following a structured interview format with approximately {total_target} questions total:
1. Introduction — Greet and explain format.
2. Resume Deep-Dive — Ask about their specific projects, skills, and experience.
3. Type-Specific Core — Technical, Behavioral, or Mixed questions.
4. Closing — Ask if they have questions, then sign off.

{phase_instruction}

EVALUATION LOGIC (VERY IMPORTANT):
While interviewing, you must deeply analyze the candidate like a real human interviewer from top companies:
- Adjust difficulty dynamically based on candidate responses.
- Ask follow-up questions if answers are weak, vague, or partially correct.
- Identify if the answer is memorized vs genuinely understood.
- Detect bluffing or generic answers to probe deeper.

STRICT RULES:
- Ask exactly ONE question at a time. Never list multiple questions.
- Keep your ENTIRE response to a MAXIMUM of 3 sentences total. Be extremely brief, sharp, and concise.
- NO rambling or long preambles. Eliminate fluff entirely.
- NEVER ask questions unrelated to the resume, job role, or interview type. 
- Sound like a real person — warm and professional, but direct.
- Acknowledge their previous answer extremely briefly (max 5 words) before moving directly to the next question.
- Do NOT generate bullet points, numbered lists, or unnecessary formatting. Speak naturally.

You have asked {ai_turn_count} questions so far out of approximately {total_target}."""

    messages = [{"role": "system", "content": system_prompt}]
    
    # Append the conversation history
    for msg in conversation_history:
        messages.append(msg)
        
    try:
        # --- Groq 70B for live voice interview (high accuracy, conversational quality) ---
        response = get_groq_client().chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile",
            temperature=0.7,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Groq API Error in conversational engine: {e}")
        return "I understand. Could you tell me more about your recent project experience?"

def evaluate_full_interview(conversation_history, candidate_profile, config):
    """
    Evaluates the entire interview transcript and returns a structured report.
    """
    role = config.get("role", "Software Engineer")
    interview_type = config.get("type", "mixed")
    
    # Format the transcript into a readable string
    transcript = ""
    for msg in conversation_history:
        name = "Interviewer" if msg["role"] == "assistant" else "Candidate"
        transcript += f"{name}: {msg['content']}\n\n"
        
    prompt = f"""
    Evaluate this entire {interview_type} interview transcript for a {role} position.
    
    TRANSCRIPT:
    {transcript}
    
    You are an expert AI Interviewer and Talent Evaluator from a top company. Provide a DETAILED PROFESSIONAL REPORT based on the EXACT structure provided.
    
    For EVERY answer given by the candidate, evaluate:
    - Correctness (Correct / Partially Correct / Incorrect)
    - Technical Depth (Low / Medium / High)
    - Communication (Poor / Average / Good)
    - Confidence Level (Low / Medium / High)
    
    DO NOT give generic feedback. Be strict, realistic, and specific.
    List REAL weaknesses and point out Red Flags like guessing, lack of clarity, or poor basics.
    
    IMPORTANT: If the candidate did not provide an answer (e.g. they skipped it or their response is completely blank), you MUST set 'candidate_answer' exactly to "Not answered by the candidate". Rate the correctness as 'Incorrect' and give a score of 0 for that answer.
    
    Return ONLY a single valid JSON object containing exactly these fields:
    {{
      "summary": {{ "overview": "2-3 lines candidate performance overview", "type": "{interview_type}", "difficulty_faced": "difficulty level faced" }},
      "question_analysis": [
         {{
            "question": "Question asked by AI",
            "candidate_answer": "Exact user answer",
            "expected_answer": "Ideal structured answer expected",
            "evaluation": {{ "correctness": "...", "depth": "...", "communication": "...", "confidence": "..." }},
            "feedback": "Specific improvement suggestion",
            "score": "X/10 (e.g. '7/10')"
         }}
      ],
      "metrics": {{
        "technical": <int 1-100>,
        "communication": <int 1-100>,
        "confidence": <int 1-100>,
        "problem_solving": <int 1-100>,
        "clarity_of_thought": <int 1-100>
      }},
      "overall_score": <int 1-100, calculate avg of metrics>,
      "strengths": ["3-5 genuine strengths"],
      "weaknesses": ["Real weaknesses, NO generic points"],
      "red_flags": ["Lack of clarity", "Guessing", "etc" ],
      "final_verdict": "Selected | Borderline | Rejected",
      "improvement_plan": {{
          "what_to_study": "...",
          "communication": "...",
          "practice_strategy": "..."
      }}
    }}
    """
    
    try:
        response = get_groq_client().chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Groq Evaluation API Error: {e}")
        return {
            "overall_score": 75,
            "summary": {"overview": "Evaluation failed due to specific processing error.", "type": interview_type, "difficulty_faced": "Unknown"},
            "metrics": {"technical": 70, "communication": 80, "confidence": 75, "problem_solving": 70, "clarity_of_thought": 75},
            "strengths": ["System error prevented full analysis"],
            "weaknesses": ["System error prevented full analysis"],
            "red_flags": [],
            "final_verdict": "Borderline",
            "improvement_plan": {"what_to_study": "N/A", "communication": "N/A", "practice_strategy": "N/A"},
            "question_analysis": []
        }

def generate_aptitude_questions(sections, role, difficulty="medium", questions_per_section=10):
    """
    Generates structured Multiple Choice Questions for specified aptitude sections.
    """
    if not sections:
        sections = ["Quantitative", "Logical", "Verbal"]
        
    num_sections = len(sections)
    sections_str = ", ".join(sections)
    
    def build_prompt(q_count):
        total_q_count = num_sections * q_count
        structure_block = ",\n        ".join([
            f"""{{
          "name": "{sec}",
          "questions": [
            {{
              "id": 1,
              "text": "The detailed question text here?",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correct_answer": "Option A",
              "explanation": "Brief explanation"
            }},
            ... // Continue generating exactly {q_count} objects for {sec}
          ]
        }}""" for sec in sections
        ])
        
        return f"""
    Generate a highly professional Aptitude Test for a candidate applying for a {role} position.
    DIFFICULTY LEVEL: {difficulty.upper()} (Strictly adhere to this complexity).

    You MUST generate testing blocks ONLY for the following {num_sections} requested section(s): {sections_str}.
    
    QUESTION QUALITY & VARIETY DIRECTIVES:
    - Include a diverse mix of question types.
    - Test conceptual understanding and analytical reasoning, DO NOT rely on rote memorization.
    - Ensure questions are inherently UNIQUE per run to prevent repetitive mock exams.
    - IMPORTANT FOR VERBAL SECTION: If "Verbal" is requested, STRICTLY focus on grammar, vocabulary, reading comprehension, synonyms/antonyms, and sentence correction. DO NOT generate case-based or scenario-based questions for the Verbal section!
    
    GUIDELINES FOR DIFFICULTY ({difficulty.upper()}):
    - EASY: Focus on core fundamentals, direct logical steps, and clear reasoning.
    - MEDIUM: Involve multi-step operations, moderate inference, application of concepts, and layered logic.
    - HARD: Complex interlocking data sets, abstract/unfamiliar reasoning, and challenging constraints.
    
    STRICT COUNT REQUIREMENT:
    You MUST generate EXACTLY {q_count} questions per requested section.
    Total requested sections: {num_sections}. Total required questions: {total_q_count}.
    DO NOT output sections that were not explicitly listed above.
    Do not truncate the JSON.

    STRICT JSON STRUCTURE AND RULES:
    1. Return ONLY a valid JSON object.
    2. The "correct_answer" string MUST exactly match one of the items inside the "options" array. DO NOT output just a letter like "A" unless "A" is one of the options. Always output the exact full text of the correct option.
    3. The JSON must have this exact shape:
    {{
      "sections": [
        {structure_block}
      ]
    }}
    """
    
    def sanitize_and_assign_ids(data):
        import uuid
        if not data or "sections" not in data:
            return data
        for sec in data.get("sections", []):
            for q in sec.get("questions", []):
                q["id"] = str(uuid.uuid4())
        return data

    try:
        # --- Gemini 2.0 Flash for aptitude MCQ generation (free quota, great at structured JSON) ---
        model = get_gemini_model()
        gemini_prompt = build_prompt(questions_per_section) + "\n\nIMPORTANT: Return ONLY a valid JSON object. No markdown, no code fences, just raw JSON."
        response = model.generate_content(gemini_prompt)
        raw = response.text.strip()
        # Strip markdown code fences if Gemini wraps the JSON
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        content = raw.strip()
        import json
        return sanitize_and_assign_ids(json.loads(content))
    except Exception as e:
        print(f"Gemini API Error in aptitude generation: {e}. Falling back to Groq Llama-3.1-8b-instant.")
        import traceback
        try:
            # Fallback to Groq with fewer questions to prevent hitting TPM limits on free tier
            fallback_q_count = min(questions_per_section, 5)
            groq_prompt = build_prompt(fallback_q_count) + "\n\nIMPORTANT: Return ONLY a valid JSON object. Do not wrap in markdown."
            response = get_groq_client().chat.completions.create(
                messages=[{"role": "user", "content": groq_prompt}],
                model="llama-3.1-8b-instant",
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            import json
            return sanitize_and_assign_ids(json.loads(response.choices[0].message.content))
        except Exception as fallback_e:
            err_msg = traceback.format_exc()
            print(f"Error generating aptitude questions with fallback: {fallback_e}")
            try:
                with open("generate_error.log", "w") as f:
                    f.write(f"Gemini Error:\n{str(e)}\n\nGroq Fallback Error:\n{str(fallback_e)}\n\nTraceback:\n{err_msg}")
            except: pass
            return {"sections": []}

def evaluate_aptitude_test(questions, user_answers):
    """
    Analyzes user performance across aptitude sections.
    """
    # questions is the dict from generate_aptitude_questions
    # user_answers is a dict: { question_id: selected_option }
    
    results = {
        "overall_score": 0,
        "section_scores": {}, # { "Quantitative": { "correct": 0, "total": 10 } }
        "feedback": ""
    }
    
    total_correct = 0
    total_questions = 0
    
    for section in questions.get("sections", []):
        section_name = section["name"]
        correct_in_section = 0
        questions_in_section = len(section["questions"])
        
        section_details = []
        for q in section["questions"]:
            q_id = str(q["id"])
            user_opt = str(user_answers.get(q_id, "")).strip()
            correct_opt = str(q.get("correct_answer", "")).strip()
            
            is_correct = False
            if user_opt == correct_opt or user_opt.lower() == correct_opt.lower():
                is_correct = True
            else:
                # Handle cases where LLM returned "A", "B", "Option C", etc.
                opts = q.get("options", [])
                opt_map = {chr(65+i): str(opts[i]).strip() for i in range(len(opts))}
                
                clean_correct = correct_opt.replace("Option", "").replace(".", "").strip().upper()
                if clean_correct in opt_map:
                    if user_opt == opt_map[clean_correct]:
                        is_correct = True
                        
                # Also check if LLM returned "A. 15 miles"
                if len(correct_opt) > 2 and correct_opt[1] == '.' and correct_opt[0].upper() in opt_map:
                    if user_opt == opt_map[correct_opt[0].upper()] or user_opt in correct_opt:
                        is_correct = True
            
            if is_correct:
                correct_in_section += 1
                total_correct += 1
                
            # Append detailed breakdown
            section_details.append({
                "question": q.get("text", "Unknown question"),
                "options": q.get("options", []),
                "user_answer": user_opt if user_opt else "No Answer",
                "correct_answer": correct_opt,
                "is_correct": is_correct,
                "explanation": q.get("explanation", "No explanation available.")
            })
        
        results["section_scores"][section_name] = {
            "correct": correct_in_section,
            "total": questions_in_section,
            "percentage": (correct_in_section / questions_in_section * 100) if questions_in_section > 0 else 0,
            "details": section_details
        }
        total_questions += questions_in_section
        
    results["overall_score"] = int((total_correct / total_questions * 100)) if total_questions > 0 else 0
    
    # Generate qualitative feedback via LLM
    prompt = f"Analyze these aptitude results: {results}. Provide a brief 2-3 sentence overview of the candidate's strengths and which section needs most practice."
    try:
        fb_resp = get_groq_client().chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.3
        )
        results["feedback"] = fb_resp.choices[0].message.content
    except:
        results["feedback"] = "Great effort on the aptitude test. Review your weak areas to improve."
        
    return results
