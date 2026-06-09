# SiberBoard — Developer Reference

Dokumen ini adalah rujukan teknis untuk pengembang yang mengerjakan **SiberBoard**, visual flow / flowchart builder berbasis browser dari **Datasiber Lab**. Untuk panduan pengguna, lihat [README.md](README.md).

SiberBoard dibangun tanpa bundler atau framework JavaScript, jadi struktur kodenya sengaja ringan dan mudah dibaca untuk eksperimen UI atau pengembangan editor visual yang lebih besar.

## Gambaran Umum

Fitur utama yang saat ini tersedia:

- Canvas workflow dengan grid background.
- Node workflow yang bisa ditambahkan dari panel kanan.
- **Grup node Flowchart** dengan bentuk shape asli (terminator, diamond, parallelogram, document, dll).
- Drag node pada canvas.
- Resize node dengan drag handle di pojok kanan bawah.
- Title dan description node wrap maksimal 2 baris.
- Pan canvas dengan drag area kosong.
- Zoom canvas dengan wheel dan tombol kontrol.
- Koneksi node lewat port input/output.
- Preview edge menggunakan SVG cubic bezier.
- Label connector opsional pada edge.
- Menu aksi edge untuk edit label dan hapus connector.
- Edit label, deskripsi, dan icon node dari panel editor.
- **Export workflow ke PNG** (dengan background atau transparan), direkonstruksi dari state.
- **Clear canvas** untuk mengosongkan seluruh board.
- Save UI workflow ke file JSON.
- Load UI workflow dari file JSON.
- Hapus node dari toolbar hover.
- Sample flowchart otomatis di-seed saat aplikasi pertama kali dibuka.

Project ini saat ini bersifat client-side only:

- Tidak ada backend.
- Penyimpanan memakai file JSON manual, bukan database.
- Tidak ada build step.
- Tidak ada test runner.

## Tujuan Project

Repository ini cocok untuk:

- Prototype visual workflow / flowchart editor.
- Eksperimen UI graph/canvas editor.
- Dasar pengembangan workflow builder yang lebih kompleks.
- Referensi implementasi editor node sederhana dengan JavaScript modular.

Repository ini belum cocok untuk production tanpa penambahan:

- persistensi state,
- validasi graph,
- aksesibilitas yang lebih baik,
- testing,
- data model yang lebih formal,
- dan pemisahan layer UI/state yang lebih tegas.

## Stack dan Pendekatan

- HTML statis di [index.html](index.html)
- JavaScript ES modules di folder [src](src)
- Tailwind CSS via CDN untuk utility classes
- CSS custom inline di `index.html` untuk layout, panel, edge, port, node shape, dan toolbar
- SVG untuk rendering edge **dan** bentuk node flowchart

Tidak ada dependency manager atau `package.json`. Browser modern yang mendukung ES modules sudah cukup.

## Struktur Project

```text
.
├── index.html
├── README.md          # panduan pengguna
├── DEVELOPMENT.md      # dokumen ini
└── src
    ├── bezier.js
    ├── constants.js
    ├── drag.js
    ├── main.js
    ├── state.js
    └── viewport.js
```

Penjelasan file:

- [index.html](index.html)
  Halaman utama, struktur UI, top bar (branding SiberBoard), panel kanan, zoom controls, dan CSS global termasuk style node shape & picker shape.

- [src/main.js](src/main.js)
  Entry point aplikasi. Mengatur inisialisasi, render node (rect & shaped), panel add/edit, aksi node, edge deletion, zoom controls, export PNG, clear, dan seed sample flowchart.

- [src/state.js](src/state.js)
  Store in-memory sederhana untuk `nodes`, `edges`, dan `nextId`, beserta operasi CRUD dasarnya.

- [src/drag.js](src/drag.js)
  Menangani interaksi mouse/touch untuk drag node, pan canvas, dan connect antarport.

- [src/viewport.js](src/viewport.js)
  Menangani transform canvas: `panX`, `panY`, `zoom`, konversi screen-to-world, serta sinkronisasi grid background.

