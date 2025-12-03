import os
import io
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from PIL import Image
from collections import defaultdict
from functools import wraps

app = Flask(__name__)
CORS(app)

# Konfigurasi
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

# Rate limiting configuration
RATE_LIMIT = 10  # Maximum requests per time window
RATE_LIMIT_WINDOW = timedelta(hours=1)  # Time window
request_tracker = defaultdict(list)


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def check_rate_limit(client_id):
    """Check if client has exceeded rate limit"""
    now = datetime.now()
    # Clean old requests
    request_tracker[client_id] = [
        req_time for req_time in request_tracker[client_id]
        if now - req_time < RATE_LIMIT_WINDOW
    ]
    
    if len(request_tracker[client_id]) >= RATE_LIMIT:
        return False
    
    request_tracker[client_id].append(now)
    return True


def rate_limit(f):
    """Decorator for rate limiting"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_id = request.headers.get('X-API-Key', '')[:8] or request.remote_addr
        if not check_rate_limit(client_id):
            remaining_time = RATE_LIMIT_WINDOW - (datetime.now() - request_tracker[client_id][0])
            return jsonify({
                'error': 'Rate limit exceeded. Please try again later.',
                'retry_after': int(remaining_time.total_seconds())
            }), 429
        return f(*args, **kwargs)
    return decorated_function


@app.route('/api/process', methods=['POST'])
@rate_limit
def process_image():
    """Process image with OCR"""
    api_key = request.headers.get('X-API-Key')
    if not api_key:
        return jsonify({'error': 'API key is required'}), 401
    
    if 'images' not in request.files:
        return jsonify({'error': 'No images provided'}), 400
    
    images = request.files.getlist('images')
    if not images or all(img.filename == '' for img in images):
        return jsonify({'error': 'No images selected'}), 400
    
    # Validate images
    for img in images:
        if not allowed_file(img.filename):
            return jsonify({'error': f'File type not allowed: {img.filename}'}), 400
    
    try:
        # Configure Gemini API
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        results = []
        for img_file in images:
            # Read image
            img_bytes = img_file.read()
            img = Image.open(io.BytesIO(img_bytes))
            
            # Process with Gemini
            prompt = """Analisis gambar chat ini dan ekstrak semua percakapan yang terlihat.
Untuk setiap pesan yang teridentifikasi, berikan:
1. Pengirim (nama atau "Unknown" jika tidak terlihat)
2. Isi pesan lengkap
3. Waktu pesan (jika terlihat)

Format output sebagai JSON array dengan struktur:
[
  {
    "sender": "nama_pengirim",
    "message": "isi_pesan",
    "timestamp": "waktu_jika_ada"
  }
]

Jika tidak ada chat yang terdeteksi, kembalikan array kosong [].
PENTING: Hanya kembalikan JSON array, tanpa markdown atau teks tambahan."""
            
            response = model.generate_content([prompt, img])
            
            # Parse response
            response_text = response.text.strip()
            if response_text.startswith('```'):
                response_text = response_text.split('\n', 1)[1] if '\n' in response_text else response_text[3:]
                if response_text.endswith('```'):
                    response_text = response_text[:-3]
                response_text = response_text.strip()
            
            try:
                messages = json.loads(response_text)
                results.append({
                    'filename': img_file.filename,
                    'messages': messages
                })
            except json.JSONDecodeError:
                results.append({
                    'filename': img_file.filename,
                    'messages': [],
                    'raw_response': response_text
                })
        
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        error_message = str(e)
        if 'API key' in error_message.lower():
            return jsonify({'error': 'Invalid API key'}), 401
        return jsonify({'error': 'Processing failed. Please try again.'}), 500


@app.route('/api/validate-key', methods=['POST'])
def validate_key():
    """Validate Gemini API key"""
    try:
        data = request.get_json()
        api_key = data.get('api_key', '')
        
        if not api_key:
            return jsonify({'valid': False, 'error': 'API key is required'})
        
        # Test the API key by making a simple request
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content('Hello')
        
        return jsonify({'valid': True})
    except Exception as e:
        return jsonify({'valid': False, 'error': 'Invalid API key'})


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})


# Vercel handler
if __name__ == '__main__':
    app.run()
