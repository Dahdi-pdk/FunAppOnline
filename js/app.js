/* =====================================================================
   FUN CENTER — Main App (vanilla JS, no build step)
   All content comes from database.js (window.FUN_DB) or localStorage edits.
   ===================================================================== */

const SECRET_KEYWORD = "buka-upload-zone";

const App = {
  search: "",
  route: "/",
  currentMusic: [],
  currentVideos: [],
};

/* ---------- Data ---------- */
function getDB() {
  try {
    const ls = localStorage.getItem("FUN_DB");
    if (ls) return JSON.parse(ls);
  } catch (e) {}
  return window.FUN_DB || { apps: [], blogs: [], videos: [], music: [] };
}

function filterByQuery(items, q, keys) {
  if (!q) return items;
  const lc = q.toLowerCase();
  return items.filter((it) =>
    keys.some((k) => (it[k] || "").toString().toLowerCase().includes(lc))
  );
}

function esc(s) {
  return (s == null ? "" : String(s))
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

/* =======================================================================
   DOWNLOAD ENGINE — background download, zero redirect / zero new tab
   =======================================================================

   Masalah utama:
   Layanan seperti Google Drive / GitHub tidak memberikan file binary
   langsung — mereka mengembalikan halaman HTML (redirect page /
   confirmation page). Kalau kita fetch() langsung, yang tersimpan
   adalah HTML itu → file berisi teks, bukan file aslinya.

   Solusi bertingkat:
   1. Cek apakah URL adalah direct file (berekstensi / MIME binary)
      → fetch() + Blob → simpan langsung (ada progress bar)
   2. Jika bukan direct file (GDrive, GitHub, dsb.)
      → fetch() HEAD dulu untuk cek Content-Type
      → Jika Content-Type adalah text/html → server memberikan halaman,
         bukan file → gunakan <a download> langsung (browser handle sendiri)
      → Jika Content-Type binary → fetch() GET + Blob
   3. Fallback akhir: <a download> — browser buka dialog Save File,
      user tetap di halaman yang sama.
   ======================================================================= */

/* ---------- Deteksi apakah MIME type adalah file nyata (bukan HTML) ---------- */
const BINARY_MIME_RE = /^(application\/(?!xhtml|xml|json|javascript)|video\/|audio\/|image\/(?!svg))/i;

function isBinaryMime(ct) {
  if (!ct) return false;
  return BINARY_MIME_RE.test(ct.split(";")[0].trim());
}

/* ---------- URL normalizer ---------- */
function normalizeUrl(raw) {
  if (!raw) return null;
  const url = raw.trim();

  // Google Drive /file/d/<ID>/... → direct download endpoint
  const gd = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (gd) return `https://drive.google.com/uc?export=download&confirm=t&id=${gd[1]}`;

  // Google Drive /open?id=<ID>
  const gd2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (gd2) return `https://drive.google.com/uc?export=download&confirm=t&id=${gd2[1]}`;

  // Dropbox ?dl=0 → ?dl=1
  if (/dropbox\.com/i.test(url))
    return url.replace(/[?&]dl=0/, "").replace(/\?$/, "") + (url.includes("?") ? "&dl=1" : "?dl=1");

  return url;
}

/* ---------- Tebak nama file ---------- */
function guessFilename(url, contentDisposition, fallbackTitle) {
  if (contentDisposition) {
    const m = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
    if (m) return decodeURIComponent(m[1].trim());
  }
  try {
    const seg = new URL(url).pathname.split("/").pop();
    if (seg && /\.\w{2,6}$/.test(seg)) return decodeURIComponent(seg);
  } catch (_) {}
  try {
    const ext = new URL(url).pathname.match(/(\.\w{2,6})$/);
    return (fallbackTitle || "download") + (ext ? ext[1] : "");
  } catch (_) {}
  return fallbackTitle || "download";
}

/* ---------- Toast progress ---------- */
function toastProgress(id, msg) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.className = "fixed bottom-6 left-6 z-[70] bg-ink text-cream nb-border nb-shadow px-5 py-3 font-black text-xs tracking-widest transition-opacity";
    document.body.appendChild(el);
  }
  el.style.opacity = "1";
  el.innerHTML = msg;
}
function toastProgressRemove(id) {
  const el = document.getElementById(id);
  if (el) { el.style.opacity = "0"; setTimeout(() => el.remove(), 400); }
}

/* ---------- Simpan Blob sebagai file ---------- */
function saveBlobAs(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 15000);
}

/* ---------- Fetch file binary dengan progress ---------- */
async function fetchBinaryWithProgress(url, toastId, fallbackTitle) {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const ct = res.headers.get("content-type") || "";
  // Jika server kembalikan HTML → ini bukan file asli, tolak
  if (/text\/html/i.test(ct)) {
    throw new Error("RECEIVED_HTML");
  }
  if (!isBinaryMime(ct)) {
    throw new Error("NON_BINARY_MIME:" + ct);
  }

  const cd = res.headers.get("content-disposition") || "";
  const filename = guessFilename(url, cd, fallbackTitle);
  const total = parseInt(res.headers.get("content-length") || "0", 10);

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const label = total
      ? `${Math.round((received / total) * 100)}%`
      : `${Math.round(received / 1024)} KB`;
    toastProgress(toastId, `⬇ Mengunduh <b>${filename}</b> — ${label}`);
  }

  const blob = new Blob(chunks, { type: ct || "application/octet-stream" });
  return { blob, filename };
}

/* ---------- Fallback: <a download> langsung ---------- */
function anchorDownload(url, title) {
  const a = document.createElement("a");
  a.href = url;
  a.download = title || "download";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 2000);
}

