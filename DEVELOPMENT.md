# SiberBoard — Developer Reference

Dokumen ini merangkum arsitektur teknis **SiberBoard** sesuai implementasi saat ini. Untuk panduan pengguna, lihat [README.md](README.md).

## Ringkasan

SiberBoard adalah editor workflow / flowchart berbasis browser dengan:

- kanvas node + edge,
- node flowchart berbentuk SVG,
- 4 port konektor per node,
- save/load JSON,
- export PNG,
- AI assistant server-side.

Runtime sekarang **tidak lagi client-side only**. Editor tetap berjalan di browser, tetapi AI assistant ditangani oleh server Node lokal.

## Fitur Teknis Saat Ini

- Canvas workflow dengan grid background.
- Node bisa ditambah dari panel kanan dengan palette kategori diagram umum.
- Shape library sekarang mencakup flowchart, BPMN, UML, ERD, network, UI, dan general blocks.
- Drag node, resize node, pan, zoom.
- 4 titik koneksi per node: `left`, `right`, `top`, `bottom`.
- Edge SVG cubic bezier dengan label.
- Edit label edge dan hapus edge.
- Edit label, deskripsi, dan icon node.
- Save / Load JSON.
- Export PNG background / transparent.
- Seed sample workflow saat boot.
- AI assistant untuk:
  - create node,
  - create edge,
  - update node,
  - delete node,
  - update edge,
  - delete edge,
  - auto-layout.

## Struktur Project

```text
.
├── .env.example
├── DEVELOPMENT.md
├── README.md
├── build.mjs
├── index.html
├── package.json
├── server.mjs
├── tailwind.config.cjs
└── src
    ├── bezier.js
    ├── constants.js
    ├── drag.js
    ├── input.css
    ├── main.js
    ├── state.js
    ├── viewport.js
    └── aiStreamParser.js
```

## Menjalankan Project

### Development

```bash
npm install
cp .env.example .env
npm run dev
```

Server akan jalan di `http://127.0.0.1:8000`.

### Build

```bash
npm run build
```

Build menghasilkan:

```text
dist/
├── index.html
├── app.js
└── styles.css
```

## Environment Variables

Contoh ada di [.env.example](.env.example):

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-chat

GROK_API_KEY=your_grok_api_key
GROK_MODEL=grok-build-0.1

