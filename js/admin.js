/* =====================================================================
   FUN CENTER — Content Manager (admin.js)
   Mengelola database konten. Disimpan di localStorage + export database.js
   ===================================================================== */

const ADMIN_PASSWORD = "dev123"; // ganti sesuai kebutuhan (client-side gate)

let DB = loadDB();
let activeTab = "apps";
let editingId = null;

function loadDB() {
  try {
    const ls = localStorage.getItem("FUN_DB");
    if (ls) return JSON.parse(ls);
  } catch (e) {}
  const seed = window.FUN_DB || { apps: [], blogs: [], videos: [], music: [] };
  return JSON.parse(JSON.stringify(seed));
}

function saveDB() {
  localStorage.setItem("FUN_DB", JSON.stringify(DB));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(s) {
  return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- Field config per type ---------- */
const FIELDS = {
  apps: [
    { k: "title", label: "Judul *", type: "text", required: true },
    { k: "category", label: "Kategori", type: "text", ph: "mis. Productivity" },
    { k: "version", label: "Versi", type: "text", ph: "1.0.0" },
    { k: "thumbnail_url", label: "Thumbnail", type: "text", ph: "https://... atau img/foo.jpg", uploadType: "image" },
    { k: "description", label: "Deskripsi", type: "textarea" },
    { k: "download_type", label: "Tipe Download", type: "select", options: [["link", "Link Download (GDrive/GitHub/dll)"], ["custom", "Custom Code (JS)"]] },
    { k: "download_url", label: "Download URL", type: "text", ph: "https://drive.google.com/...", showIf: ["download_type", "link"], uploadType: "apk" },
    { k: "custom_code", label: "Custom Code (JavaScript)", type: "textarea", ph: "window.open('https://...','_blank');", showIf: ["download_type", "custom"] },
  ],
  blogs: [
    { k: "title", label: "Judul *", type: "text", required: true },
    { k: "author", label: "Author", type: "text" },
    { k: "thumbnail_url", label: "Thumbnail", type: "text", ph: "https://...", uploadType: "image" },
    { k: "external_url", label: "URL Blog Eksternal *", type: "text", required: true, ph: "https://..." },
    { k: "description", label: "Deskripsi", type: "textarea" },
  ],
  videos: [
    { k: "title", label: "Judul *", type: "text", required: true },
    { k: "category", label: "Kategori", type: "text" },
    { k: "thumbnail_url", label: "Thumbnail", type: "text", ph: "https://...", uploadType: "image" },
    { k: "source", label: "Tipe Sumber", type: "select", options: [["external", "URL Video (mp4/dll)"], ["embed", "Embed Code (YouTube/Vimeo)"]] },
    { k: "video_url", label: "Video URL", type: "text", ph: "https://.../video.mp4", showIf: ["source", "external"], uploadType: "video" },
    { k: "embed_code", label: "Embed Code", type: "textarea", ph: "<iframe ...></iframe>", showIf: ["source", "embed"] },
    { k: "description", label: "Deskripsi", type: "textarea" },
  ],
  music: [
    { k: "title", label: "Judul *", type: "text", required: true },
    { k: "artist", label: "Artist", type: "text" },
    { k: "genre", label: "Genre", type: "text" },
    { k: "thumbnail_url", label: "Cover", type: "text", ph: "https://...", uploadType: "image" },
    { k: "source", label: "Tipe Sumber", type: "select", options: [["external", "URL Audio (mp3/dll)"], ["embed", "Embed Code (Spotify/SoundCloud)"]] },
    { k: "music_url", label: "Audio URL", type: "text", ph: "https://.../song.mp3", showIf: ["source", "external"], uploadType: "audio" },
    { k: "embed_code", label: "Embed Code", type: "textarea", ph: "<iframe ...></iframe>", showIf: ["source", "embed"] },
    { k: "description", label: "Deskripsi", type: "textarea" },
  ],
};

const TAB_LABEL = { apps: "Aplikasi", blogs: "Blog", videos: "Video", music: "Musik", upload: "Upload File" };

/* ---------- Upload constants ---------- */
const ALLOWED_TYPES = {
  image: { accept: "image/*", label: "Gambar", icon: "ph-image", exts: [".jpg",".jpeg",".png",".gif",".webp",".svg"] },
  audio: { accept: "audio/*", label: "Audio", icon: "ph-music-note", exts: [".mp3",".wav",".ogg",".flac",".m4a"] },
  video: { accept: "video/*", label: "Video", icon: "ph-film-strip", exts: [".mp4",".webm",".mov",".avi"] },
  apk:   { accept: ".apk,.xapk,application/vnd.android.package-archive", label: "APK / File", icon: "ph-device-mobile", exts: [".apk",".xapk"] },
  other: { accept: "*/*", label: "File Lainnya", icon: "ph-file", exts: [] },
};

// Config label & icon per uploadType untuk tombol inline
const UPLOAD_BTN_CFG = {
  image: { label: "Upload Gambar", icon: "ph-image", cls: "bg-brand-mint" },
  audio: { label: "Upload Audio",  icon: "ph-music-note", cls: "bg-brand-lavender" },
  video: { label: "Upload Video",  icon: "ph-film-strip", cls: "bg-brand-yellow" },
  apk:   { label: "Upload APK",    icon: "ph-device-mobile", cls: "bg-brand-coral" },
};

let uploadedFiles = JSON.parse(localStorage.getItem("FUN_UPLOADS") || "[]");

function saveUploads() {
  localStorage.setItem("FUN_UPLOADS", JSON.stringify(uploadedFiles));
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function getFileTypeKey(file) {
  const mime = file.type || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (file.name.toLowerCase().endsWith(".apk") || file.name.toLowerCase().endsWith(".xapk")) return "apk";
  return "other";
}

/* ---------- Inline field upload ----------
   Membuka file picker lalu mengisi input field & menyimpan ke uploadedFiles.
   fieldKey: nama field yang akan diisi (mis. "thumbnail_url")
   uploadType: "image" | "audio" | "video" | "apk"
*/
function triggerFieldUpload(fieldKey, uploadType) {
  const cfg = ALLOWED_TYPES[uploadType] || ALLOWED_TYPES.other;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = cfg.accept;
  input.style.display = "none";
  document.body.appendChild(input);
  input.click();

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) { input.remove(); return; }

    // Tampilkan status loading di tombol
    const btn = document.querySelector(`[data-upload-btn="${fieldKey}"]`);
    const originalHTML = btn ? btn.innerHTML : "";
    if (btn) {
      btn.innerHTML = `<i class="ph-bold ph-spinner-gap animate-spin text-xs"></i>`;
      btn.disabled = true;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const typeKey = getFileTypeKey(file);
      const thumb = typeKey === "image" ? dataUrl : null;

      // Simpan ke uploadedFiles
      uploadedFiles.unshift({
        name: file.name,
        size: file.size,
        sizeLabel: formatBytes(file.size),
        typeKey,
        typeLabel: ALLOWED_TYPES[typeKey]?.label || "File",
        date: new Date().toLocaleDateString("id-ID"),
        dataUrl,
        thumb,
      });
      saveUploads();

      // Isi field dengan data URL
      const fieldInput = document.querySelector(`[name="${fieldKey}"]`);
      if (fieldInput) {
        fieldInput.value = dataUrl;
        // Trigger change untuk conditional fields
        fieldInput.dispatchEvent(new Event("input", { bubbles: true }));

        // Preview untuk gambar
        updateFieldPreview(fieldKey, dataUrl, typeKey);
      }

      // Restore tombol
      if (btn) {
        btn.innerHTML = `<i class="ph-bold ph-check text-xs"></i>`;
        btn.disabled = false;
        setTimeout(() => { btn.innerHTML = originalHTML; btn.disabled = false; }, 1800);
      }

      flash(`✓ ${file.name} terupload`);
      input.remove();
    };
    reader.onerror = () => {
      flash("Gagal membaca file.");
      if (btn) { btn.innerHTML = originalHTML; btn.disabled = false; }
      input.remove();
    };
    reader.readAsDataURL(file);
  });
}