/* ---------- MAIN: pushDownload ---------- */
async function pushDownload(item) {
  if (!item) return;

  // Custom code path
  if (item.download_type === "custom" && item.custom_code) {
    try { new Function(item.custom_code)(); }
    catch (e) { alert("Custom code error: " + e.message); }
    return;
  }

  const rawUrl = item.download_url || item.video_url || item.music_url;
  if (!rawUrl || !rawUrl.trim()) {
    alert("Tidak ada link download untuk item ini.");
    return;
  }

  const url = normalizeUrl(rawUrl);
  const toastId = "dl-" + Date.now();
  toastProgress(toastId, `⬇ Mempersiapkan unduhan…`);

  try {
    // Langkah 1: HEAD request — cek apakah URL langsung ke file binary
    let headCt = "";
    try {
      const head = await fetch(url, { method: "HEAD", mode: "cors", credentials: "omit" });
      headCt = head.headers.get("content-type") || "";
    } catch (_) {
      // HEAD diblokir CORS — lanjut coba GET
    }

    if (/text\/html/i.test(headCt)) {
      // Server pasti akan kembalikan HTML (redirect/confirm page)
      // → langsung pakai anchor, jangan fetch GET
      throw new Error("HEAD_HTML");
    }

    // Langkah 2: Kalau MIME binary atau HEAD gagal → coba fetch GET
    const { blob, filename } = await fetchBinaryWithProgress(url, toastId, item.title);
    saveBlobAs(blob, filename);
    toastProgressRemove(toastId);
    toast(`✓ Tersimpan: ${filename}`);

  } catch (err) {
    // Langkah 3 (fallback): <a download> — browser handle sendiri
    // Tidak ada redirect, tidak buka tab baru. Browser akan tampilkan
    // dialog "Simpan File" atau langsung simpan ke folder Downloads.
    console.warn("[pushDownload] fallback ke anchor:", err.message);
    toastProgressRemove(toastId);
    anchorDownload(url, item.title);
    toast(`⬇ Mengunduh: ${item.title || "file"}`);
  }
}

/* tiny toast */
function toast(msg) {
  let t = document.getElementById("nb-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "nb-toast";
    t.className =
      "fixed top-6 right-6 z-[60] bg-ink text-cream nb-border nb-shadow-sm px-5 py-3 font-black uppercase text-xs tracking-widest";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.style.opacity = "0"), 2500);
}

/* ===================================================================
   NAVBAR
   =================================================================== */
