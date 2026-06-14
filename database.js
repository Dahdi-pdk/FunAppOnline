/* =====================================================================
   FUN CENTER — DATABASE
   ---------------------------------------------------------------------
   File ini adalah "database" dari website. Semua konten diambil dari sini.
   Edit lewat halaman admin.html (lebih mudah) ATAU langsung di file ini.

   Struktur tiap item:
   - apps   : { id, title, category, version, description, thumbnail_url,
                download_type ("link" | "custom"), download_url, custom_code }
   - blogs  : { id, title, author, description, thumbnail_url, external_url }
   - videos : { id, title, category, description, thumbnail_url,
                source ("external" | "embed"), video_url, embed_code }
   - music  : { id, title, artist, genre, description, thumbnail_url,
                source ("external" | "embed"), music_url, embed_code }

   thumbnail_url boleh berupa link internet ATAU path lokal (mis. "img/foo.jpg").
   download_url boleh dari GDrive / GitHub / link langsung apapun.
   custom_code = kode JavaScript yang dijalankan saat tombol download ditekan
                 (lebih fleksibel, boleh redirect / buka tab / dsb).
   ===================================================================== */

window.FUN_DB = {
  apps: [
    {
      id: "app-1",
      title: "Brutalist Portfolio Kit",
      category: "Template",
      version: "1.2.0",
      description: "Template portfolio neo-brutalist siap pakai. Tinggal ganti konten, deploy, kelar.",
      thumbnail_url: "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=600&q=80",
      download_type: "link",
      download_url: "https://github.com/topics/portfolio-template",
      custom_code: ""
    },
    {
      id: "app-2",
      title: "Pomodoro Focus",
      category: "Productivity",
      version: "2.0.1",
      description: "Timer fokus minimalis dengan statistik harian. Bikin kerja makin produktif.",
      thumbnail_url: "https://images.unsplash.com/photo-1501139083538-0139583c060f?w=600&q=80",
      download_type: "link",
      download_url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz12345/view",
      custom_code: ""
    },
    {
      id: "app-3",
      title: "Open GitHub Repo",
      category: "Tools",
      version: "1.0.0",
      description: "Contoh tombol dengan CUSTOM CODE: saat ditekan, membuka repo GitHub di tab baru.",
      thumbnail_url: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=600&q=80",
      download_type: "custom",
      download_url: "",
      custom_code: "window.open('https://github.com/', '_blank');"
    }
  ],

  blogs: [
    {
      id: "blog-1",
      title: "Kenapa Neo-Brutalism Lagi Naik Daun di 2026",
      author: "Design Weekly",
      description: "Tren desain yang berani, kontras tinggi, dan penuh kepribadian. Ini alasannya makin populer.",
      thumbnail_url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80",
      external_url: "https://www.smashingmagazine.com/"
    },
    {
      id: "blog-2",
      title: "10 Tools Gratis untuk Developer Pemula",
      author: "Dev Notes",
      description: "Koleksi tools wajib yang bikin hidup ngoding lebih gampang. Semua gratis.",
      thumbnail_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80",
      external_url: "https://dev.to/"
    },
    {
      id: "blog-3",
      title: "Belajar CSS Grid dalam 15 Menit",
      author: "CSS Tricks",
      description: "Panduan kilat memahami CSS Grid dengan contoh praktis dan langsung bisa dipakai.",
      thumbnail_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
      external_url: "https://css-tricks.com/"
    }
  ],

  videos: [
    {
      id: "vid-1",
      title: "Big Buck Bunny (Sample MP4)",
      category: "Animasi",
      description: "Video sample untuk mencoba player. Bisa diputar, dipercepat, di-shuffle, dan diunduh.",
      thumbnail_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/480px-Big_buck_bunny_poster_big.jpg",
      source: "external",
      video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      embed_code: ""
    },
    {
      id: "vid-2",
      title: "Lo-Fi Coding Mix (YouTube Embed)",
      category: "Musik",
      description: "Contoh video embed dari YouTube.",
      thumbnail_url: "",
      source: "embed",
      video_url: "",
      embed_code: "<iframe width=\"100%\" height=\"100%\" src=\"https://www.youtube.com/embed/jfKfPfyJRdk\" title=\"YouTube\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" allowfullscreen></iframe>"
    }
  ],

  music: [
    {
      id: "mus-1",
      title: "SoundHelix Song 1",
      artist: "SoundHelix",
      genre: "Electronic",
      description: "Lagu sample untuk mencoba player musik.",
      thumbnail_url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80",
      source: "external",
      music_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      embed_code: ""
    },
    {
      id: "mus-2",
      title: "SoundHelix Song 2",
      artist: "SoundHelix",
      genre: "Chill",
      description: "Sample kedua, cocok buat tes fitur next/shuffle.",
      thumbnail_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80",
      source: "external",
      music_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      embed_code: ""
    },
    {
      id: "mus-3",
      title: "Spotify Playlist (Embed)",
      artist: "Various",
      genre: "Playlist",
      description: "Contoh musik embed dari Spotify.",
      thumbnail_url: "",
      source: "embed",
      music_url: "",
      embed_code: "<iframe style=\"border-radius:12px\" src=\"https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator\" width=\"100%\" height=\"152\" frameborder=\"0\" allow=\"autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture\" loading=\"lazy\"></iframe>"
    }
  ]
};