- [src/bezier.js](src/bezier.js)
  Menghitung posisi port, membangun path cubic bezier, dan merender seluruh edge ke SVG layer.

- [src/constants.js](src/constants.js)
  Konstanta ukuran node, kategori node, warna kategori, pilihan icon, dan definisi `NODE_TYPES` (termasuk properti `shape` untuk node flowchart).

## Cara Menjalankan

Karena project memakai ES modules, jangan buka file langsung lewat `file://`. Jalankan dengan static server.

### Opsi 1: Python

```bash
cd /path/to/siberboard
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

### Opsi 2: NPX

```bash
cd /path/to/siberboard
npx serve .
# atau: npx http-server
```

Alternatif: pakai Live Server dari editor Anda.

Saat dev, **tidak ada build** — edit `src/` langsung lalu refresh. Setiap perubahan `main.js` perlu bump query `?v=N` pada tag `<script>` di `index.html` untuk bust cache browser.

## Build untuk Production

Runtime tetap **100% statis**; Node hanya dipakai saat build. Build menghasilkan folder `dist/` yang siap di-deploy ke `board.datasiber.com`.

Yang dilakukan build ([build.mjs](build.mjs)):

1. **Tailwind CLI** meng-compile hanya class yang dipakai (scan `index.html` + `src/**/*.js`) → `dist/styles.css` (minified). Menghilangkan ketergantungan `cdn.tailwindcss.com`.
2. **esbuild** mem-bundle + minify seluruh ES modules (`src/main.js` + impornya) → `dist/app.js`.
3. Menghasilkan `dist/index.html`: tag CDN diganti `<link>` ke `styles.css`, entry `src/main.js?v=N` diganti `app.js`. Blok `<style>` inline tetap dipertahankan.
4. Menambahkan **content-hash** ke query tiap asset (`styles.css?v=<hash>`, `app.js?v=<hash>`). Hash hanya berubah saat isi file berubah, sehingga cache browser otomatis bust ketika ada update tetapi tetap dipakai bila tak ada perubahan.

```bash
npm install      # sekali saja (esbuild + tailwindcss, devDependencies)
npm run build    # menghasilkan dist/
```

Lalu deploy isi `dist/` saja:

```
dist/
├── index.html
├── app.js       # bundled + minified
└── styles.css   # tailwind ter-compile + minified
```

Catatan:

- `src/` tetap menjadi **source of truth** untuk pengembangan; `dist/` adalah artefak build (di-ignore git).
- Tailwind di-config men-scan `src/**/*.js` (lihat [tailwind.config.js](tailwind.config.js)) karena banyak class digenerate di template string JS. Jika menambah class via string yang **tidak literal** (mis. dirakit dari potongan), pastikan nama class utuhnya tetap muncul sebagai teks agar tidak ter-purge.
- `package.json` & tooling Node hanya untuk **build-time**; halaman yang disajikan ke browser tidak memuatnya.

## Arsitektur Interaksi

### Layer tampilan

Canvas utama memakai dua layer yang hidup di dalam `#viewport`:

- layer DOM untuk node
- layer SVG (`#edgeLayer`) untuk edge

Keduanya ikut menerima transform `translate(...) scale(...)` dari `viewport.js`.

### Koordinat world

Posisi node dan edge disimpan dalam koordinat world, bukan hasil pengukuran DOM. Ini penting karena:

- edge tetap akurat saat zoom,
- drag node tidak bergantung pada bounding box DOM,
- dan konversi screen-to-world tetap konsisten.

### State management

State disimpan sebagai object sederhana:

```js
{
  nodes: [],
  edges: [],
  nextId: 1
}
```

Setiap node memiliki bentuk:

```js
{ id, type, x, y, width, height, label, sub, icon }
```

- `label`, `sub`, dan `icon` boleh `null`. Bila `null`, UI fallback ke default dari `NODE_TYPES`.

Setiap edge memiliki bentuk:

```js
{ from, to, label }
```