function Navbar() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/apps", label: "Apps" },
    { to: "/blog", label: "Blog" },
    { to: "/videos", label: "Video" },
    { to: "/music", label: "Music" },
  ];
  const route = App.route;
  return `
  <div class="bg-cream border-b-4 border-ink sticky top-0 z-50">
    <div class="max-w-[1400px] mx-auto px-4 sm:px-12 py-3 flex items-center gap-3 sm:gap-6 flex-wrap">
      <a href="#/" class="font-display font-black text-xl sm:text-2xl tracking-tight shrink-0">
        FUN<span class="text-brand-coral">CENTER</span>.
      </a>
      <nav class="flex items-center gap-1 sm:gap-2 order-3 sm:order-2 w-full sm:w-auto overflow-x-auto">
        ${links
          .map(
            (l) => `
          <a href="#${l.to}" data-testid="nav-${l.label.toLowerCase()}"
             class="px-3 py-1.5 font-black uppercase text-xs tracking-widest whitespace-nowrap nb-border-2 nb-press ${
               route === l.to ? "bg-ink text-cream" : "bg-surface"
             }">${l.label}</a>`
          )
          .join("")}
      </nav>
      <div class="flex-1 min-w-[140px] order-2 sm:order-3 sm:flex-none sm:ml-auto">
        <div class="flex items-center bg-surface nb-border-2 px-3 py-1.5">
          <i class="ph ph-magnifying-glass text-lg"></i>
          <input id="search" data-testid="search-input" value="${esc(App.search)}"
                 placeholder="Cari konten..."
                 class="bg-transparent outline-none font-bold text-sm px-2 w-full sm:w-56" />
        </div>
      </div>
    </div>
  </div>`;
}

/* ===================================================================
   PAGES
   =================================================================== */
function HomePage() {
  const db = getDB();
  const counts = {
    apps: db.apps.length,
    blog: db.blogs.length,
    videos: db.videos.length,
    music: db.music.length,
  };
  const tiles = [
    { to: "/apps", label: "App Store", sub: "Template & Tools", icon: "ph-app-window", bg: "bg-brand-yellow", k: "apps" },
    { to: "/blog", label: "Blog Hub", sub: "Tulisan keren", icon: "ph-article", bg: "bg-brand-lavender", k: "blog" },
    { to: "/videos", label: "Video Vault", sub: "Tonton & download", icon: "ph-film-strip", bg: "bg-brand-coral", k: "videos" },
    { to: "/music", label: "Music Lab", sub: "Putar & nikmati", icon: "ph-music-note", bg: "bg-brand-teal", k: "music" },
  ];
  return `
  <section class="max-w-[1400px] mx-auto px-6 sm:px-12 pt-10 sm:pt-16 pb-12" data-testid="home-page">
    <div class="grid lg:grid-cols-12 gap-8 items-center">
      <div class="lg:col-span-7">
        <span class="inline-block bg-brand-teal nb-border px-3 py-1 nb-shadow-sm font-black uppercase text-xs tracking-[0.25em] mb-6">
          <i class="ph-fill ph-sparkle"></i> Welcome to the Hub
        </span>
        <h1 class="font-display font-black text-5xl sm:text-7xl lg:text-[6.5rem] leading-[0.9] tracking-tight">
          FUN<br/>
          <span class="bg-brand-yellow nb-border px-3 inline-block nb-shadow">CENTER.</span><br/>
          <span class="text-brand-coral" style="text-shadow:4px 4px 0 #0A0A0A">UNLEASHED.</span>
        </h1>
        <p class="mt-8 max-w-xl text-lg font-medium">
          Apps, blog, video, dan musik dalam satu hub. Versi lokal — semua konten dari <code class="bg-brand-yellow px-1">database.js</code>.
        </p>
        <div class="mt-8 flex flex-wrap gap-4">
          <a href="#/apps" class="bg-ink text-cream nb-border nb-shadow px-6 py-4 font-black uppercase tracking-widest nb-hover nb-press inline-flex items-center gap-2">
            Jelajahi Apps <i class="ph-bold ph-arrow-right"></i>
          </a>
          <a href="#/music" class="bg-brand-yellow nb-border nb-shadow px-6 py-4 font-black uppercase tracking-widest nb-hover nb-press inline-flex items-center gap-2">
            Putar Musik <i class="ph-fill ph-lightning"></i>
          </a>
        </div>
      </div>
      <div class="lg:col-span-5 relative">
        <div class="relative">
          <div class="absolute -top-4 -left-4 w-24 h-24 bg-brand-lavender nb-border nb-shadow z-10 flex items-center justify-center font-display font-black text-4xl" style="transform:rotate(-8deg)">★</div>
          <div class="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-teal nb-border nb-shadow flex items-center justify-center font-display font-black text-2xl z-10" style="transform:rotate(8deg)">100% FUN</div>
          <img src="https://images.unsplash.com/photo-1533157950006-c38844053d55?w=800&q=80" alt="hero" class="w-full h-[360px] sm:h-[460px] object-cover nb-border nb-shadow-lg" />
        </div>
      </div>
    </div>
  </section>

  <section class="bg-ink text-cream border-y-4 border-ink py-4 overflow-hidden">
    <div class="flex animate-marquee whitespace-nowrap font-display font-black text-3xl sm:text-5xl">
      ${[0, 1]
        .map(
          () => `<div class="flex items-center gap-8 px-8">
        <span>APPS</span><span class="text-brand-yellow">★</span>
        <span>BLOG</span><span class="text-brand-coral">★</span>
        <span>VIDEO</span><span class="text-brand-teal">★</span>
        <span>MUSIC</span><span class="text-brand-lavender">★</span>
        <span>DOWNLOAD</span><span class="text-brand-yellow">★</span>
        <span>FUN</span><span class="text-brand-coral">★</span>
      </div>`
        )
        .join("")}
    </div>
  </section>

  <section class="max-w-[1400px] mx-auto px-6 sm:px-12 py-16">
    <h2 class="font-display font-black text-4xl sm:text-6xl mb-10 tracking-tight">Pilih Lo Mau Yang Mana.</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
      ${tiles
        .map(
          (t) => `
        <a href="#${t.to}" data-testid="tile-${t.k}" class="${t.bg} nb-border nb-shadow p-8 nb-hover nb-press block">
          <div class="flex items-start justify-between mb-8">
            <i class="${t.icon} ph-duotone" style="font-size:64px"></i>
            <span class="bg-ink text-cream px-3 py-1 font-black text-sm">${counts[t.k]} item</span>
          </div>
          <div class="font-display font-black text-4xl sm:text-5xl mb-2">${t.label}</div>
          <div class="font-bold uppercase text-sm tracking-widest">${t.sub} →</div>
        </a>`
        )
        .join("")}
    </div>
  </section>`;
}

function AppsPage() {
  const db = getDB();
  const filtered = filterByQuery(db.apps, App.search, ["title", "description", "category"]);
  return `
  <div class="max-w-[1400px] mx-auto px-6 sm:px-12 py-12" data-testid="apps-page">
    ${pageHeader("Marketplace", "bg-brand-yellow", "App Store.", "Template aplikasi & tools siap pakai.", `${filtered.length} Aplikasi`)}
    ${
      filtered.length === 0
        ? emptyState("ph-package", "Belum ada aplikasi.")
        : `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
            ${filtered
              .map(
                (a) => `
              <div class="bg-surface nb-border nb-shadow flex flex-col nb-hover" data-testid="app-card-${esc(a.id)}">
                <div class="aspect-[4/3] bg-brand-mint border-b-4 border-ink overflow-hidden relative">
                  ${
                    a.thumbnail_url
                      ? `<img src="${esc(a.thumbnail_url)}" alt="${esc(a.title)}" class="w-full h-full object-cover" />`
                      : `<div class="w-full h-full flex items-center justify-center"><i class="ph-duotone ph-package" style="font-size:80px"></i></div>`
                  }
                  ${a.category ? `<span class="absolute top-3 left-3 bg-brand-yellow nb-border-2 px-2 py-0.5 text-xs font-black uppercase tracking-wider">${esc(a.category)}</span>` : ""}
                </div>
                <div class="p-6 flex flex-col flex-1">
                  <h3 class="font-display font-black text-2xl mb-1 leading-tight">${esc(a.title)}</h3>
                  ${a.version ? `<div class="text-xs font-bold uppercase tracking-widest text-ink/60 mb-2">v${esc(a.version)}</div>` : ""}
                  <p class="text-sm font-medium flex-1 clamp-3">${esc(a.description) || "Aplikasi keren menunggu kamu."}</p>
                  <button data-action="download" data-kind="apps" data-id="${esc(a.id)}" data-testid="app-download-${esc(a.id)}"
                    class="mt-6 bg-ink text-cream nb-border nb-shadow-sm px-4 py-3 font-black uppercase tracking-wider nb-hover nb-press inline-flex items-center justify-center gap-2">
                    <i class="ph-bold ${a.download_type === "custom" ? "ph-lightning" : "ph-download-simple"}"></i>
                    ${a.download_type === "custom" ? "Jalankan" : "Download"}
                  </button>
                </div>
              </div>`
              )
              .join("")}
          </div>`
    }
  </div>`;
}

function BlogPage() {
  const db = getDB();
  const filtered = filterByQuery(db.blogs, App.search, ["title", "description", "author"]);
  const featured = filtered[0];
  const rest = filtered.slice(1);
  return `
  <div class="max-w-[1400px] mx-auto px-6 sm:px-12 py-12" data-testid="blog-page">
    ${pageHeader("Reading List", "bg-brand-lavender", "Blog Hub.", "Kumpulan artikel pilihan dari seluruh internet.", `${filtered.length} Artikel`)}
    ${
      filtered.length === 0
        ? emptyState("ph-article", "Belum ada artikel.")
        : `
      <a href="${esc(featured.external_url)}" target="_blank" rel="noreferrer" data-testid="blog-featured-${esc(featured.id)}"
        class="bg-surface nb-border nb-shadow-lg grid md:grid-cols-2 nb-hover overflow-hidden block">
        <div class="aspect-[16/10] md:aspect-auto bg-brand-coral overflow-hidden border-b-4 md:border-b-0 md:border-r-4 border-ink">
          ${featured.thumbnail_url ? `<img src="${esc(featured.thumbnail_url)}" class="w-full h-full object-cover" />` : `<div class="w-full h-full flex items-center justify-center"><i class="ph-duotone ph-article" style="font-size:120px"></i></div>`}
        </div>
        <div class="p-8 sm:p-12 flex flex-col justify-center">
          <span class="inline-block w-fit bg-brand-yellow nb-border-2 px-2 py-1 font-black uppercase text-xs tracking-widest mb-4">Featured</span>
          <h2 class="font-display font-black text-3xl sm:text-5xl leading-tight mb-4">${esc(featured.title)}</h2>
          <p class="font-medium text-ink/80 mb-6 clamp-3">${esc(featured.description)}</p>
          <div class="flex items-center justify-between">
            ${featured.author ? `<div class="text-sm font-bold uppercase tracking-widest">By ${esc(featured.author)}</div>` : "<span></span>"}
            <i class="ph-bold ph-arrow-up-right" style="font-size:32px"></i>
          </div>
        </div>
      </a>
      ${
        rest.length
          ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-10">
        ${rest
          .map(
            (b) => `
          <a href="${esc(b.external_url)}" target="_blank" rel="noreferrer" data-testid="blog-card-${esc(b.id)}" class="bg-surface nb-border nb-shadow flex flex-col nb-hover overflow-hidden">
            <div class="aspect-video bg-brand-mint overflow-hidden border-b-4 border-ink">
              ${b.thumbnail_url ? `<img src="${esc(b.thumbnail_url)}" class="w-full h-full object-cover" />` : `<div class="w-full h-full flex items-center justify-center"><i class="ph-duotone ph-article" style="font-size:64px"></i></div>`}
            </div>
            <div class="p-6 flex-1 flex flex-col">
              <h3 class="font-display font-black text-xl leading-tight mb-2">${esc(b.title)}</h3>
              <p class="text-sm font-medium clamp-2 flex-1">${esc(b.description)}</p>
              <div class="flex items-center justify-between mt-4">
                ${b.author ? `<span class="text-xs font-bold uppercase tracking-widest">${esc(b.author)}</span>` : "<span></span>"}
                <i class="ph-bold ph-arrow-up-right" style="font-size:24px"></i>
              </div>
            </div>
          </a>`
          )
          .join("")}
      </div>`
          : ""
      }`
    }
  </div>`;
}

