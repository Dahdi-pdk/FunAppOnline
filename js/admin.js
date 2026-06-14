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
  // seed from database.js
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
    { k: "thumbnail_url", label: "Thumbnail URL (internet / lokal)", type: "text", ph: "https://... atau img/foo.jpg" },
    { k: "description", label: "Deskripsi", type: "textarea" },
    { k: "download_type", label: "Tipe Download", type: "select", options: [["link", "Link Download (GDrive/GitHub/dll)"], ["custom", "Custom Code (JS)"]] },
    { k: "download_url", label: "Download URL", type: "text", ph: "https://drive.google.com/...", showIf: ["download_type", "link"] },
    { k: "custom_code", label: "Custom Code (JavaScript)", type: "textarea", ph: "window.open('https://...','_blank');", showIf: ["download_type", "custom"] },
  ],
  blogs: [
    { k: "title", label: "Judul *", type: "text", required: true },
    { k: "author", label: "Author", type: "text" },
    { k: "thumbnail_url", label: "Thumbnail URL", type: "text", ph: "https://..." },
    { k: "external_url", label: "URL Blog Eksternal *", type: "text", required: true, ph: "https://..." },
    { k: "description", label: "Deskripsi", type: "textarea" },
  ],
  videos: [
    { k: "title", label: "Judul *", type: "text", required: true },
    { k: "category", label: "Kategori", type: "text" },
    { k: "thumbnail_url", label: "Thumbnail URL", type: "text", ph: "https://..." },
    { k: "source", label: "Tipe Sumber", type: "select", options: [["external", "URL Video (mp4/dll)"], ["embed", "Embed Code (YouTube/Vimeo)"]] },
    { k: "video_url", label: "Video URL", type: "text", ph: "https://.../video.mp4", showIf: ["source", "external"] },
    { k: "embed_code", label: "Embed Code", type: "textarea", ph: "<iframe ...></iframe>", showIf: ["source", "embed"] },
    { k: "description", label: "Deskripsi", type: "textarea" },
  ],
  music: [
    { k: "title", label: "Judul *", type: "text", required: true },
    { k: "artist", label: "Artist", type: "text" },
    { k: "genre", label: "Genre", type: "text" },
    { k: "thumbnail_url", label: "Cover URL", type: "text", ph: "https://..." },
    { k: "source", label: "Tipe Sumber", type: "select", options: [["external", "URL Audio (mp3/dll)"], ["embed", "Embed Code (Spotify/SoundCloud)"]] },
    { k: "music_url", label: "Audio URL", type: "text", ph: "https://.../song.mp3", showIf: ["source", "external"] },
    { k: "embed_code", label: "Embed Code", type: "textarea", ph: "<iframe ...></iframe>", showIf: ["source", "embed"] },
    { k: "description", label: "Deskripsi", type: "textarea" },
  ],
};

const TAB_LABEL = { apps: "Aplikasi", blogs: "Blog", videos: "Video", music: "Musik" };

/* ---------- Render form ---------- */
function currentItem() {
  if (!editingId) return {};
  return (DB[activeTab] || []).find((x) => x.id === editingId) || {};
}

function renderForm() {
  const item = currentItem();
  const inputCls = "w-full bg-white nb-border-2 px-3 py-2 font-bold outline-none focus:bg-brand-mint";
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
            input = `<textarea name="${f.k}" data-testid="field-${f.k}" rows="3" class="${inputCls}" placeholder="${esc(f.ph || "")}">${esc(val)}</textarea>`;
          } else if (f.type === "select") {
            input = `<select name="${f.k}" data-testid="field-${f.k}" class="${inputCls}">${f.options
              .map((o) => `<option value="${o[0]}" ${val === o[0] ? "selected" : ""}>${o[1]}</option>`)
              .join("")}</select>`;
          } else {
            input = `<input name="${f.k}" data-testid="field-${f.k}" type="text" class="${inputCls}" value="${esc(val)}" placeholder="${esc(f.ph || "")}" ${f.required ? "required" : ""} />`;
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
  renderForm();
  renderList();
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
  // auto-unlock if previously authed this session
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
