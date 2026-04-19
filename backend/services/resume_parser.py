import os
from pypdf import PdfReader
import docx

def parse_resume(file_path):
    """
    Parses a resume (PDF/DOCX) and returns structured data.
    """
    text = ""
    ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if ext == '.pdf':
            reader = PdfReader(file_path)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        elif ext == '.docx':
            doc = docx.Document(file_path)
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            text = "Unsupported file format."
    except Exception as e:
        print(f"Error parsing resume: {e}")
        text = "Error reading file."

    # In a real scenario, we'd pass this `text` to an LLM to extract structured fields.
    # For now, return basic mock structure assuming the LLM extracted it:
    return {
        "raw_text": text[:500] + "...", # Truncated for display
        "skills": ["JavaScript", "Python", "React", "SQL"],
        "experience": "4 years",
        "role": "Full Stack Engineer"
    }