function VideosPage() {
  const db = getDB();
  const filtered = filterByQuery(db.videos, App.search, ["title", "description", "category"]);
  App.currentVideos = filtered;
  if (App.video.idx >= filtered.length) App.video.idx = 0;
  if (filtered.length === 0) {
    return `<div class="max-w-[1400px] mx-auto px-6 sm:px-12 py-12" data-testid="videos-page">
      ${pageHeader("Video Vault", "bg-brand-coral", "Video Library.", "", "0 Video")}
      ${emptyState("ph-film-strip", "Belum ada video.")}
    </div>`;
  }
  return `
  <div class="max-w-[1400px] mx-auto px-6 sm:px-12 py-12" data-testid="videos-page">
    ${pageHeader("Video Vault", "bg-brand-coral", "Video Library.", "", `${filtered.length} Video`)}
    <div class="bg-surface nb-border nb-shadow-lg mb-10" data-testid="video-player">
      <div id="vp-media" class="aspect-video bg-ink relative overflow-hidden border-b-4 border-ink"></div>
      <div class="p-6 bg-brand-yellow border-b-4 border-ink">
        <h2 id="vp-title" class="font-display font-black text-2xl sm:text-3xl leading-tight"></h2>
        <p id="vp-desc" class="font-medium mt-1 clamp-2"></p>
      </div>
      <div id="vp-controls" class="p-4 sm:p-6 bg-brand-coral border-b-4 border-ink">
        <div class="flex items-center gap-3 mb-3">
          <span id="vp-cur" class="font-bold text-xs min-w-[40px]">0:00</span>
          <input id="vp-seek" type="range" min="0" max="100" step="0.1" value="0" class="nb-range flex-1" data-testid="video-seek" />
          <span id="vp-dur" class="font-bold text-xs min-w-[40px] text-right">0:00</span>
        </div>
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-2">
            <button data-action="vp-prev" data-testid="video-prev" class="bg-cream nb-border nb-shadow-sm w-12 h-12 flex items-center justify-center nb-press"><i class="ph-fill ph-skip-back text-xl"></i></button>
            <button data-action="vp-toggle" data-testid="video-play" class="bg-ink text-cream nb-border nb-shadow-sm w-12 h-12 flex items-center justify-center nb-press"><i id="vp-play-icon" class="ph-fill ph-play text-2xl"></i></button>
            <button data-action="vp-next" data-testid="video-next" class="bg-cream nb-border nb-shadow-sm w-12 h-12 flex items-center justify-center nb-press"><i class="ph-fill ph-skip-forward text-xl"></i></button>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button data-action="vp-shuffle" id="vp-shuffle" data-testid="video-shuffle" class="${App.video.shuffle ? "bg-ink text-cream" : "bg-cream"} nb-border nb-shadow-sm w-10 h-10 flex items-center justify-center nb-press"><i class="ph-bold ph-shuffle"></i></button>
            <button data-action="vp-autoplay" id="vp-autoplay" data-testid="video-autoplay" class="${App.video.autoplay ? "bg-ink text-cream" : "bg-cream"} nb-border nb-shadow-sm w-10 h-10 flex items-center justify-center nb-press"><i class="ph-bold ph-arrows-clockwise"></i></button>
            <button data-action="vp-speed" id="vp-speed" data-testid="video-speed" class="bg-cream nb-border nb-shadow-sm px-3 h-10 font-black text-sm nb-press">${App.SPEEDS[App.video.speedIdx]}×</button>
            <button data-action="vp-mute" id="vp-mute" data-testid="video-mute" class="${App.video.muted ? "bg-ink text-cream" : "bg-cream"} nb-border nb-shadow-sm w-10 h-10 flex items-center justify-center nb-press"><i class="ph-bold ${App.video.muted ? "ph-speaker-x" : "ph-speaker-high"}"></i></button>
            <button data-action="vp-fullscreen" data-testid="video-fullscreen" class="bg-cream nb-border nb-shadow-sm w-10 h-10 flex items-center justify-center nb-press"><i class="ph-bold ph-corners-out"></i></button>
          </div>
        </div>
      </div>
      <div class="p-4 bg-cream flex items-center justify-between flex-wrap gap-3">
        <div id="vp-pos" class="text-xs font-bold uppercase tracking-widest opacity-70"></div>
        <button data-action="download" data-kind="videos" data-id="" id="vp-download" data-testid="video-download"
          class="bg-ink text-cream nb-border nb-shadow-sm px-4 py-2 font-black uppercase text-xs tracking-widest nb-press inline-flex items-center gap-2">
          <i class="ph-bold ph-download-simple"></i> Download
        </button>
      </div>
    </div>

    <h3 class="font-display font-black text-2xl sm:text-3xl mb-6">Playlist</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      ${filtered
        .map(
          (v, idx) => `
        <button data-action="vp-select" data-idx="${idx}" data-testid="video-thumb-${esc(v.id)}"
          class="vp-thumb text-left bg-surface nb-border nb-shadow flex flex-col nb-hover overflow-hidden ${idx === App.video.idx ? "outline outline-4 outline-brand-coral outline-offset-4" : ""}">
          <div class="aspect-video bg-ink overflow-hidden border-b-4 border-ink relative">
            ${v.thumbnail_url ? `<img src="${esc(v.thumbnail_url)}" class="w-full h-full object-cover" />` : `<div class="w-full h-full flex items-center justify-center text-cream"><i class="ph-duotone ph-film-strip" style="font-size:48px"></i></div>`}
          </div>
          <div class="p-4">
            <h4 class="font-display font-black text-lg leading-tight">${esc(v.title)}</h4>
            ${v.category ? `<div class="text-xs font-bold uppercase tracking-widest mt-1 opacity-70">${esc(v.category)}</div>` : ""}
          </div>
        </button>`
        )
        .join("")}
    </div>
  </div>`;
}

