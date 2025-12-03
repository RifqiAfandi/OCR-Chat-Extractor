import os
import io
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import google.generativeai as genai
from PIL import Image
from collections import defaultdict
from functools import wraps

# Get absolute paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join(BASE_DIR, '..')

FRONTEND_DIR = os.path.join(BASE_DIR, '..', 'frontend')
STATIC_DIR = os.path.join(FRONTEND_DIR, 'static')

app = Flask(__name__, 
            static_folder=STATIC_DIR,
            static_url_path='/static',
            template_folder=FRONTEND_DIR)
CORS(app)

# Konfigurasi
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

# Rate limiting configuration
RATE_LIMIT = 10  # Maximum requests per time window
RATE_LIMIT_WINDOW = timedelta(hours=1)  # Time window
request_tracker = defaultdict(list)

# Buat folder upload jika belum ada
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


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
    
    # Check limit
    if len(request_tracker[client_id]) >= RATE_LIMIT:
        oldest_request = min(request_tracker[client_id])
        time_until_reset = (oldest_request + RATE_LIMIT_WINDOW - now).total_seconds()
        return False, time_until_reset
    
    # Add new request
    request_tracker[client_id].append(now)
    remaining = RATE_LIMIT - len(request_tracker[client_id])
    return True, remaining