## Sistem Node & Shape

Picker dan rendering node **sepenuhnya data-driven** dari `NODE_CATEGORIES` + `NODE_TYPES` di [src/constants.js](src/constants.js). Menambah kategori/jenis node baru tidak perlu menyentuh `main.js`.

### Kategori node

`NODE_CATEGORIES` menentukan urutan grup di picker dan warna aksen tiap node. Urutan saat ini: **Flowchart** (paling atas), Blank, Triggers, Flow, Data & Code, Integrations, AI.

### Node flowchart (bentuk shape)

Node dengan `cat: 'flowchart'` punya dua perilaku khusus:

1. **Tanpa emoji icon** — identitasnya dibawa oleh bentuk shape, bukan icon. Diatur lewat flag `noIcon = info.cat === 'flowchart'` di `createNodeElement`.
2. **Bentuk shape** — ditentukan properti `shape` pada `NODE_TYPES`, dipetakan ke markup SVG di konstanta `SHAPE_SVG` (di `main.js`).

`SHAPE_SVG` digambar dalam kotak `0..100` lalu di-stretch ke ukuran node lewat `<svg viewBox="0 0 100 100" preserveAspectRatio="none">`. `vector-effect: non-scaling-stroke` (CSS) menjaga ketebalan garis tetap rata walau node di-resize. Karena `width/height: 100%`, shape **otomatis ikut resize & zoom** tanpa kode tambahan.

Shape yang tersedia: `terminator`, `diamond`, `parallelogram`, `hexagon`, `manualOp`, `manualInput`, `offpage`, `circle`, `document`, `delay`, `display`, `cylinder`, `subroutine`. Node flowchart tanpa `shape` (mis. `fcProcess`) dirender sebagai persegi membulat biasa, tetap tanpa icon.

> Catatan: properti `icon` masih didefinisikan di node flowchart pada `constants.js`, tetapi **tidak dirender** (canvas tanpa icon, picker memakai preview shape). Dibiarkan sebagai fallback/dokumentasi.

### Shape layer & interaksi

Shape SVG diberi `pointer-events: none` (CSS `.node-shape`), sehingga semua interaksi (drag, connect port, resize, edit, hapus) tetap tembus ke elemen node seperti node biasa. Port & edge tetap nyangkut di tengah sisi kiri/kanan node (`inputXY`/`outputXY`), dan titik kiri/kanan mayoritas shape memang di tengah-vertikal, sehingga edge tetap rapi.

> Penting: node container **tidak** memakai `overflow-hidden`. Toolbar hover (edit/hapus) diposisikan `bottom: 100%` (di atas node); `overflow-hidden` akan meng-clip-nya. Truncate judul/deskripsi tetap jalan karena `.line-clamp-2` punya `overflow: hidden` sendiri.

## Modul Secara Detail

### `src/main.js`

Tanggung jawab utama: membuat elemen DOM node, render shape flowchart, picker, panel add/edit, menu aksi edge, export PNG, clear, save/load JSON, dan seed sample.

Fungsi penting:

- `createNodeElement(node)` — membuat DOM node. Bercabang berdasarkan `shape` (rect vs shaped) dan `noIcon` (flowchart vs lainnya).
- `refreshNode(id)` — sinkronkan tampilan node setelah edit. Guard `if (iconEl)` agar aman untuk node tanpa icon.
- `spawnNode(type, x, y)` / `addNodeAtCenter(type)` — menambah node ke state lalu ke DOM.
- `renderPicker(filter)` — daftar node per kategori + search. Untuk kategori `flowchart` menampilkan **preview shape mini** (`.picker-shape`) menggantikan emoji; node tanpa shape memakai `PICKER_RECT`.
- `showPanel(which)` — menjaga hanya satu side panel aktif (`'add' | 'edit' | null`).
- `openEditor(id)` — isi panel editor. Menyembunyikan baris Icon (`#iconEditRow`) untuk node flowchart.
- `initEdgeActions()` — popup edit label & hapus edge.
- **Export image:**
  - `escapeXml(value)` / `wrapLines(text, maxChars, maxLines)` — util teks SVG.
  - `nodeSvg(node)` / `edgesSvg()` — merekonstruksi node & edge sebagai SVG.
  - `buildWorkflowSvg(transparent)` — membangun SVG penuh dari state; bounding box semua node + padding. Bila `transparent`, background gelap + grid di-skip.
  - `svgToPngBlob(svg, w, h, scale)` — rasterize SVG → PNG via `Image` + `canvas` (`scale` default 2×). Tanpa resource eksternal → canvas tidak ter-taint → `toBlob` aman.
  - `exportImage(transparent)` — simpan PNG (File System Access API bila ada, fallback download). Nama transparan diberi sufiks `-transparent`.
  - `initExportMenu()` — dropdown tombol Export (`#exportMenu`) untuk memilih with background / transparent.