function MusicPage() {
  const db = getDB();
  const filtered = filterByQuery(db.music, App.search, ["title", "artist", "description", "genre"]);
  App.currentMusic = filtered;
  return `
  <div class="max-w-[1400px] mx-auto px-6 sm:px-12 py-10 pb-40" data-testid="music-page">
    ${pageHeader("Music Lab", "bg-brand-teal", "Music Library.", "", `${filtered.length} Lagu`)}
    ${
      filtered.length === 0
        ? emptyState("ph-music-note", "Belum ada musik.")
        : `<div class="bg-surface nb-border nb-shadow overflow-hidden">
        <div class="grid grid-cols-[40px_60px_1fr_120px_60px] gap-3 px-4 py-3 bg-brand-lavender border-b-4 border-ink font-black uppercase text-xs tracking-widest">
          <div>#</div><div></div><div>Judul / Artist</div><div class="hidden sm:block">Genre</div><div></div>
        </div>
        ${filtered
          .map((m, idx) => {
            const isActive = MusicPlayer.list[MusicPlayer.idx] && MusicPlayer.list[MusicPlayer.idx].id === m.id && MusicPlayer.playing;
            return `
          <div data-action="mp-select" data-idx="${idx}" data-testid="music-row-${esc(m.id)}"
            class="grid grid-cols-[40px_60px_1fr_120px_60px] gap-3 px-4 py-3 border-b-2 border-ink/20 cursor-pointer items-center hover:bg-brand-mint">
            <div class="font-black text-sm">${idx + 1}</div>
            <div class="w-12 h-12 bg-ink overflow-hidden border-2 border-ink">
              ${m.thumbnail_url ? `<img src="${esc(m.thumbnail_url)}" class="w-full h-full object-cover" />` : `<div class="w-full h-full flex items-center justify-center text-cream"><i class="ph-duotone ph-music-note"></i></div>`}
            </div>
            <div class="min-w-0">
              <div class="font-display font-black text-base sm:text-lg truncate flex items-center gap-2">
                ${isActive ? `<span class="inline-block w-2 h-2 bg-brand-coral" style="animation:pulse 1s infinite"></span>` : ""}${esc(m.title)}
              </div>
              <div class="text-xs font-bold uppercase tracking-widest opacity-70 truncate">${esc(m.artist)}</div>
            </div>
            <div class="hidden sm:block text-xs font-bold uppercase tracking-widest opacity-70">${esc(m.genre)}</div>
            <div class="text-right">
              ${
                m.source !== "embed"
                  ? `<button data-action="download" data-kind="music" data-id="${esc(m.id)}" data-testid="music-download-${esc(m.id)}"
                      class="inline-flex bg-ink text-cream p-2 nb-border-2 nb-shadow-sm nb-press" onclick="event.stopPropagation()"><i class="ph-bold ph-download-simple text-sm"></i></button>`
                  : `<i class="ph ph-globe opacity-50"></i>`
              }
            </div>
          </div>`;
          })
          .join("")}
      </div>`
    }
  </div>`;
}

/* shared bits */
function pageHeader(badge, badgeBg, title, sub, count) {
  return `
  <div class="flex items-end justify-between flex-wrap gap-4 mb-8">
    <div>
      <span class="inline-block ${badgeBg} nb-border nb-shadow-sm px-3 py-1 font-black uppercase text-xs tracking-[0.25em] mb-3">${badge}</span>
      <h1 class="font-display font-black text-4xl sm:text-6xl tracking-tight">${title}</h1>
      ${sub ? `<p class="font-medium mt-2 text-lg">${sub}</p>` : ""}
    </div>
    <div class="bg-ink text-cream px-4 py-2 font-black uppercase text-sm">${count}</div>
  </div>`;
}

