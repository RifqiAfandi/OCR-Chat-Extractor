# OCR Chat Extractor dengan Gemini AI

Website untuk melakukan OCR (Optical Character Recognition) pada gambar menggunakan API Gemini AI. Aplikasi ini dapat mengekstrak informasi dari gambar chat seperti isi percakapan, nomor telepon, dan tanggal.

## 🌟 Fitur

- ✅ Upload gambar (PNG, JPG, JPEG, GIF, BMP, WEBP)
- ✅ OCR menggunakan Gemini AI
- ✅ Ekstraksi otomatis: Isi chat, Nomor telepon, Tanggal
- ✅ Input tanggal manual (opsional)
- ✅ Rate limiting (10 permintaan per jam)
- ✅ Dark theme dengan UI modern
- ✅ Data disimpan di localStorage browser
- ✅ Export data ke CSV
- ✅ Hapus data per item atau semua data
- ✅ API key per pengguna (tanpa file .env)
- ✅ Responsive design
- ✅ Security hardening (console protection, session management)

## 🛠️ Teknologi

**Backend:**
- Python 3.8+
- Flask
- Google Generative AI (Gemini)
- Pillow (Image Processing)

**Frontend:**
- HTML5
- CSS3 (Modern Design)
- Vanilla JavaScript
- Font Awesome Icons
- localStorage untuk penyimpanan data

## 📋 Prasyarat

