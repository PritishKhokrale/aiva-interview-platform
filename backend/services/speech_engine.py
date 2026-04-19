import os
from services.ai_engine import get_groq_client

def speech_to_text(audio_file_path):
    """
    Converts audio to text using Groq's Whisper model (distil-whisper-large-v3-en).
    Requires a valid filepath to an audio file (e.g. .wav, .mp3).
    """
    try:
        with open(audio_file_path, "rb") as file:
            transcription = get_groq_client().audio.transcriptions.create(
              file=(audio_file_path, file.read()),
              model="whisper-large-v3-turbo",
              response_format="json",
            )
            return transcription.text
    except Exception as e:
        print(f"Groq Whisper API Error: {e}")
        return "This is a dummy transcript due to an audio or API error."

def text_to_speech(text):
    """
    Placeholder for Server-side TTS (e.g. ElevenLabs). 
    Currently, the application relies on the Browser's WebSpeech API for TTS.
    """
    return None