function emptyState(icon, text) {
  return `<div class="bg-surface nb-border nb-shadow-sm p-12 text-center">
    <i class="${icon} ph-duotone" style="font-size:64px"></i>
    <p class="font-display font-black text-2xl mt-4">${text}</p>
    <p class="font-medium text-ink/70 mt-2">Tambahkan konten via <a href="admin.html" class="underline">admin.html</a>.</p>
  </div>`;
}

/* ===================================================================
   VIDEO PLAYER (DOM-driven, single element)
   =================================================================== */
App.SPEEDS = [0.5, 1, 1.25, 1.5, 2];
App.video = { idx: 0, playing: false, shuffle: false, autoplay: true, speedIdx: 1, muted: false, duration: 0 };

const VideoCtl = {
  el: null,
  setVideo(idx) {
    const list = App.currentVideos;
    if (!list.length) return;
    App.video.idx = (idx + list.length) % list.length;
    const v = list[App.video.idx];
    const media = document.getElementById("vp-media");
    const controls = document.getElementById("vp-controls");
    const dl = document.getElementById("vp-download");
    if (!media) return;

    document.getElementById("vp-title").textContent = v.title;
    document.getElementById("vp-desc").textContent = v.description || "";
    document.getElementById("vp-pos").textContent = `Now Playing · ${App.video.idx + 1} / ${list.length}`;

    // active outline
    document.querySelectorAll(".vp-thumb").forEach((t, i) => {
      t.classList.toggle("outline", i === App.video.idx);
      t.classList.toggle("outline-4", i === App.video.idx);
      t.classList.toggle("outline-brand-coral", i === App.video.idx);
      t.classList.toggle("outline-offset-4", i === App.video.idx);
    });

    if (v.source === "embed" && v.embed_code) {
      media.innerHTML = `<div class="w-full h-full">${v.embed_code}</div>`;
      controls.style.display = "none";
      dl.style.display = "none";
      this.el = null;
      App.video.playing = false;
      return;
    }
    controls.style.display = "";
    dl.style.display = "";
    dl.setAttribute("data-id", v.id);
    media.innerHTML = `<video id="vp-video" class="w-full h-full object-contain bg-ink" ${v.thumbnail_url ? `poster="${esc(v.thumbnail_url)}"` : ""} src="${esc(v.video_url)}"></video>`;
    this.el = document.getElementById("vp-video");
    this.el.playbackRate = App.SPEEDS[App.video.speedIdx];
    this.el.muted = App.video.muted;
    this.bindEl();
    this.play();
  },
  bindEl() {
    const el = this.el;
    el.addEventListener("loadedmetadata", () => {
      App.video.duration = el.duration;
      const d = document.getElementById("vp-dur");
      if (d) d.textContent = fmtTime(el.duration);
    });
    el.addEventListener("timeupdate", () => {
      if (!el.duration) return;
      const seek = document.getElementById("vp-seek");
      const cur = document.getElementById("vp-cur");
      if (seek) seek.value = (el.currentTime / el.duration) * 100;
      if (cur) cur.textContent = fmtTime(el.currentTime);
    });
    el.addEventListener("ended", () => {
      if (!App.video.autoplay) { this.setPlayIcon(false); return; }
      this.next();
    });
    el.addEventListener("play", () => { App.video.playing = true; this.setPlayIcon(true); });
    el.addEventListener("pause", () => { App.video.playing = false; this.setPlayIcon(false); });
  },
  setPlayIcon(playing) {
    const i = document.getElementById("vp-play-icon");
    if (i) i.className = `ph-fill ${playing ? "ph-pause" : "ph-play"} text-2xl`;
  },
  play() { if (this.el) this.el.play().catch(() => {}); },
  toggle() { if (!this.el) return; this.el.paused ? this.el.play() : this.el.pause(); },
  next() {
    const n = App.currentVideos.length;
    const idx = App.video.shuffle ? Math.floor(Math.random() * n) : App.video.idx + 1;
    this.setVideo(idx);
  },
  prev() { this.setVideo(App.video.idx - 1); },
  seek(pct) { if (this.el && App.video.duration) this.el.currentTime = (pct / 100) * App.video.duration; },
  speed() {
    App.video.speedIdx = (App.video.speedIdx + 1) % App.SPEEDS.length;
    if (this.el) this.el.playbackRate = App.SPEEDS[App.video.speedIdx];
    document.getElementById("vp-speed").textContent = App.SPEEDS[App.video.speedIdx] + "×";
  },
  mute() {
    App.video.muted = !App.video.muted;
    if (this.el) this.el.muted = App.video.muted;
    const b = document.getElementById("vp-mute");
    b.className = `${App.video.muted ? "bg-ink text-cream" : "bg-cream"} nb-border nb-shadow-sm w-10 h-10 flex items-center justify-center nb-press`;
    b.querySelector("i").className = `ph-bold ${App.video.muted ? "ph-speaker-x" : "ph-speaker-high"}`;
  },
  shuffle() {
    App.video.shuffle = !App.video.shuffle;
    toggleBtnClass("vp-shuffle", App.video.shuffle);
  },
  autoplay() {
    App.video.autoplay = !App.video.autoplay;
    toggleBtnClass("vp-autoplay", App.video.autoplay);
  },
  fullscreen() { if (this.el) (document.fullscreenElement ? document.exitFullscreen() : this.el.requestFullscreen?.()); },
};

function toggleBtnClass(id, active) {
  const b = document.getElementById(id);
  if (!b) return;
  b.classList.toggle("bg-ink", active);
  b.classList.toggle("text-cream", active);
  b.classList.toggle("bg-cream", !active);
}

/* ===================================================================
   MUSIC PLAYER (persistent bar + single Audio)
   =================================================================== */