/* Tampilkan preview kecil setelah upload berhasil */
function updateFieldPreview(fieldKey, dataUrl, typeKey) {
  const wrap = document.querySelector(`[data-preview-wrap="${fieldKey}"]`);
  if (!wrap) return;
  if (typeKey === "image") {
    wrap.innerHTML = `<img src="${esc(dataUrl)}" class="h-14 nb-border-2 object-cover mt-2" title="Preview thumbnail" />`;
  } else if (typeKey === "audio") {
    wrap.innerHTML = `<audio controls class="w-full mt-2 h-8" style="max-width:240px"><source src="${esc(dataUrl)}" /></audio>`;
  } else if (typeKey === "video") {
    wrap.innerHTML = `<video controls class="mt-2 nb-border-2" style="max-height:80px;max-width:200px"><source src="${esc(dataUrl)}" /></video>`;
  } else {
    wrap.innerHTML = `<span class="text-xs font-bold text-green-600 mt-1 block">✓ File siap: ${esc(dataUrl.slice(0,40))}…</span>`;
  }
}

/* ---------- Upload Tab (standalone) ---------- */
function renderUploadTab() {
  const html = `
  <div class="lg:col-span-2 space-y-6">
    <!-- Upload Area -->
    <div class="bg-surface nb-border nb-shadow p-6">
      <h3 class="font-display font-black text-2xl mb-1">Upload File</h3>
      <p class="text-sm font-medium opacity-60 mb-5">Gambar, Audio, Video, APK, dll.</p>

      <!-- Drop Zone -->
      <div id="drop-zone" class="nb-border-2 border-dashed border-ink/30 rounded-none p-10 text-center cursor-pointer hover:bg-brand-mint/30 transition-colors relative">
        <input type="file" id="file-input" multiple class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <i class="ph-bold ph-cloud-arrow-up text-5xl opacity-30 mb-3 block"></i>
        <p class="font-black text-lg mb-1">Drag & drop file di sini</p>
        <p class="font-medium text-sm opacity-60">atau klik untuk browse</p>
      </div>

      <!-- Progress List -->
      <div id="upload-progress-list" class="mt-4 space-y-2"></div>
    </div>

    <!-- Uploaded Files List -->
    <div class="bg-surface nb-border nb-shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-display font-black text-2xl">File Terupload <span id="upload-count" class="text-base font-bold opacity-50">(${uploadedFiles.length})</span></h3>
        <button id="clear-uploads" class="bg-brand-coral nb-border-2 nb-shadow-sm px-3 py-1.5 font-black uppercase text-xs tracking-widest nb-press inline-flex items-center gap-1">
          <i class="ph-bold ph-trash"></i> Hapus Semua
        </button>
      </div>
      <div id="uploaded-files-list">
        ${renderUploadedFilesList()}
      </div>
    </div>
  </div>`;

  document.querySelector(".grid").innerHTML = html;
  initUploadEvents();
}