def rate_limit_required(f):
    """Decorator for rate limiting"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get client identifier (IP address)
        client_id = request.remote_addr
        
        allowed, value = check_rate_limit(client_id)
        
        if not allowed:
            minutes = int(value // 60)
            seconds = int(value % 60)
            return jsonify({
                'error': 'Rate limit exceeded',
                'message': f'Anda telah melebihi batas {RATE_LIMIT} permintaan per jam. Silakan coba lagi dalam {minutes} menit {seconds} detik.',
                'retry_after': value
            }), 429
        
        response = f(*args, **kwargs)
        
        # Add rate limit info to response headers
        if isinstance(response, tuple):
            response_obj, status_code = response
            if isinstance(response_obj, dict) or hasattr(response_obj, 'get_json'):
                return response
        
        return response
    
    return decorated_function


def process_ocr_with_gemini(image_path, api_key, custom_date=None):
    """Process image with Gemini AI for OCR"""
    try:
        if not api_key:
            return {
                'error': 'API key not provided',
                'message': 'Gemini API key belum dimasukkan. Silakan masukkan API key Anda.'
            }
        
        # Configure Gemini with provided API key
        genai.configure(api_key=api_key)
        
        # Load image
        img = Image.open(image_path)
        
        # Initialize Gemini model - using gemini-2.0-flash which is widely available
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Prompt untuk ekstraksi data
        prompt = """
        Analisis gambar ini dan ekstrak informasi berikut dalam format JSON:
        1. Isi chat/percakapan (semua teks yang terlihat dalam gambar)
        2. Nomor telepon (jika ada)
        3. Tanggal (jika ada dalam gambar)
        
        Format output harus persis seperti ini:
        {
            "isi_chat": "teks lengkap dari percakapan atau isi gambar",
            "nomor_telepon": "nomor telepon yang ditemukan atau null jika tidak ada",
            "tanggal": "tanggal yang ditemukan dalam format DD/MM/YYYY atau null jika tidak ada"
        }
        
        Pastikan output adalah JSON yang valid. Jika informasi tidak ditemukan, gunakan null.
        """
        
        # Generate content
        response = model.generate_content([prompt, img])
        
        # Parse response
        response_text = response.text.strip()
        
        # Try to extract JSON from response
        if '```json' in response_text:
            json_start = response_text.find('```json') + 7
            json_end = response_text.find('```', json_start)
            response_text = response_text[json_start:json_end].strip()
        elif '```' in response_text:
            json_start = response_text.find('```') + 3
            json_end = response_text.find('```', json_start)
            response_text = response_text[json_start:json_end].strip()
        
        try:
            result = json.loads(response_text)
        except json.JSONDecodeError:
            result = {
                'isi_chat': response_text,
                'nomor_telepon': None,
                'tanggal': None
            }
        
        # Override tanggal with custom date if provided
        if custom_date:
            result['tanggal'] = custom_date
        
        return result
        
    except Exception as e:
        # Check for API key errors - sanitize message for security
        error_message = str(e).lower()
        if 'api key' in error_message or 'invalid' in error_message or 'unauthorized' in error_message:
            return {
                'error': 'Invalid API key',
                'message': 'API key tidak valid. Silakan periksa kembali API key Anda.'
            }
        
        # Return generic error message to avoid exposing internal details
        return {
            'error': 'Processing failed',
            'message': 'Gagal memproses gambar. Silakan coba lagi.'
        }


@app.route('/')
def index():
    """Serve the main page"""
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/api/ocr', methods=['POST'])
@rate_limit_required
def ocr_endpoint():
    """OCR endpoint for processing images"""
    
    # Check if file is present
    if 'image' not in request.files:
        return jsonify({'error': 'No file uploaded', 'message': 'Tidak ada file yang diupload'}), 400
    
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected', 'message': 'Tidak ada file yang dipilih'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({
            'error': 'Invalid file type',
            'message': f'Tipe file tidak diizinkan. Gunakan: {", ".join(ALLOWED_EXTENSIONS)}'
        }), 400
    
    # Get API key from request header
    api_key = request.headers.get('X-API-Key', '')
    if not api_key:
        return jsonify({
            'error': 'API key required',
            'message': 'Gemini API key diperlukan. Silakan masukkan API key Anda.'
        }), 401
    
    # Get custom date if provided
    custom_date = request.form.get('tanggal', None)
    
    try:
        # Save file temporarily
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Process with Gemini
        result = process_ocr_with_gemini(filepath, api_key, custom_date)
        
        # Clean up temporary file
        try:
            os.remove(filepath)
        except:
            pass
        
        if 'error' in result:
            return jsonify(result), 500
        
        # Get remaining requests
        client_id = request.remote_addr
        remaining = RATE_LIMIT - len(request_tracker[client_id])
        
        return jsonify({
            'success': True,
            'data': result,
            'rate_limit': {
                'remaining': remaining,
                'limit': RATE_LIMIT,
                'window': 'per jam'
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': 'Server error',
            'message': str(e)
        }), 500


@app.route('/api/validate-key', methods=['POST'])
def validate_api_key():
    """Validate Gemini API key"""
    try:
        data = request.get_json()
        api_key = data.get('api_key', '')
        
        if not api_key:
            return jsonify({
                'valid': False,
                'message': 'API key tidak boleh kosong'
            }), 400
        
        # Try to configure and make a simple request to validate
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Simple validation request
        response = model.generate_content("Say 'valid' if you can receive this message.")
        
        if response and response.text:
            return jsonify({
                'valid': True,
                'message': 'API key valid!'
            }), 200
        else:
            return jsonify({
                'valid': False,
                'message': 'API key tidak dapat divalidasi'
            }), 400
            
    except Exception as e:
        error_message = str(e).lower()
        if 'api key' in error_message or 'invalid' in error_message or 'unauthorized' in error_message:
            return jsonify({
                'valid': False,
                'message': 'API key tidak valid'
            }), 400
        return jsonify({
            'valid': False,
            'message': f'Gagal memvalidasi API key: {str(e)}'
        }), 500


@app.route('/api/rate-limit-status', methods=['GET'])
def rate_limit_status():
    """Get current rate limit status"""
    client_id = request.remote_addr
    now = datetime.now()
    
    # Clean old requests
    request_tracker[client_id] = [
        req_time for req_time in request_tracker[client_id]
        if now - req_time < RATE_LIMIT_WINDOW
    ]
    
    used = len(request_tracker[client_id])
    remaining = RATE_LIMIT - used
    
    # Calculate time until reset
    if request_tracker[client_id]:
        oldest_request = min(request_tracker[client_id])
        reset_time = oldest_request + RATE_LIMIT_WINDOW
        seconds_until_reset = (reset_time - now).total_seconds()
    else:
        seconds_until_reset = 0
    
    return jsonify({
        'limit': RATE_LIMIT,
        'used': used,
        'remaining': remaining,
        'reset_in_seconds': max(0, int(seconds_until_reset)),
        'window': 'per jam'
    }), 200


@app.errorhandler(413)
def too_large(e):
    """Handle file too large error"""
    return jsonify({
        'error': 'File too large',
        'message': 'Ukuran file terlalu besar. Maksimal 16MB'
    }), 413


if __name__ == '__main__':
    print("=" * 60)
    print("OCR Web Application dengan Gemini AI")
    print("=" * 60)
    print("✓ Pengguna akan memasukkan API key mereka sendiri")
    print(f"✓ Rate limit: {RATE_LIMIT} requests per jam")
    print("✓ Data disimpan di localStorage browser")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)