HOST=127.0.0.1
PORT=8000
```

Catatan:

- `.env` dibaca saat `server.mjs` startup.
- setelah mengubah `.env`, restart `npm run dev`.

## Arsitektur Runtime

### Frontend

- [index.html](index.html)
  Struktur UI utama, canvas, panel node, panel edit, panel login AI, panel AI assistant, dan CSS global.

- [src/main.js](src/main.js)
  Entry point UI. Menangani render node, render/export edge, panel add/edit, edge actions, persistence, AI assistant UI, auto-layout, dan seed data.

- [src/state.js](src/state.js)
  Store in-memory sederhana untuk `nodes`, `edges`, dan `nextId`.

- [src/drag.js](src/drag.js)
  Drag node, resize, pan, dan manual connect antar port.

- [src/viewport.js](src/viewport.js)
  Transform kanvas: `panX`, `panY`, `zoom`.

- [src/bezier.js](src/bezier.js)
  Geometri port, path bezier, posisi label edge, dan render edge SVG.

- [src/constants.js](src/constants.js)
  Data statis node types, kategori, ukuran default, warna, dan icon choices.

### Backend

- [server.mjs](server.mjs)
  Server Node untuk:
  - serve file statis,
  - membaca `.env`,
  - pemanggilan provider AI (streaming),
  - validasi operasi AI.

- [src/aiStreamParser.js](src/aiStreamParser.js)
  Parser JSON parsial untuk streaming AI. Mengemit potongan `reply` dan
  operasi lengkap seiring token tiba dari provider.

## Data Model

### Node

Shape data node:

```js
{
  id,
  type,
  x,
  y,
  width,
  height,
  label,
  sub,
  icon
}
```

### Edge

Shape data edge:

```js
{
  from,
  to,
  label,
  fromSide,
  toSide
}
```

`fromSide` dan `toSide` sekarang mendukung:

- `left`
- `right`
- `top`
- `bottom`

## Sistem Port 4 Arah

Node sekarang selalu merender 4 port visual:

- kiri
- kanan
- atas
- bawah

Port:

- default hidden,
- muncul saat node di-hover,
- dapat dipakai untuk koneksi manual,
- disimpan ke edge sebagai `fromSide` / `toSide`.

`src/bezier.js` memakai sisi ini untuk menentukan:

- posisi start/end edge,
- arah control point bezier,
- titik label edge.

## AI Assistant

### Alur

AI assistant memakai **streaming SSE** sehingga canvas update selang-selah
selama model masih merespons — tidak menunggu seluruh respons selesai.

1. User klik tombol `AI Assistant`.
2. Panel assistant dibuka.
3. Frontend mengirim state kanvas + prompt ke `POST /api/ai/chat`.
4. Server membuka koneksi SSE (`text/event-stream`) dan mulai streaming dari
   provider AI dengan `stream: true`.
5. Token teks dari provider dilewatkan ke `IncrementalOperationParser`
   (`src/aiStreamParser.js`) yang mem-parsa JSON parsial secara inkremental:
   - setiap potongan nilai `"reply"` di-emit sebagai event `reply`,
   - setiap objek operasi yang closing-brace-nya sudah sampai divalidasi
     via `validateAiResponse` lalu di-emit sebagai event `operation`.
6. Frontend membaca stream dengan `response.body.getReader()`, menerapkan
   setiap operasi ke canvas begitu diterima
   (`applySingleAiOperation`), dan mengisi teks balasan assistant
   kata demi kata.
7. Saat stream selesai, server mengirim event `done`; frontend menjalankan
   auto-layout final (`finalizeAiStream`) bila perlu.

Selama stream, node dibuat memakai `x`/`y` dari AI (jika ada). Bila AI tidak
memberi koordinat, node akan stack di (0,0) sampai auto-layout final dijalankan
di event `done`.

### Endpoint auth

- `GET /api/auth/status`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Endpoint AI

- `POST /api/ai/chat` — mengembalikan `text/event-stream` dengan event:

| Event       | Data                                           | Arti                                       |
|-------------|------------------------------------------------|--------------------------------------------|
| `reply`     | `{"delta":"..."}`                              | Potongan teks balasan assistant            |
| `operation` | `{...validated op...}`                         | Satu operasi siap diterapkan ke canvas     |
| `done`      | `{"provider":"...","model":"...","usage":...}` | Stream selesai                             |
| `error`     | `{"error":"..."}`                              | Kegagalan (provider, parsing, dll.)        |

Route ini dapat dipakai tanpa session login.

### Modul streaming

- `src/aiStreamParser.js` — `createIncrementalOperationParser(validateOp)`:
  parser JSON parsial yang string-aware (menangani escape dan brace di dalam
  string). Memiliki helper `decodeJsonStringPartial` dan `findObjectEnd`.
- `server.mjs`:
  - `streamProvider(...)` — async generator yang memanggil provider dengan
    `stream: true` dan `yield` token teks. Mendukung DeepSeek/OpenAI
    (`/chat/completions`) dan OpenAI/Grok dengan gambar (`/responses`).
  - `readSseLines(response, onEvent)` — pembaca SSE dari `response.body`.
  - `makeAiStreamParser()` — adapter yang menempelkan `validateAiResponse`
    sebagai validator operasi.
  - `handleAiChat(req, res)` — SSE handler, mengirim event `reply` /
    `operation` / `done` / `error`. Mendeteksi client disconnect lewat
    `res.on('close')` (bukan `req.on('close')`).
- `src/main.js`:
  - `applySingleAiOperation(op, ctx, options)` — menerapkan satu operasi,
    render segera.
  - `finalizeAiStream(ctx, options)` — auto-layout final + persist.
  - `createAiStreamContext()` — state bersama antar operasi (termasuk `refMap`).
  - `consumeAiSseStream(body, handlers)` — reader SSE sisi client.
  - `createStreamingAssistantMessage()` — bubble pesan assistant yang teksnya
    bisa di-update inkremental.

### Operasi AI yang didukung

- `create_node`
- `create_edge`
- `update_node`
- `delete_node`
- `update_edge`
- `delete_edge`
- `auto_layout`

### Targeting node/edge existing

AI dapat menarget elemen existing lewat:

- `nodeId`
- `matchLabel`
- `fromNodeId` / `toNodeId`
- `fromMatchLabel` / `toMatchLabel`

### Side-aware edges

AI juga bisa mengirim:

- `fromSide`
- `toSide`

agar koneksi yang dibuat lebih sesuai dengan layout flowchart.

## Auto Layout

Setelah perubahan struktural graph, frontend dapat menjalankan `autoLayoutGraph()`.

Pendekatan saat ini:

- topological ordering,
- grouping per layer,
- sorting node dalam layer berdasarkan parent order,
- preferensi ringan untuk cabang `Tidak/No` di atas `Ya/Yes`,
- penempatan node dari kiri ke kanan dengan gap tetap.

Ini adalah auto-layout dasar. Crossing edge bisa berkurang, tetapi belum sepenuhnya hilang.

## Export PNG

Export PNG tidak memakai library eksternal. Alurnya:

1. State direkonstruksi jadi SVG.
2. SVG di-render ke `<canvas>`.
3. `canvas.toBlob()` dipakai untuk menyimpan PNG.

Pilihan:

- background gelap + grid
- transparent

## Build System

[build.mjs](build.mjs) melakukan:

1. hapus `dist/`
2. compile Tailwind → `dist/styles.css`
3. bundle `src/main.js` → `dist/app.js`
4. rewrite `index.html` untuk produksi
5. copy asset tambahan seperti `robots.txt` dan `sitemap.xml`

Tailwind config sekarang ada di [tailwind.config.cjs](tailwind.config.cjs).

`package.json` memakai `"type": "module"` karena runtime server dan source JS memakai ESM.

## Modul Penting

### `src/main.js`

Fungsi yang penting untuk dipahami:

- `createNodeElement(node)`
- `refreshNode(id)`
- `renderAllNodes()`
- `renderPicker(filter)`
- `initNodePanel()`
- `initNodeEditor()`
- `initEdgeActions()`
- `saveWorkflow()` / `loadWorkflow()`
- `exportImage()`
- `autoLayoutGraph()`
- `initAiAssistant()`
- `applyAiOperations(operations)`

### `src/state.js`

CRUD state tipis:

- `addNode`
- `updateNode`
- `removeNode`
- `moveNode`
- `resizeNode`
- `addEdge`
- `updateEdge`
- `removeEdge`
- `getNode`
- `getEdge`
- `replaceState`

### `src/drag.js`

Interaksi pointer:

- mode `node`
- mode `resize`
- mode `connect`
- mode `pan`

### `src/bezier.js`

Fungsi penting:

- `portXY(node, side)`
- `buildEdgePath(...)`
- `edgeLabelPoint(...)`
- `renderEdges()`

## Menambah Node Type Baru

Edit [src/constants.js](src/constants.js).

Contoh node biasa:

```js
browser: {
  label: 'Browser',
  sub: 'Web page canvas',
  cat: 'ui',
  shape: 'browser',
  hideIcon: true,
  width: 260,
  height: 170
}
```

Contoh node flowchart:

```js
umlClass: {
  label: 'Class',
  sub: 'Name, attributes, methods',
  cat: 'uml',
  shape: 'classBox',
  hideIcon: true,
  width: 240,
  height: 140
}
```

## Batasan Saat Ini

- Belum ada undo/redo.
- Belum ada multi-select.
- Auto-layout masih dasar.
- Edge routing masih bezier biasa, belum orthogonal routing penuh.
- Belum ada persistence backend/cloud.