- Python 3.8 atau lebih tinggi
- API Key Gemini AI (gratis dari [Google AI Studio](https://makersuite.google.com/app/apikey))

## 🚀 Instalasi (Local Development)

### 1. Clone Repository

```bash
git clone https://github.com/RifqiAfandi/OCR-Chat-Extractor.git
cd OCR-Chat-Extractor
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Jalankan Aplikasi

```bash
cd backend
python app.py
```

Server akan berjalan di: `http://localhost:5000`

### 4. Buka Browser dan Masukkan API Key

Akses `http://localhost:5000`

Saat pertama kali dibuka, Anda akan diminta memasukkan Gemini API Key:

**Cara mendapatkan API Key:**
1. Kunjungi [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Login dengan akun Google
3. Klik "Create API Key"
4. Copy API key yang dihasilkan
5. Paste di form yang muncul di website

## 🌐 Deploy ke Vercel

### Prasyarat Deploy
- Akun [Vercel](https://vercel.com) (gratis)
- Repository sudah di-push ke GitHub

### Langkah-langkah Deploy

#### 1. Siapkan File Konfigurasi Vercel

Buat file `vercel.json` di root folder:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/app.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "dest": "backend/app.py"
    },
    {
      "src": "/(.*)",
      "dest": "backend/app.py"
    }
  ]
}
```

#### 2. Update `requirements.txt`

Pastikan `requirements.txt` berisi:
```
flask
flask-cors
google-generativeai
Pillow
gunicorn
```

#### 3. Deploy via Vercel Dashboard

1. Login ke [Vercel](https://vercel.com)
2. Klik **"Add New..."** → **"Project"**
3. Import repository `OCR-Chat-Extractor` dari GitHub
4. Konfigurasi:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (default)
   - **Build Command**: (kosongkan)
   - **Output Directory**: (kosongkan)
5. Klik **"Deploy"**

#### 4. Deploy via Vercel CLI (Alternatif)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy ke production
vercel --prod
```

### Catatan Penting untuk Vercel

⚠️ **Limitasi Vercel Free Tier:**
- Serverless function timeout: 10 detik (mungkin tidak cukup untuk OCR gambar besar)
- Memory limit: 1024MB
- Tidak ada persistent storage (uploads folder tidak disimpan)

💡 **Tips:**
- Untuk produksi serius, pertimbangkan menggunakan platform seperti Railway, Render, atau VPS
- API key dimasukkan per pengguna, jadi tidak perlu environment variable di Vercel

## 📖 Cara Penggunaan

1. **Upload Gambar**
   - Klik area upload atau drag & drop gambar
   - Maksimal ukuran file: 16MB
   - Format yang didukung: PNG, JPG, JPEG, GIF, BMP, WEBP

2. **Input Tanggal (Opsional)**
   - Masukkan tanggal manual jika diperlukan
   - Jika kosong, AI akan mencoba mendeteksi tanggal dari gambar

3. **Proses OCR**
   - Klik tombol "Proses OCR"
   - Tunggu beberapa saat hingga selesai

4. **Lihat & Kelola Hasil**
   - Hasil ditampilkan dalam tabel dengan kolom: Pesan, Nomor, Tanggal
   - Klik teks pesan untuk expand/collapse
   - Hapus data per item atau semua data sekaligus
   - Export ke CSV untuk backup

## 📁 Struktur Project

```
OCR-Chat-Extractor/
├── backend/
│   ├── app.py              # Flask backend server
│   └── uploads/            # Temporary upload folder
├── frontend/
│   ├── index.html          # Main HTML page
│   └── static/
│       ├── css/
│       │   └── style.css   # Styling (dark theme)
│       └── js/
│           ├── app.js      # Frontend logic
│           └── security.js # Security module
├── requirements.txt        # Python dependencies
├── vercel.json            # Vercel configuration
├── .gitignore             # Git ignore file
└── README.md              # Documentation
```

## 🔐 Security Features

Aplikasi ini dilengkapi dengan berbagai fitur keamanan:

- **Console Protection**: Console log dinonaktifkan di production mode
- **API Key Obfuscation**: API key di-encode dan disimpan di sessionStorage
- **Session Management**: Auto-logout setelah 15 menit inaktivitas
- **Rate Limiting**: Maksimal 5 percobaan validasi API key per menit
- **Input Sanitization**: Validasi dan sanitasi semua input
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Memory Cleanup**: Data sensitif dibersihkan saat halaman ditutup

## 🎨 Design Features

- **Dark Theme**: Background gelap dengan text cerah untuk kenyamanan mata
- **Modern UI**: Gradient accent, smooth transitions, hover effects
- **Responsive**: Otomatis menyesuaikan ukuran layar (desktop, tablet, mobile)
- **User Feedback**: Loading states, notifications, progress indicators
- **Accessibility**: Clear labels, keyboard navigation support

## 🐛 Troubleshooting

**Error: "API key tidak valid"**
- Pastikan API key sudah benar (copy dari Google AI Studio)
- Cek apakah API key masih aktif
- Pastikan tidak ada spasi di awal/akhir API key

**Error: "Failed to connect to server"**
- Pastikan backend sudah berjalan di port 5000
- Periksa firewall tidak memblokir port
- Cek konsol browser untuk error detail

**Rate Limit Exceeded**
- Tunggu hingga periode reset (1 jam)
- Rate limit adalah 10 permintaan per jam per IP

**Image Upload Failed**
- Periksa ukuran file tidak melebihi 16MB
- Pastikan format file didukung
- Coba compress gambar terlebih dahulu

**Data tidak muncul di tabel**
- Refresh halaman
- Cek localStorage di DevTools → Application → Local Storage
- Pastikan browser mendukung localStorage

## 📜 License

MIT License - Silakan gunakan untuk pembelajaran dan proyek pribadi.

## 👨‍💻 Developer

Dibuat dengan ❤️ menggunakan Python, Flask, dan Gemini AI

## 🙏 Credits

- [Google Gemini AI](https://ai.google.dev/) - OCR & AI Processing
- [Flask](https://flask.palletsprojects.com/) - Web Framework
- [Font Awesome](https://fontawesome.com/) - Icons

---

**Catatan:** 
- API key disimpan di browser Anda (sessionStorage), bukan di server
- Jangan bagikan API key Anda secara publik
- Data OCR tersimpan di localStorage browser Anda
