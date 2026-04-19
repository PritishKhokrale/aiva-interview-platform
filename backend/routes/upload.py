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
