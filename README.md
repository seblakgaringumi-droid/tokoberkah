# 🛒 Toko Berkah POS (Point of Sale & WebApp Toko)

Aplikasi Web Manajemen Kasir (POS), Manajemen Stok Produk Sembako, Pesanan Online, Buku Utang-Piutang, dan Laporan Keuangan Toko Berkah yang terintegrasi langsung dengan database **Supabase**.

---

## ✨ Fitur Unggulan

- **Kasir & Point of Sale (POS)**:
  - Input kuantitas desimal/pecahan (contoh: 0.25 kg, 0.5 kg, 1.25 kg).
  - Tombol pintas varian berat cepat (*1 kg*, *Setengah / 0.5 kg*, *Saparapat / 0.25 kg*, *1 Ons / 0.1 kg*).
  - Tombol reset/kosongkan keranjang (**HAPUS**) dengan konfirmasi aman.
  - Pencarian cepat nama produk dan barcode scanner input.
  - Metode pembayaran fleksibel: Tunai/Cash, QRIS, Transfer Bank, dan Utang/Bon.
  - Cetak Struk Belanja dengan profil toko yang dapat disesuaikan.
- **Manajemen Stok Produk**:
  - Filter kategori, penyesuaian stok manual, badge stok kritis/menipis.
- **Pesanan Online**:
  - Manajemen status pesanan (PENDING, DIPROSES, SELESAI).
- **Buku Catatan Utang / Kasbon**:
  - Pencatatan utang pelanggan, tanggal jatuh tempo, dan pelunasan bertahap.
- **Laporan Penjualan & Keuangan**:
  - Ringkasan omset harian, rincian per produk, ekspor data, dan riwayat transaksi.

---

## 🚀 Panduan Push ke GitHub

### Metode 1: Menggunakan Git CLI (Rekomendasi)

1. Buat Repository baru di [GitHub](https://github.com/new) (contoh nama: `toko-berkah-pos`).
2. Buka terminal di folder proyek ini dan jalankan perintah berikut:

```bash
# 1. Inisialisasi Git (jika belum)
git init

# 2. Tambahkan semua file
git add .

# 3. Buat Commit Pertama
git commit -m "feat: initial commit toko berkah pos"

# 4. Ganti nama branch utama ke main
git branch -M main

# 5. Hubungkan ke repository GitHub Anda
git remote add origin https://github.com/USERNAME_ANDA/toko-berkah-pos.git

# 6. Push ke GitHub
git push -u origin main
```

*(Ganti `USERNAME_ANDA` dengan username GitHub Anda).*

---

### Metode 2: Upload Manual via GitHub Web (Drag & Drop)

1. Buat Repository baru di [GitHub](https://github.com/new).
2. Pada halaman repository yang baru dibuat, klik **"uploading an existing file"**.
3. **PENTING**: Jangan upload folder `node_modules` atau `dist`. Cukup upload seluruh file/folder berikut:
   - `src/`
   - `public/`
   - `.github/` (opsional)
   - `index.html`
   - `package.json`
   - `tsconfig.json`
   - `vite.config.ts`
   - `.gitignore`
   - `.env.example`
   - `README.md`
4. Klik **Commit changes**.

---

## 🌐 Panduan Deploy Gratis

### Pilihan 1: Deploy ke Vercel (Sangat Direkomendasikan ⭐)

1. Buka [Vercel](https://vercel.com) dan login dengan akun GitHub Anda.
2. Klik **"Add New"** > **"Project"**.
3. Pilih repository `toko-berkah-pos` yang telah Anda push.
4. Pada bagian **Environment Variables**, tambahkan:
   - `VITE_SUPABASE_URL`: `https://kquxfvcbgogjpthhsseg.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxdXhmdmNiZ29nanB0aGhzc2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MDI0OTEsImV4cCI6MjEwMTk3ODQ5MX0.xYs1LZHOYbNssk_6T0zpLzsXACjJxh4ksJnCMkUky9s`
5. Klik **"Deploy"**. WebApp Anda langsung aktif dan dapat diakses publik dalam hitungan detik!

---

### Pilihan 2: Deploy ke Netlify

1. Buka [Netlify](https://app.netlify.com) dan login dengan GitHub.
2. Klik **"Add new site"** > **"Import an existing project"**.
3. Pilih repository GitHub Anda.
4. Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Tambahkan Environment Variables (`VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`).
6. Klik **"Deploy site"**.

---

### Pilihan 3: Deploy ke GitHub Pages (Otomatis via GitHub Actions)

Proyek ini sudah dilengkapi file workflow `.github/workflows/deploy.yml`:
1. Masuk ke tab **Settings** di repository GitHub Anda.
2. Masuk ke menu **Pages** di sebelah kiri.
3. Pada bagian **Build and deployment > Source**, pilih **GitHub Actions**.
4. Di bagian **Settings > Secrets and variables > Actions**, Anda dapat menambahkan secret `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (atau menggunakan nilai default).
5. Setiap kali Anda melakukan `git push`, GitHub akan otomatis meng-compile dan mendeploy webapp ke GitHub Pages!

---

## 💻 Menjalankan di Komputer Lokal (Localhost)

```bash
# 1. Install dependensi
npm install

# 2. Salin file environment
cp .env.example .env

# 3. Jalankan development server
npm run dev

# 4. Buka di browser
http://localhost:3000
```

---

## 📁 Struktur Direktori

```
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions Auto-Deploy ke Pages
├── public/                     # Asset statis
├── src/
│   ├── components/             # Komponen UI (Kasir, Stok, Pesanan, Utang, Laporan)
│   ├── lib/                    # Utilitas format uang, tanggal, pembulatan stok
│   ├── services/               # Koneksi Supabase API
│   ├── types.ts                # TypeScript interface data
│   ├── App.tsx                 # Root Component
│   ├── main.tsx                # Entry Point
│   └── index.css               # Tailwind CSS 4 Styling
├── index.html                  # HTML Shell
├── package.json                # Dependensi & script build
├── vite.config.ts              # Konfigurasi Vite & Tailwind
└── README.md                   # Dokumentasi
```