const MusicPlayer = {
  audio: null,
  list: [],
  idx: -1,
  playing: false,
  shuffle: false,
  autoplay: true,
  repeat: false,
  speedIdx: 1,
  muted: false,
  volume: 0.85,
  duration: 0,
  init() {
    this.audio = new Audio();
    this.audio.volume = this.volume;
    this.audio.addEventListener("loadedmetadata", () => {
      this.duration = this.audio.duration;
      const d = document.getElementById("mp-dur");
      if (d) d.textContent = fmtTime(this.duration);
    });
    this.audio.addEventListener("timeupdate", () => {
      if (!this.audio.duration) return;
      const s = document.getElementById("mp-seek");
      const c = document.getElementById("mp-cur");
      if (s) s.value = (this.audio.currentTime / this.audio.duration) * 100;
      if (c) c.textContent = fmtTime(this.audio.currentTime);
    });
    this.audio.addEventListener("ended", () => this.onEnded());
    this.audio.addEventListener("play", () => { this.playing = true; this.renderBar(); });
    this.audio.addEventListener("pause", () => { this.playing = false; this.renderBar(); });
  },
  load(list, idx) {
    this.list = list;
    this.select(idx);
  },
  select(idx) {
    if (!this.list.length) return;
    this.idx = (idx + this.list.length) % this.list.length;
    const m = this.list[this.idx];
    if (m.source === "embed") {
      this.audio.pause();
      this.playing = false;
      this.renderBar();
      // refresh active row indicator if on music page
      if (App.route === "/music") rerenderMusicRows();
      return;
    }
    this.audio.src = m.music_url;
    this.audio.playbackRate = App.SPEEDS[this.speedIdx];
    this.audio.muted = this.muted;
    this.audio.play().catch(() => {});
    this.renderBar();
    if (App.route === "/music") rerenderMusicRows();
  },
  toggle() {
    if (this.idx < 0 && this.list.length) return this.select(0);
    if (!this.audio.src) return;
    this.audio.paused ? this.audio.play() : this.audio.pause();
  },
  onEnded() {
    if (this.repeat) { this.audio.currentTime = 0; this.audio.play(); return; }
    if (!this.autoplay) { this.playing = false; this.renderBar(); return; }
    this.next();
  },
  next() {
    if (!this.list.length) return;
    const idx = this.shuffle ? Math.floor(Math.random() * this.list.length) : this.idx + 1;
    this.select(idx);
  },
  prev() { if (this.list.length) this.select(this.idx - 1); },
  seek(pct) { if (this.audio.duration) this.audio.currentTime = (pct / 100) * this.audio.duration; },
  speed() {
    this.speedIdx = (this.speedIdx + 1) % App.SPEEDS.length;
    this.audio.playbackRate = App.SPEEDS[this.speedIdx];
    this.renderBar();
  },
  mute() { this.muted = !this.muted; this.audio.muted = this.muted; this.renderBar(); },
  toggleShuffle() { this.shuffle = !this.shuffle; this.renderBar(); },
  toggleRepeat() { this.repeat = !this.repeat; this.renderBar(); },
  toggleAutoplay() { this.autoplay = !this.autoplay; this.renderBar(); },
  renderBar() {
    const bar = document.getElementById("player-bar");
    if (this.idx < 0 || !this.list[this.idx]) { bar.innerHTML = ""; return; }
    const m = this.list[this.idx];
    const tb = (active) => (active ? "bg-ink text-cream" : "bg-cream");
    if (m.source === "embed") {
      bar.innerHTML = `
      <div data-testid="music-sticky-player" class="fixed bottom-0 left-0 right-0 bg-brand-coral border-t-4 border-ink z-40" style="box-shadow:0 -8px 0 0 #0A0A0A">
        <div class="max-w-[1400px] mx-auto px-4 sm:px-8 py-3 flex items-center gap-4">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-12 h-12 bg-ink border-2 border-ink overflow-hidden shrink-0">${m.thumbnail_url ? `<img src="${esc(m.thumbnail_url)}" class="w-full h-full object-cover" />` : `<i class="ph-fill ph-music-note text-cream w-full h-full flex items-center justify-center"></i>`}</div>
            <div class="min-w-0"><div class="font-display font-black text-base truncate">${esc(m.title)}</div><div class="text-xs font-bold uppercase tracking-widest opacity-70 truncate">${esc(m.artist)} · Embed</div></div>
          </div>
          <div class="hidden md:block flex-1 max-w-md">${m.embed_code || ""}</div>
          <div class="flex items-center gap-2">
            <button data-action="mp-prev" class="bg-cream nb-border nb-shadow-sm w-10 h-10 flex items-center justify-center nb-press"><i class="ph-fill ph-skip-back"></i></button>
            <button data-action="mp-next" data-testid="music-next" class="bg-cream nb-border nb-shadow-sm w-10 h-10 flex items-center justify-center nb-press"><i class="ph-fill ph-skip-forward"></i></button>
          </div>
        </div>
      </div>`;
      return;
    }
    bar.innerHTML = `
    <div data-testid="music-sticky-player" class="fixed bottom-0 left-0 right-0 bg-brand-coral border-t-4 border-ink z-40" style="box-shadow:0 -8px 0 0 #0A0A0A">
      <div class="max-w-[1400px] mx-auto px-4 sm:px-8 py-3 flex items-center gap-3 sm:gap-4 flex-wrap">
        <div class="flex items-center gap-3 min-w-0 shrink-0">
          <div class="w-14 h-14 bg-ink border-4 border-ink overflow-hidden shrink-0">${m.thumbnail_url ? `<img src="${esc(m.thumbnail_url)}" class="w-full h-full object-cover" />` : `<i class="ph-fill ph-music-note text-cream w-full h-full flex items-center justify-center text-2xl"></i>`}</div>
          <div class="min-w-0 hidden sm:block max-w-[180px]">
            <div class="font-display font-black text-base truncate">${esc(m.title)}</div>
            <div class="text-xs font-bold uppercase tracking-widest opacity-80 truncate">${esc(m.artist)}</div>
          </div>
        </div>
        <div class="flex-1 min-w-[280px] flex flex-col items-center gap-2">
          <div class="flex items-center gap-2">
            <button data-action="mp-shuffle" data-testid="music-shuffle" class="${tb(this.shuffle)} nb-border nb-shadow-sm h-10 min-w-10 px-2 flex items-center justify-center nb-press"><i class="ph-bold ph-shuffle"></i></button>
            <button data-action="mp-prev" data-testid="music-prev" class="bg-cream nb-border nb-shadow-sm w-10 h-10 flex items-center justify-center nb-press"><i class="ph-fill ph-skip-back text-lg"></i></button>
            <button data-action="mp-toggle" data-testid="music-play" class="bg-ink text-cream nb-border nb-shadow-sm w-10 h-10 flex items-center justify-center nb-press"><i class="ph-fill ${this.playing ? "ph-pause" : "ph-play"} text-xl"></i></button>
            <button data-action="mp-next" data-testid="music-next" class="bg-cream nb-border nb-shadow-sm w-10 h-10 flex items-center justify-center nb-press"><i class="ph-fill ph-skip-forward text-lg"></i></button>
            <button data-action="mp-repeat" data-testid="music-repeat" class="${tb(this.repeat)} nb-border nb-shadow-sm h-10 min-w-10 px-2 flex items-center justify-center nb-press"><i class="ph-bold ph-repeat"></i></button>
          </div>
          <div class="flex items-center gap-2 w-full">
            <span id="mp-cur" class="font-bold text-xs min-w-[32px]">0:00</span>
            <input id="mp-seek" type="range" min="0" max="100" step="0.1" value="0" class="nb-range flex-1" data-testid="music-seek" />
            <span id="mp-dur" class="font-bold text-xs min-w-[32px] text-right">${fmtTime(this.duration)}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button data-action="mp-autoplay" data-testid="music-autoplay" class="${tb(this.autoplay)} nb-border nb-shadow-sm h-10 min-w-10 px-2 flex items-center justify-center nb-press"><span class="font-black text-[10px]">AUTO</span></button>
          <button data-action="mp-speed" data-testid="music-speed" class="bg-cream nb-border nb-shadow-sm px-3 h-10 font-black text-xs nb-press">${App.SPEEDS[this.speedIdx]}×</button>
          <button data-action="mp-mute" data-testid="music-mute" class="${tb(this.muted)} nb-border nb-shadow-sm h-10 min-w-10 px-2 flex items-center justify-center nb-press"><i class="ph-bold ${this.muted ? "ph-speaker-x" : "ph-speaker-high"}"></i></button>
        </div>
      </div>
    </div>`;
  },
};

