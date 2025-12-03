import os
import io
import json
import csv
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import google.generativeai as genai
from PIL import Image
from collections import defaultdict
from functools import wraps
from dotenv import load_dotenv

# Get absolute paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join(BASE_DIR, '..')

# Load environment variables from root folder
load_dotenv(os.path.join(ROOT_DIR, '.env'))
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

# Konfigurasi Gemini AI
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
print(f"[DEBUG] API Key loaded: {'Yes' if GEMINI_API_KEY else 'No'}")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("[WARNING] GEMINI_API_KEY not found in .env file!")

# Buat folder upload jika belum ada
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# CSV file path for storing OCR results
CSV_FILE_PATH = os.path.join(BASE_DIR, 'ocr_results.csv')


def init_csv_file():
    """Initialize CSV file with headers if it doesn't exist"""
    if not os.path.exists(CSV_FILE_PATH):
        with open(CSV_FILE_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['tanggal', 'nomor', 'pesan'])


def save_to_csv(tanggal, nomor, pesan):
    """Save OCR result to CSV file"""
    init_csv_file()
    with open(CSV_FILE_PATH, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([tanggal or '', nomor or '', pesan or ''])


def get_all_csv_data():
    """Get all data from CSV file"""
    init_csv_file()
    data = []
    with open(CSV_FILE_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append(row)
    return data


# Initialize CSV file
init_csv_file()


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


def process_ocr_with_gemini(image_path, custom_date=None):
    """Process image with Gemini AI for OCR"""
    try:
        print(f"[DEBUG] Processing image: {image_path}")
        
        if not GEMINI_API_KEY:
            print("[ERROR] API key not configured!")
            return {
                'error': 'API key not configured',
                'message': 'Gemini API key belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY di file .env'
            }
        
        # Load image
        print("[DEBUG] Loading image...")
        img = Image.open(image_path)
        
        # Initialize Gemini model - using gemini-2.0-flash which is widely available
        print("[DEBUG] Initializing Gemini model...")
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
        print("[DEBUG] Sending request to Gemini API...")
        response = model.generate_content([prompt, img])
        print("[DEBUG] Response received from Gemini API")
        
        # Parse response
        response_text = response.text.strip()
        print(f"[DEBUG] Response text: {response_text[:200]}...")
        
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
        
        print(f"[DEBUG] OCR result: {result}")
        return result
        
    except Exception as e:
        import traceback
        print(f"[ERROR] Processing failed: {str(e)}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return {
            'error': 'Processing failed',
            'message': str(e)
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
        result = process_ocr_with_gemini(filepath, custom_date)
        
        # Clean up temporary file
        try:
            os.remove(filepath)
        except:
            pass
        
        if 'error' in result:
            return jsonify(result), 500
        
        # Save to CSV
        save_to_csv(
            result.get('tanggal'),
            result.get('nomor_telepon'),
            result.get('isi_chat')
        )
        print(f"[DEBUG] Saved to CSV: {result}")
        
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


@app.route('/api/data', methods=['GET'])
def get_data():
    """Get all saved OCR data from CSV"""
    try:
        data = get_all_csv_data()
        return jsonify({
            'success': True,
            'data': data
        }), 200
    except Exception as e:
        return jsonify({
            'error': 'Failed to read data',
            'message': str(e)
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
    if not GEMINI_API_KEY:
        print("⚠️  WARNING: GEMINI_API_KEY belum dikonfigurasi!")
        print("   Silakan buat file .env dan tambahkan:")
        print("   GEMINI_API_KEY=your_api_key_here")
    else:
        print("✓ Gemini API Key terkonfigurasi")
    print(f"✓ Rate limit: {RATE_LIMIT} requests per jam")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)