function renderUploadedFilesList() {
  if (uploadedFiles.length === 0) {
    return `<p class="font-medium opacity-60 text-sm">Belum ada file yang diupload.</p>`;
  }
  return `<ul class="divide-y-2 divide-ink/10 space-y-0">
    ${uploadedFiles.map((f, i) => `
    <li class="py-3 flex items-center gap-3">
      <div class="w-10 h-10 bg-ink/5 nb-border-2 overflow-hidden shrink-0 flex items-center justify-center">
        ${f.thumb
          ? `<img src="${esc(f.thumb)}" class="w-full h-full object-cover" />`
          : `<i class="ph-bold ${ALLOWED_TYPES[f.typeKey]?.icon || "ph-file"} text-lg opacity-40"></i>`}
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold truncate text-sm">${esc(f.name)}</p>
        <p class="text-xs opacity-50 font-medium">${esc(f.typeLabel)} · ${esc(f.sizeLabel)} · ${esc(f.date)}</p>
      </div>
      <button data-copy-url="${i}" title="Copy URL" class="bg-brand-yellow nb-border-2 nb-shadow-sm px-2.5 py-2 nb-press shrink-0">
        <i class="ph-bold ph-link text-sm"></i>
      </button>
      <button data-del-upload="${i}" title="Hapus" class="bg-brand-coral nb-border-2 nb-shadow-sm px-2.5 py-2 nb-press shrink-0">
        <i class="ph-bold ph-trash text-sm"></i>
      </button>
    </li>`).join("")}
  </ul>`;
}

function refreshUploadList() {
  const el = document.getElementById("uploaded-files-list");
  const cnt = document.getElementById("upload-count");
  if (el) el.innerHTML = renderUploadedFilesList();
  if (cnt) cnt.textContent = `(${uploadedFiles.length})`;
  bindUploadListEvents();
}

function bindUploadListEvents() {
  document.querySelectorAll("[data-copy-url]").forEach(btn => {
    btn.addEventListener("click", () => {
      const f = uploadedFiles[+btn.dataset.copyUrl];
      if (!f) return;
      navigator.clipboard.writeText(f.dataUrl || f.name)
        .then(() => flash("URL disalin!"))
        .catch(() => flash("Gagal menyalin"));
    });
  });
  document.querySelectorAll("[data-del-upload]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.delUpload;
      if (!confirm(`Hapus file "${uploadedFiles[idx]?.name}"?`)) return;
      uploadedFiles.splice(idx, 1);
      saveUploads();
      refreshUploadList();
      flash("File dihapus");
    });
  });
}