function rerenderMusicRows() {
  // lightweight: re-render music page rows to update active indicator
  const page = document.querySelector('[data-testid="music-page"]');
  if (page) { document.getElementById("app").innerHTML = MusicPage(); }
}

/* ===================================================================
   ROUTER + EVENTS
   =================================================================== */
function currentRoute() {
  const h = location.hash.replace(/^#/, "") || "/";
  return h;
}

function render() {
  App.route = currentRoute();
  document.getElementById("navbar").innerHTML = Navbar();
  const app = document.getElementById("app");
  switch (App.route) {
    case "/apps": app.innerHTML = AppsPage(); break;
    case "/blog": app.innerHTML = BlogPage(); break;
    case "/videos": app.innerHTML = VideosPage(); VideoCtl.setVideo(App.video.idx); break;
    case "/music": app.innerHTML = MusicPage(); break;
    default: app.innerHTML = HomePage();
  }
  window.scrollTo(0, 0);
}

function findItem(kind, id) {
  const db = getDB();
  return (db[kind] || []).find((x) => x.id === id);
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  switch (a) {
    case "download": pushDownload(findItem(el.dataset.kind, el.dataset.id)); break;
    case "mp-select": MusicPlayer.load(App.currentMusic, parseInt(el.dataset.idx)); break;
    case "mp-toggle": MusicPlayer.toggle(); break;
    case "mp-next": MusicPlayer.next(); break;
    case "mp-prev": MusicPlayer.prev(); break;
    case "mp-shuffle": MusicPlayer.toggleShuffle(); break;
    case "mp-repeat": MusicPlayer.toggleRepeat(); break;
    case "mp-autoplay": MusicPlayer.toggleAutoplay(); break;
    case "mp-speed": MusicPlayer.speed(); break;
    case "mp-mute": MusicPlayer.mute(); break;
    case "vp-select": VideoCtl.setVideo(parseInt(el.dataset.idx)); break;
    case "vp-toggle": VideoCtl.toggle(); break;
    case "vp-next": VideoCtl.next(); break;
    case "vp-prev": VideoCtl.prev(); break;
    case "vp-shuffle": VideoCtl.shuffle(); break;
    case "vp-autoplay": VideoCtl.autoplay(); break;
    case "vp-speed": VideoCtl.speed(); break;
    case "vp-mute": VideoCtl.mute(); break;
    case "vp-fullscreen": VideoCtl.fullscreen(); break;
  }
});

document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "search") onSearch(el.value);
  else if (el.id === "mp-seek") MusicPlayer.seek(parseFloat(el.value));
  else if (el.id === "vp-seek") VideoCtl.seek(parseFloat(el.value));
});

let searchTimer = null;
function onSearch(val) {
  if (val.trim().toLowerCase() === SECRET_KEYWORD) {
    window.location.href = "admin.html";
    return;
  }
  App.search = val;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    // re-render only list pages (keep caret by not touching navbar input value on home)
    const app = document.getElementById("app");
    if (App.route === "/apps") app.innerHTML = AppsPage();
    else if (App.route === "/blog") app.innerHTML = BlogPage();
    else if (App.route === "/music") app.innerHTML = MusicPage();
    else if (App.route === "/videos") { app.innerHTML = VideosPage(); VideoCtl.setVideo(App.video.idx); }
  }, 120);
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  MusicPlayer.init();
  render();
});

/* keyframes for pulse (used inline) */
const styleEl = document.createElement("style");
styleEl.textContent = "@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}";
document.head.appendChild(styleEl);
