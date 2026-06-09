<div align="center">

# 🟦 SiberBoard

**Visual flow & flowchart builder yang ringan, langsung jalan di browser.**

Rancang alur kerja, diagram proses, dan flowchart secara visual — drag, sambung, simpan, ekspor. Tanpa instalasi, tanpa akun.

_Sebuah produk dari **Datasiber Lab** · `board.datasiber.com`_

</div>

---

## Apa itu SiberBoard?

SiberBoard adalah kanvas visual untuk membangun **alur kerja (workflow)** dan **flowchart**. Tambahkan node dari panel, hubungkan lewat port, beri label, lalu simpan atau ekspor jadi gambar. Semua berjalan di sisi browser — cepat, privat, dan tanpa setup.

Cocok untuk:

- Membuat **flowchart** dan diagram proses.
- Merancang sketsa **alur kerja / automasi** secara visual.
- Membuat diagram cepat untuk dokumentasi atau presentasi.

## Fitur

- 🧩 **Banyak jenis node** — Triggers, Flow, Data, Integrations, AI, dan node kosong (Blank).
- 🔷 **Grup Flowchart dengan bentuk asli** — Start/End (terminator), Process, Decision (diamond), Input/Output (parallelogram), Document, Database, dan lainnya.
- 🔌 **Sambungkan node** lewat port input/output dengan garis kurva (bezier) yang rapi.
- 🏷️ **Label konektor** pada setiap garis untuk menandai cabang (mis. Yes / No).
- ✏️ **Edit cepat** label, deskripsi, dan icon node lewat panel editor.
- 🔍 **Pan & zoom** kanvas dengan mudah.
- 📐 **Resize node** sesuka hati; garis otomatis menyesuaikan.
- 🖼️ **Export PNG** — dengan background atau **transparan**.
- 💾 **Save & Load** board sebagai file JSON.
- 🧹 **Clear** untuk mengosongkan kanvas dalam sekali klik.

## Menjalankan SiberBoard

SiberBoard memakai ES modules, jadi jalankan lewat static server (bukan dibuka langsung sebagai file).

**Dengan Python:**

```bash
python3 -m http.server 8000
```

Lalu buka <http://localhost:8000>.

**Dengan Node.js:**

```bash
npx serve .
```

Buka URL yang ditampilkan terminal. Alternatif lain: ekstensi **Live Server** di editor Anda.

> Saat pertama dibuka, SiberBoard menampilkan **contoh flowchart** agar Anda langsung bisa bereksperimen.

## Cara Pakai

### Menambah node
Klik tombol **➕** di kanan atas → panel **Add node** muncul → cari/klik node → node ditaruh di tengah layar. Grup **Flowchart** ada di paling atas.

### Memindah & resize
Drag badan node untuk memindah. Hover node lalu tarik handle pojok kanan bawah untuk mengubah ukuran.

### Menghubungkan node
Tarik dari **port output** (kanan) node sumber, lepas di **port input** (kiri) node tujuan. Saat menarik, muncul preview garis.

### Memberi label garis
Klik garis konektor → pilih **Edit label** → isi teks (mis. `Yes` / `No`). Garis tanpa label tidak menampilkan chip.

### Mengedit node
Klik tombol **✎** pada toolbar hover, atau **double-click** node. Ubah label, deskripsi, atau icon. (Node flowchart tidak memakai icon — bentuknya yang jadi identitas.)

### Menghapus
- Node: tombol **🗑** pada toolbar hover node.
- Garis: klik garis → **Hapus**.
- Semua: tombol **Clear** di top bar (dengan konfirmasi).

### Navigasi kanvas
Drag area kosong untuk **pan**. Scroll untuk **zoom**. Tombol `+` / `−` / `⊡` untuk zoom in, zoom out, reset.

### Export gambar
Klik **Export PNG ▾** → pilih:
- **With background** — kanvas gelap + grid.
- **Transparent** — hanya node + garis (PNG transparan, pas untuk ditempel ke slide/dokumen).

### Simpan & buka kembali
- **Save** — menyimpan board ke file JSON (dialog native bila didukung browser, atau unduhan biasa).
- **Load** — membuka kembali file JSON yang pernah disimpan; node, garis, label, dan posisi kamera dipulihkan.

> Catatan: SiberBoard belum menyimpan otomatis. Gunakan **Save** sebelum menutup tab agar pekerjaan Anda tidak hilang.

## Teknologi

Murni front-end: HTML + JavaScript ES modules + Tailwind CSS (CDN) + SVG. Tanpa bundler, tanpa backend, tanpa build step.

Ingin berkontribusi atau memahami isi kodenya? Lihat **[DEVELOPMENT.md](DEVELOPMENT.md)**.

---

<div align="center">

**SiberBoard** · Datasiber Lab · [datasiber.com](https://datasiber.com)

</div>