- `clearWorkflow()` — konfirmasi, lalu `replaceState({ nodes: [], edges: [], nextId: 1 })` + re-render.
- `snapshotWorkflow()` / `saveWorkflow()` / `loadWorkflow()` — export/import file JSON UI.
- `seedSampleWorkflow()` — seed contoh flowchart sederhana Bahasa Indonesia (Mulai → Input Nilai → Nilai ≥ 70? → Ya: Lulus / Tidak: Tidak Lulus → Selesai).

### `src/state.js`

State layer tipis & sinkron:

- `addNode`, `updateNode`, `removeNode`, `moveNode`, `resizeNode`
- `addEdge`, `removeEdge`, `updateEdge`, `getEdge`
- `getNode`, `getState`, `replaceState`

Catatan implementasi:

- `addEdge()` menolak self-loop dan edge duplikat.
- edge menyimpan `label` string yang default-nya kosong.
- `removeNode()` sekaligus menghapus edge yang terhubung.
- `replaceState(next)` me-rebuild nodes/edges & menghitung `nextId` (dipakai load dan clear).

### `src/drag.js`

Mode interaksi pointer: `node` (drag), `resize`, `connect`, `pan`.

- klik pada `.node-toolbar` tidak memicu drag.
- klik pada `.ui-chrome` tidak memicu pan.
- node dideteksi via `closest('.node[data-node-id]')`, port via `closest('.output-port, .input-port')` — tetap bekerja meski ada shape layer (karena `pointer-events: none`).
- koneksi sementara dirender sebagai `.temp-edge`.
- touch event diterjemahkan menjadi mouse event agar jalur logika tunggal.

### `src/viewport.js`

State viewport global `{ panX, panY, zoom }`.

- `applyTransform()`, `screenToWorld(clientX, clientY)`, `zoomBy(factor)`, `resetView()`.
- grid background disinkronkan dengan pan & zoom.

### `src/bezier.js`

Utilitas render edge:

- `outputXY(node)` / `inputXY(node)` — posisi port (world coords).
- `cubicBezierPoints(...)` / `buildEdgePath(...)` / `edgeLabelPoint(...)`.
- `renderEdges()` — render semua edge dari state.

Posisi port dihitung dari ukuran node di state, bukan pengukuran DOM runtime — lebih stabil terhadap zoom/pan. Fungsi `outputXY`/`inputXY`/`buildEdgePath`/`edgeLabelPoint` juga di-reuse oleh export image di `main.js`.

### `src/constants.js`

Data statis aplikasi:

- `NODE_WIDTH`, `NODE_HEIGHT`, `MIN_NODE_WIDTH`, `MIN_NODE_HEIGHT`
- `NODE_CATEGORIES` (termasuk kategori `flowchart`, warna `#06b6d4`)
- `ICON_CHOICES`
- `CATEGORY_COLOR` (diturunkan dari `NODE_CATEGORIES`)
- `NODE_TYPES` (dengan properti opsional `shape`)

## Menambah Node Type Baru

Edit [src/constants.js](src/constants.js).

Node biasa (dengan icon):