function initUploadEvents() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const clearBtn = document.getElementById("clear-uploads");

  dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("bg-brand-mint"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("bg-brand-mint"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("bg-brand-mint");
    handleFiles([...e.dataTransfer.files]);
  });

  fileInput.addEventListener("change", () => {
    handleFiles([...fileInput.files]);
    fileInput.value = "";
  });

  clearBtn.addEventListener("click", () => {
    if (!confirm("Hapus semua file yang terupload?")) return;
    uploadedFiles = [];
    saveUploads();
    refreshUploadList();
    flash("Semua file dihapus");
  });

  bindUploadListEvents();
}

function handleFiles(files) {
  const progressList = document.getElementById("upload-progress-list");
  files.forEach(file => {
    const itemEl = document.createElement("div");
    itemEl.className = "nb-border-2 px-4 py-3 bg-brand-mint/20 space-y-1";
    itemEl.innerHTML = `
      <div class="flex items-center gap-2">
        <i class="ph-bold ph-spinner-gap animate-spin text-sm opacity-60"></i>
        <span class="font-bold text-sm truncate">${esc(file.name)}</span>
        <span class="ml-auto text-xs font-medium opacity-50 shrink-0">${formatBytes(file.size)}</span>
      </div>
      <div class="w-full bg-ink/10 nb-border h-2 overflow-hidden">
        <div class="progress-bar h-full bg-ink transition-all duration-300" style="width:0%"></div>
      </div>
      <div class="progress-text text-xs font-medium opacity-50">Memproses…</div>`;
    progressList.appendChild(itemEl);

    const bar = itemEl.querySelector(".progress-bar");
    const txt = itemEl.querySelector(".progress-text");

    const reader = new FileReader();
    reader.onprogress = e => {
      if (e.lengthComputable) {
        const pct = Math.round(e.loaded / e.total * 100);
        bar.style.width = pct + "%";
        txt.textContent = `${pct}% — ${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;
      }
    };
    reader.onload = e => {
      bar.style.width = "100%";
      txt.textContent = "Selesai ✓";
      itemEl.classList.replace("bg-brand-mint/20", "bg-brand-teal/20");
      itemEl.querySelector("i").className = "ph-bold ph-check-circle text-sm text-green-600";

      const dataUrl = e.target.result;
      const typeKey = getFileTypeKey(file);
      const thumb = typeKey === "image" ? dataUrl : null;

      uploadedFiles.unshift({
        name: file.name,
        size: file.size,
        sizeLabel: formatBytes(file.size),
        typeKey,
        typeLabel: ALLOWED_TYPES[typeKey]?.label || "File",
        date: new Date().toLocaleDateString("id-ID"),
        dataUrl,
        thumb,
      });
      saveUploads();
      refreshUploadList();
      setTimeout(() => itemEl.remove(), 2500);
    };
    reader.onerror = () => {
      txt.textContent = "Gagal membaca file.";
      itemEl.classList.add("border-brand-coral");
      setTimeout(() => itemEl.remove(), 4000);
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Render form ---------- */
function currentItem() {
  if (!editingId) return {};
  return (DB[activeTab] || []).find((x) => x.id === editingId) || {};
}

function renderForm() {
  const item = currentItem();
  const inputCls = "flex-1 bg-white nb-border-2 px-3 py-2 font-bold outline-none focus:bg-brand-mint min-w-0";
  const fields = FIELDS[activeTab];
  const html = `
  <form id="content-form" class="bg-surface nb-border nb-shadow p-6">
    <div class="flex items-center justify-between mb-5">
      <h3 class="font-display font-black text-2xl">${editingId ? "Edit" : "Tambah"} ${TAB_LABEL[activeTab]}</h3>
      ${editingId ? `<button type="button" id="cancel-edit" class="bg-brand-coral nb-border-2 nb-shadow-sm px-3 py-1.5 font-black uppercase text-xs tracking-widest nb-press">Batal Edit</button>` : ""}
    </div>
    <div class="space-y-4">
      ${fields
        .map((f) => {
          const val = item[f.k] != null ? item[f.k] : (f.type === "select" ? f.options[0][0] : "");
          let input;
          if (f.type === "textarea") {
            input = `<textarea name="${f.k}" data-testid="field-${f.k}" rows="3" class="w-full bg-white nb-border-2 px-3 py-2 font-bold outline-none focus:bg-brand-mint" placeholder="${esc(f.ph || "")}">${esc(val)}</textarea>`;
          } else if (f.type === "select") {
            input = `<select name="${f.k}" data-testid="field-${f.k}" class="w-full bg-white nb-border-2 px-3 py-2 font-bold outline-none focus:bg-brand-mint">${f.options
              .map((o) => `<option value="${o[0]}" ${val === o[0] ? "selected" : ""}>${o[1]}</option>`)
              .join("")}</select>`;
          } else {
            // Field teks biasa — jika ada uploadType, wrap dengan tombol upload
            const baseInput = `<input name="${f.k}" data-testid="field-${f.k}" type="text" class="${inputCls}" value="${esc(val)}" placeholder="${esc(f.ph || "")}" ${f.required ? "required" : ""} />`;
            if (f.uploadType) {
              const ucfg = UPLOAD_BTN_CFG[f.uploadType];
              const uploadBtn = `<button type="button"
                data-upload-btn="${f.k}"
                title="${ucfg.label}"
                class="${ucfg.cls} nb-border-2 nb-shadow-sm px-2.5 py-2 nb-press shrink-0 inline-flex items-center gap-1 font-black uppercase text-xs tracking-tight whitespace-nowrap"
              ><i class="ph-bold ${ucfg.icon} text-sm"></i><span class="hidden sm:inline">${ucfg.label}</span></button>`;
              // Preview area (hanya tampil setelah upload)
              const previewWrap = `<div data-preview-wrap="${f.k}"></div>`;
              input = `<div class="flex items-stretch gap-2">${baseInput}${uploadBtn}</div>${previewWrap}`;
            } else {
              input = baseInput;
            }
          }
          const wrapAttr = f.showIf ? `data-showif-key="${f.showIf[0]}" data-showif-val="${f.showIf[1]}"` : "";
          return `<div class="field-wrap" ${wrapAttr}>
            <label class="block font-black uppercase text-xs tracking-widest mb-1.5">${f.label}</label>${input}
          </div>`;
        })
        .join("")}
    </div>
    <button type="submit" data-testid="save-content-btn" class="mt-6 bg-ink text-cream nb-border nb-shadow px-6 py-3 font-black uppercase tracking-widest nb-press nb-hover inline-flex items-center gap-2">
      <i class="ph-bold ph-floppy-disk"></i> ${editingId ? "Update" : "Simpan"}
    </button>
  </form>`;
  document.getElementById("form-area").innerHTML = html;
  applyConditionalFields();

  document.getElementById("content-form").addEventListener("submit", onSubmit);
  document.getElementById("content-form").addEventListener("change", (e) => {
    if (e.target.name === "download_type" || e.target.name === "source") applyConditionalFields();
  });
  const cancel = document.getElementById("cancel-edit");
  if (cancel) cancel.addEventListener("click", () => { editingId = null; renderForm(); });

  // Bind upload buttons
  document.querySelectorAll("[data-upload-btn]").forEach(btn => {
    const fieldKey = btn.dataset.uploadBtn;
    // Cari uploadType dari FIELDS
    const fieldCfg = (FIELDS[activeTab] || []).find(f => f.k === fieldKey);
    if (fieldCfg && fieldCfg.uploadType) {
      btn.addEventListener("click", () => triggerFieldUpload(fieldKey, fieldCfg.uploadType));
    }
  });
}

function applyConditionalFields() {
  const form = document.getElementById("content-form");
  if (!form) return;
  document.querySelectorAll(".field-wrap[data-showif-key]").forEach((w) => {
    const key = w.dataset.showifKey;
    const need = w.dataset.showifVal;
    const ctrl = form.querySelector(`[name="${key}"]`);
    w.style.display = ctrl && ctrl.value === need ? "" : "none";
  });
}

function onSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = {};
  FIELDS[activeTab].forEach((f) => {
    const ctrl = form.querySelector(`[name="${f.k}"]`);
    data[f.k] = ctrl ? ctrl.value.trim() : "";
  });
  if (!data.title) { alert("Judul wajib diisi."); return; }

  if (editingId) {
    const idx = DB[activeTab].findIndex((x) => x.id === editingId);
    DB[activeTab][idx] = { ...DB[activeTab][idx], ...data };
  } else {
    DB[activeTab].unshift({ id: uid(), ...data });
  }
  saveDB();
  editingId = null;
  renderForm();
  renderList();
  flash(editingId ? "Diupdate!" : "Tersimpan!");
}

/* ---------- Render list ---------- */
function renderList() {
  const items = DB[activeTab] || [];
  const html = `
  <div class="bg-surface nb-border nb-shadow p-6">
    <h3 class="font-display font-black text-2xl mb-4">Daftar ${TAB_LABEL[activeTab]} (${items.length})</h3>
    ${
      items.length === 0
        ? `<p class="font-medium opacity-60">Belum ada item.</p>`
        : `<ul class="divide-y-2 divide-ink/15">${items
            .map(
              (it) => `
        <li class="py-3 flex items-center gap-3">
          <div class="w-10 h-10 bg-ink/5 nb-border-2 overflow-hidden shrink-0">${it.thumbnail_url ? `<img src="${esc(it.thumbnail_url)}" class="w-full h-full object-cover" />` : ""}</div>
          <span class="font-bold truncate flex-1">${esc(it.title)}</span>
          <button data-edit="${esc(it.id)}" data-testid="edit-${esc(it.id)}" class="bg-brand-yellow nb-border-2 nb-shadow-sm px-2.5 py-2 nb-press" title="Edit"><i class="ph-bold ph-pencil-simple text-sm"></i></button>
          <button data-del="${esc(it.id)}" data-testid="delete-${esc(it.id)}" class="bg-brand-coral nb-border-2 nb-shadow-sm px-2.5 py-2 nb-press" title="Hapus"><i class="ph-bold ph-trash text-sm"></i></button>
        </li>`
            )
            .join("")}</ul>`
    }
  </div>`;
  document.getElementById("list-area").innerHTML = html;
  document.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => { editingId = b.dataset.edit; renderForm(); window.scrollTo({ top: 0, behavior: "smooth" }); })
  );
  document.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm("Yakin mau hapus item ini?")) return;
      DB[activeTab] = DB[activeTab].filter((x) => x.id !== b.dataset.del);
      saveDB();
      if (editingId === b.dataset.del) editingId = null;
      renderForm();
      renderList();
      flash("Dihapus");
    })
  );
}

/* ---------- Tabs ---------- */
function setTab(tab) {
  activeTab = tab;
  editingId = null;
  document.querySelectorAll(".tab-btn").forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("bg-ink", on);
    b.classList.toggle("text-cream", on);
    b.classList.toggle("bg-cream", !on);
  });
  if (tab === "upload") {
    renderUploadTab();
  } else {
    const grid = document.querySelector(".grid");
    if (grid && grid.children.length === 1 && grid.children[0].classList.contains("lg:col-span-2")) {
      grid.innerHTML = '<div id="form-area"></div><div id="list-area"></div>';
    }
    renderForm();
    renderList();
  }
}

/* ---------- Export ---------- */
function buildDatabaseFile() {
  const banner = `/* FUN CENTER — DATABASE (di-generate dari Content Manager)\n   Edit lewat admin.html atau langsung di sini. */\n\n`;
  return banner + "window.FUN_DB = " + JSON.stringify(DB, null, 2) + ";\n";
}

function exportDownload() {
  const blob = new Blob([buildDatabaseFile()], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "database.js";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  flash("database.js diunduh");
}

async function saveToFile() {
  if (!window.showSaveFilePicker) {
    exportDownload();
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: "database.js",
      types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }],
    });
    const w = await handle.createWritable();
    await w.write(buildDatabaseFile());
    await w.close();
    flash("Tersimpan ke file!");
  } catch (e) {
    if (e.name !== "AbortError") exportDownload();
  }
}

/* ---------- flash toast ---------- */
function flash(msg) {
  let t = document.getElementById("flash");
  if (!t) {
    t = document.createElement("div");
    t.id = "flash";
    t.className = "fixed top-6 right-6 z-[60] bg-ink text-cream nb-border nb-shadow-sm px-5 py-3 font-black uppercase text-xs tracking-widest transition-opacity";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t._t);
  t._t = setTimeout(() => (t.style.opacity = "0"), 2200);
}

/* ---------- Gate + init ---------- */
function openDash() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("dash").classList.remove("hidden");
  setTab("apps");
}

window.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem("admin_ok") === "1") openDash();

  document.getElementById("gate-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = document.getElementById("gate-pass").value;
    if (val === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_ok", "1");
      openDash();
    } else {
      flash("Password salah");
    }
  });

  document.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  document.getElementById("btn-export").addEventListener("click", exportDownload);
  document.getElementById("btn-save").addEventListener("click", saveToFile);
});
