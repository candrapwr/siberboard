<div align="center">

# 🟦 SiberBoard

**Visual flow & flowchart builder ringan dengan AI assistant opsional.**

Rancang alur kerja, flowchart, dan diagram proses secara visual di browser: drag, sambung, simpan, ekspor, dan bantu generate lewat AI.

_Sebuah produk dari **Datasiber Lab** · `board.datasiber.com`_

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-styling-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![esbuild](https://img.shields.io/badge/esbuild-bundler-FFCF00?logo=esbuild&logoColor=black)](https://esbuild.github.io/)
[![AI](https://img.shields.io/badge/AI-optional-9F7AEA.svg)](#-ai-assistant)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#)
[![Status](https://img.shields.io/badge/status-aktif_maintained-success.svg)](#)
[![Stars](https://img.shields.io/github/stars/candrapwr/siberboard?style=social&label=Star)](https://github.com/candrapwr/siberboard/stargazers)

![UI Preview](ss.png)

</div>

---

## Apa itu SiberBoard?

SiberBoard adalah kanvas visual untuk membangun **workflow** dan **flowchart**. Anda bisa menambah node, menghubungkan konektor, memberi label, menyimpan board, ekspor PNG, dan memakai **AI assistant** untuk membuat atau merapikan diagram.

Cocok untuk:

- Membuat **flowchart** dan diagram proses.
- Merancang alur kerja / automasi secara visual.
- Menyusun diagram cepat untuk dokumentasi atau presentasi.

## Fitur

- 🧩 **Library node lebih luas** — General, Flowchart, BPMN, UML, ERD, Network, UI.
- 🔷 **Node flowchart dengan bentuk asli** — Start/End, Process, Decision, Input/Output, Document, Database, dan lainnya.
- 🔌 **4 titik konektor per node** — kiri, kanan, atas, bawah.
- 🏷️ **Label konektor** untuk cabang seperti `Ya` / `Tidak`.
- ✏️ **Edit node** — ubah label, deskripsi, dan icon.
- 🔍 **Pan & zoom** kanvas.
- 📐 **Resize node** dan edge akan ikut menyesuaikan.
- 🖼️ **Export PNG** — background gelap atau transparan.
- 💾 **Save & Load** board sebagai file JSON.
- 🧹 **Clear** untuk mengosongkan board.
- 🤖 **AI Assistant** — generate node, koneksi, edit node/edge, hapus elemen, dan auto-layout.

## Menjalankan SiberBoard

SiberBoard sekarang memakai server Node lokal untuk:

- menyajikan file statis,
- dan memanggil provider AI.

### Setup

```bash
npm install
cp .env.example .env
```

Isi `.env` sesuai kebutuhan:

```env
DEEPSEEK_API_KEY=...
OPENAI_API_KEY=...
GROK_API_KEY=...

OPENAI_MODEL=gpt-5.4-nano
```

### Development

```bash
npm run dev
```

Lalu buka <http://127.0.0.1:8000>.

> Setelah mengubah `.env`, restart `npm run dev` karena environment dibaca saat server startup.

### Build production

```bash
npm run build
```

Folder hasil build ada di `dist/`.

## Cara Pakai

### Menambah node

Klik tombol **➕** di kanan atas, cari node, lalu klik item yang diinginkan. Palette sekarang berisi kategori diagram umum yang lebih dekat ke gaya `app.diagrams.net`.

### Memindah & resize

Drag badan node untuk memindah. Hover node lalu tarik handle pojok kanan bawah untuk mengubah ukuran.

### Menghubungkan node

Hover node sampai titik konektor muncul, lalu tarik dari salah satu dari **4 port**: kiri, kanan, atas, atau bawah.

### Mengedit node

Klik tombol **✎** pada toolbar hover node, atau double-click node.

### Menghapus

- Node: tombol **🗑**
- Konektor: klik garis lalu pilih **Hapus**
- Semua: tombol **Clear**

### AI Assistant

Klik **AI Assistant** di kiri bawah.

- Anda bisa langsung meminta AI untuk:
  - membuat flowchart,
  - menghubungkan node,
  - mengubah label/deskripsi/icon,
  - menghapus node atau edge,
  - merapikan layout.

Contoh prompt:

```text
Buat flowchart pendaftaran siswa dari mulai, isi formulir, upload dokumen, validasi data, lalu bercabang ya/tidak.
```

```text
Ganti label node "Analisa Maksud" menjadi "Analisis Intent" lalu rapikan layout.
```

### Simpan & buka kembali

- **Save** — simpan board ke file JSON
- **Load** — buka kembali file JSON yang pernah disimpan

## Teknologi

- HTML statis + CSS inline di [index.html](index.html)
- JavaScript ES modules di [src](src)
- SVG untuk edge dan shape flowchart
- Node.js server lokal di [server.mjs](server.mjs)
- Tailwind CSS + esbuild saat build

## Catatan

- AI assistant memerlukan API key provider.
- Auto-layout saat ini masih dasar; hasilnya sudah lebih rapi, tapi belum setara engine graph layout penuh.

Ingin memahami implementasinya lebih detail? Lihat **[DEVELOPMENT.md](DEVELOPMENT.md)**.

---

## 📄 Lisensi

Dirilis di bawah **Lisensi MIT**. Lihat [LICENSE](./LICENSE).

Bebas dipakai, dimodifikasi, dan didistribusikan — termasuk untuk keperluan komersial.

---

<div align="center">

**SiberBoard** · Dibuat dengan ❤️ oleh **[dataSiberLab](https://datasiber.com)**
📧 [candrapwr@datasiber.com](mailto:candrapwr@datasiber.com) · 🌐 [datasiber.com](https://datasiber.com)

SiberBoard berguna? ⭐ Star repo-nya!

</div>

<!-- repo: siberboard · dataSiberLab · 2026 -->

<!-- updated: 2026-07-28T13:52:02Z -->