```js
crm: {
  label: 'CRM Sync',
  sub: 'Push contact data',
  icon: '📇',
  cat: 'integration',
  ports: ['in', 'out']
}
```

Node flowchart (dengan shape, tanpa icon):

```js
fcPredefined: {
  label: 'Predefined',
  sub: 'Reusable block',
  cat: 'flowchart',
  ports: ['in', 'out'],
  shape: 'subroutine'   // salah satu key di SHAPE_SVG
}
```

Pastikan:

- `cat` cocok dengan salah satu id di `NODE_CATEGORIES`.
- `ports` hanya memakai `'in'` dan/atau `'out'`.
- Untuk shape baru, tambahkan markup di `SHAPE_SVG` (`main.js`) memakai class `node-shape-path` / `node-shape-line` di koordinat `0..100`.

## Menambah Shape Flowchart Baru

1. Tambahkan entri di `SHAPE_SVG` (`main.js`), mis. `polygon`/`path`/`ellipse` di kotak `0..100` dengan class `node-shape-path` (terisi) dan/atau `node-shape-line` (garis saja).
2. Referensikan key-nya pada `shape` di `NODE_TYPES`.
3. (Opsional) tambahkan padding khusus di CSS `index.html` (`.node[data-shape="..."] .node-body`) bila bentuknya runcing/sempit agar teks tetap terbaca.

Shape otomatis muncul di canvas dan sebagai preview di picker.

## Batasan Saat Ini

- State tidak auto-save saat reload jika belum disimpan manual ke file.
- Tidak ada sinkronisasi backend/cloud.
- Tidak ada undo/redo.
- Tidak ada multi-select node.
- Tidak ada keyboard shortcuts.
- Tidak ada validasi graph tingkat lanjut.
- Tidak ada minimap.
- Tidak ada snapping / alignment guides.
- Routing edge hanya bezier sederhana (edge mundur kanan→kiri bisa melengkung lebar).
- Label edge panjang dibatasi agar rapi.
- Export image merekonstruksi teks dengan word-wrap sederhana (perkiraan, bukan replika persis layout DOM).
- Tidak ada test otomatis.
- Tidak ada pemisahan tegas antara domain model dan DOM renderer.

## Saran Pengembangan Lanjutan

1. **Persistence tingkat lanjut** — autosave ke `localStorage`, atau sinkron ke backend/cloud.
2. **Pisahkan renderer dari state mutations** — memudahkan undo/redo & testing.
3. **Export SVG** (vektor) selain PNG.
4. **Keyboard support** — `Delete`, `Esc`, `Cmd/Ctrl + Z`, shortcut add node.
5. **Test** — minimal unit test untuk `state.js`, `bezier.js`, `viewport.js`.
6. **Selection model** — selected node, focus ring, action berbasis selection.
7. **Validasi graph** — batasi input trigger, deteksi orphan / alur tidak valid.
8. **Fit-to-content view** saat seed/load agar seluruh board langsung terlihat.

## Catatan untuk Developer

- Sebagian besar interaksi bergantung pada DOM query langsung dan event delegation; tanpa framework, konsistensi state↔DOM dijaga manual.
- `renderEdges()` dipanggil cukup sering selama drag. Jika graph membesar, pertimbangkan optimasi render.
- `showPanel(which)` adalah titik kontrol side panel. Tambah panel baru dimulai dari sini.
- `createNodeElement` punya tiga jalur layout: rect+icon (default), shaped+icon (tak terpakai saat ini, disiapkan untuk generalisasi), dan no-icon (flowchart). Perubahan tampilan node mulai dari sini.
- Save/load berfokus pada file JSON UI; validasi schema akan penting bila format berkembang.
- Saat **dev**, setiap perubahan `main.js` perlu bump query `?v=N` pada tag `<script>` di `index.html` untuk bust cache browser. Di **production** ini tidak relevan — file di-bundle jadi `dist/app.js` oleh build (lihat [Build untuk Production](#build-untuk-production)); atur cache lewat header server.
