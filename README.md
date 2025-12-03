# OCR Chat Extractor dengan Gemini AI

Website untuk melakukan OCR (Optical Character Recognition) pada gambar menggunakan API Gemini AI. Aplikasi ini dapat mengekstrak informasi dari gambar chat seperti isi percakapan, nomor telepon, dan tanggal.

## 🌟 Fitur

- ✅ Upload gambar (PNG, JPG, JPEG, GIF, BMP, WEBP)
- ✅ OCR menggunakan Gemini AI
- ✅ Ekstraksi otomatis: Isi chat, Nomor telepon, Tanggal
- ✅ Input tanggal manual (opsional)
- ✅ Rate limiting (10 permintaan per jam)
- ✅ Notifikasi real-time untuk status rate limit
- ✅ Output dalam format JSON
- ✅ Dark theme dengan UI modern
- ✅ Copy to clipboard untuk hasil
- ✅ Responsive design

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

## 📋 Prasyarat

- Python 3.8 atau lebih tinggi
- API Key Gemini AI (gratis dari [Google AI Studio](https://makersuite.google.com/app/apikey))

## 🚀 Instalasi

### 1. Clone atau Download Repository

```bash
cd Utils
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Konfigurasi API Key

Buat file `.env` di root folder:

```bash
copy .env.example .env
```

Edit file `.env` dan tambahkan API key Gemini Anda:

```
GEMINI_API_KEY=AIzaSy...your_actual_api_key_here
```

**Cara mendapatkan API Key:**
1. Kunjungi [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Login dengan akun Google
3. Klik "Create API Key"
4. Copy API key yang dihasilkan

### 4. Jalankan Aplikasi

```bash
cd backend
python app.py
```

Server akan berjalan di: `http://localhost:5000`

### 5. Buka Browser

Akses aplikasi melalui browser:
```
http://localhost:5000
```

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

4. **Lihat Hasil**
   - Hasil akan ditampilkan dalam format:
     - Isi Chat
     - Nomor Telepon
     - Tanggal
     - JSON Output
   - Gunakan tombol copy untuk menyalin hasil

5. **Rate Limit**
   - Aplikasi membatasi 10 permintaan per jam per IP
   - Status rate limit ditampilkan di bagian atas
   - Notifikasi otomatis jika melebihi batas

## 📁 Struktur Project

```
Utils/
├── backend/
│   ├── app.py              # Flask backend server
│   └── uploads/            # Temporary upload folder
├── frontend/
│   ├── index.html          # Main HTML page
│   └── static/
│       ├── css/
│       │   └── style.css   # Styling (dark theme)
│       └── js/
│           └── app.js      # Frontend logic
├── requirements.txt        # Python dependencies
├── .env.example           # Environment template
├── .gitignore             # Git ignore file
└── README.md              # Documentation
```

## 🎨 Design Features

- **Dark Theme**: Background gelap dengan text cerah untuk kenyamanan mata
- **Modern UI**: Gradient accent, smooth transitions, hover effects
- **Responsive**: Otomatis menyesuaikan ukuran layar (desktop, tablet, mobile)
- **User Feedback**: Loading states, notifications, progress indicators
- **Accessibility**: Clear labels, keyboard navigation support

## 🐛 Troubleshooting

**Error: "GEMINI_API_KEY belum dikonfigurasi"**
- Pastikan file `.env` sudah dibuat
- Periksa API key sudah benar
- Restart server setelah menambahkan API key

**Error: "Failed to connect to server"**
- Pastikan backend sudah berjalan di port 5000
- Periksa firewall tidak memblokir port
- Cek konsol browser untuk error detail

**Rate Limit Exceeded**
- Tunggu hingga periode reset (ditampilkan di UI)
- Atau restart server untuk reset counter

**Image Upload Failed**
- Periksa ukuran file tidak melebihi 16MB
- Pastikan format file didukung
- Coba compress gambar terlebih dahulu

## 🔐 Security Notes

- API key disimpan di `.env` (tidak di-commit ke git)
- Rate limiting mencegah abuse
- File upload divalidasi (type & size)
- Temporary files dibersihkan setelah proses

## 📜 License

MIT License - Silakan gunakan untuk pembelajaran dan proyek pribadi.

## 👨‍💻 Developer

Dibuat dengan ❤️ menggunakan Python, Flask, dan Gemini AI

## 🙏 Credits

- [Google Gemini AI](https://ai.google.dev/) - OCR & AI Processing
- [Flask](https://flask.palletsprojects.com/) - Web Framework
- [Font Awesome](https://fontawesome.com/) - Icons

---

**Catatan:** Pastikan menggunakan API key Gemini AI dengan bijak dan tidak membagikannya secara publik.
