# Fun Center — Local Edition

Versi **lokal/standalone** dari Fun Center. Semua konten diambil dari file
`database.js` yang ada di folder yang sama. Tidak butuh server backend —
cukup buka filenya di browser. Library eksternal (Tailwind, font, ikon) diambil
via CDN, jadi pastikan ada koneksi internet.

## Struktur File
```
funcenter-local/
├── index.html        # Halaman utama website
├── admin.html        # Content Manager (kelola database, mudah tambah konten)
├── database.js       # DATABASE — semua konten ada di sini
├── css/styles.css    # Style neo-brutalist
├── js/app.js         # Logika website
└── js/admin.js       # Logika content manager
```

## Cara Menjalankan
1. **Cara termudah:** klik dua kali `index.html` → terbuka di browser.
2. **Disarankan (lebih stabil):** jalankan server statis lokal supaya
   semua fitur (termasuk "Simpan ke File") berjalan optimal:
   ```bash
   # dari dalam folder funcenter-local
   python3 -m http.server 5500
   # lalu buka http://localhost:5500
   ```

## Mengelola Konten (Tambah/Edit/Hapus)
- Buka **`admin.html`** (password default: `dev123`).
  - Atau dari halaman utama, ketik kata kunci rahasia **`buka-upload-zone`**
    di kotak pencarian — otomatis diarahkan ke Content Manager.
- Tambah/edit/hapus item untuk **Apps, Blog, Video, Music**.
- Perubahan langsung tersimpan di browser (localStorage) & tampil di situs.
- Untuk membuat permanen / bisa dibagikan ke orang lain:
  klik **Export database.js** (atau **Simpan ke File**), lalu **ganti** file
  `database.js` di folder ini dengan yang baru.

## Tipe Konten
| Tipe   | Sumber yang didukung                                        |
|--------|-------------------------------------------------------------|
| Apps   | Link download (GDrive/GitHub/dll) **atau** Custom Code (JS) |
| Blog   | Thumbnail + link artikel eksternal                          |
| Video  | URL video (mp4/dll) **atau** Embed Code (YouTube/Vimeo)     |
| Music  | URL audio (mp3/dll) **atau** Embed Code (Spotify/SoundCloud)|

- **Thumbnail**: boleh link internet (`https://...`) atau path lokal (`img/foo.jpg`).
- **Deskripsi/caption**: langsung dari database.

## Tombol Download (tanpa pindah halaman)
- Tombol **Download** mendorong unduhan file ke user lewat *hidden iframe*,
  jadi **tidak ada redirect / pindah halaman**.
- Link **Google Drive** model `drive.google.com/file/d/ID/view` otomatis
  dikonversi ke link unduh langsung.
- **Custom Code**: jika item Apps memakai tipe `custom`, tombol akan
  menjalankan kode JavaScript yang kamu tentukan (lebih fleksibel — boleh
  redirect, buka tab baru, dll).

## Fitur Player
- **Musik**: play/pause, next/prev, **acak (shuffle)**, **autoplay**, repeat,
  **speed up** (0.5×–2×), mute, seek. Player menempel di bawah & tetap
  jalan saat pindah halaman.
- **Video**: play/pause, next/prev, **acak**, **autoplay**, **speed up**,
  mute, fullscreen, seek.

## Pencarian
Kotak pencarian di navbar memfilter konten di halaman Apps/Blog/Video/Music
secara real-time.

## Catatan
- Password admin bersifat *client-side* (hanya gerbang ringan), bukan keamanan
  sungguhan. Jangan taruh konten sensitif.
- Untuk file dari GDrive yang besar, Google mungkin menampilkan halaman
  konfirmasi virus-scan; itu perilaku Google, bukan bug aplikasi.
