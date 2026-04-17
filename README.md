# Chelsy's Burger POS System

A point-of-sale and back-office management system for a single-branch fast food restaurant. Runs as a standalone desktop app on Windows via Electron, with all data stored locally in SQLite.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

---

## Setup

```bash
# 1. Clone the repository
git clone https://github.com/sheleek1n/Sia2-Chelsys-burger.git
cd Sia2-Chelsys-burger

# 2. Install dependencies (automatically rebuilds better-sqlite3 for Electron)
npm install

# 3. Launch the desktop app in dev mode (Vite + Electron with hot reload)
npm run electron:dev
```

> **Browser-only preview:** `npm run dev` still works at `http://localhost:5173`, but the SQLite layer is Electron-only — the browser build falls back to in-memory seed data with no persistence.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server in the browser only (no SQLite persistence) |
| `npm run electron:dev` | Launch the desktop app against the Vite dev server (hot reload) |
| `npm run build` | Build the renderer into `dist/` |
| `npm start` | Run Electron against the built `dist/` bundle |
| `npm run electron:build` | `npm run build` + launch Electron against the fresh build |
| `npm run preview` | Preview the production build in the browser |
| `npm run lint` | Run ESLint |

> **postinstall** runs `electron-rebuild` automatically for `better-sqlite3` after `npm install`.

---

## Default Accounts

| Role | Username | Password | Notes |
|---|---|---|---|
| Admin | `admin` | `admin123` | Session persists on restart |
| Cashier | `user` | `user123` | Session resets on close (by design) |

> Change passwords via the **Settings** page after logging in as admin.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Desktop Shell | Electron 41 | Native Windows app, IPC bridge to SQLite |
| Database | better-sqlite3 | Local SQLite DB in OS `userData` folder |
| Frontend | React 19 | Component-based UI |
| Styling | TailwindCSS 4 | Utility-first CSS |
| UI Primitives | Radix UI | Accessible headless components |
| Icons | Lucide React | Icon library |
| Charts | Recharts | Sales and revenue charts |
| State | Zustand | Cashier session store |
| Routing | React Router DOM 7 | HashRouter (required for Electron `file://`) |
| Toasts | Sonner | Success/error feedback |
| Dates | date-fns | Date formatting |
| Build Tool | Vite 7 | Dev server, HMR, bundling |
| Linting | ESLint 9 | Code quality |

---

## Architecture

```
Electron Desktop App
├── Main Process (electron/main.cjs)
│   ├── Creates BrowserWindow
│   ├── Loads Vite dev server in dev (--dev flag) or dist/index.html in prod
│   └── IPC handlers: db:load, db:save, db:getPath
│
├── Preload (electron/preload.cjs)
│   └── Exposes window.electronAPI.db to renderer via contextBridge
│
├── Database (electron/database.cjs)
│   ├── better-sqlite3, WAL mode, ACID transactions
│   ├── Auto-migrates from legacy chelsys-burger-data.json on first run
│   └── DB file: <userData>/chelsys-burger.db
│
└── Renderer (React App)
    └── src/api/index.js ← Single API layer — all reads/writes go here
```

### Key Design Decisions

1. **Single API layer.** `src/api/index.js` is the only module that reads/writes the persistent store. Components never touch the db directly.

2. **Three ingredient types.** Piece-tracked (buns, cheese → auto-deducts pieces per order), pack-based countable (beef patty → auto-deducts whole packs), and bulk/manual-only (sauces, fries → Production Log only, never POS-linked).

3. **Atomic order placement.** `placeOrderAtomic()` validates stock, applies order + all deductions in memory, then saves once as a single ACID SQLite transaction. Snapshot rollback on any failure.

4. **FIFO batch tracking.** Every delivery creates a batch row. Consumption depletes the oldest batch first. UI shows "Using stock from Shipment #XXXX."

5. **HashRouter, not BrowserRouter.** Required because Electron loads the renderer from `file://`.

6. **Local timezone dates.** All dates use the device's local time — Philippines business-day boundaries are correct.

---

## Project Structure

```
electron/
  main.cjs ................. Electron main process + IPC + dev/prod detection
  preload.cjs .............. contextBridge exposing electronAPI.db
  database.cjs ............. better-sqlite3 schema, load/save, JSON migration

src/
  api/
    index.js ............... ← ALL data operations go here
  components/
    dashboard/ ............. Dashboard widgets
    inventory/ ............. IngredientForm, category manager
    orders/ ................ OrderForm (POS cart), StockShortageModal, ReceiptModal
    shared/ ................ PageHeader, DeleteConfirmModal
    ui/ .................... Base UI (button, input, dialog, etc.)
  lib/
    AuthContext.jsx ........ Admin session provider
    useCashierStore.js ..... Zustand cashier session store
  pages/
    Dashboard.jsx .......... Sales KPIs, charts, alerts (admin only)
    CashierPOS.jsx ......... Order-taking, cart, receipt, shortage modal
    Orders.jsx ............. Order history, void management
    ProductionLog.jsx ...... "Open Pack" logging with FIFO batch view
    Products.jsx ........... Menu + inventory + recipes + activity log
    SupplyChain.jsx ........ Purchase orders + deliveries
    Settings.jsx ........... Admin accounts + backup + demo reset
    CashierEntry.jsx ....... Unified login screen
  utils/
    menuItemIcons.js ....... Emoji mappings for menu categories
  App.jsx .................. HashRouter + role-based auth wrapper
  Layout.jsx ............... Sidebar navigation (role-aware)
  pages.config.js .......... Page registry
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `electron:dev` shows Vite ready but no window | Check port 5173 is free. Script passes `--host 127.0.0.1` to fix IPv6 binding issue on Windows. |
| `NODE_MODULE_VERSION mismatch` | Run `npm rebuild better-sqlite3` or `npx electron-rebuild -f -w better-sqlite3` |
| `node test.js` fails with ABI error | Expected — better-sqlite3 is compiled for Electron's ABI, not system Node. Always test inside Electron. |
| DB file not found | Auto-created on first run at: `C:\Users\<you>\AppData\Roaming\chelsys-burger\chelsys-burger.db` |
| Old data from localStorage | Run **Settings → Reset & Load Demo Data** to wipe and reseed |
| Build chunk >500kB warning | Known and acceptable — no code-splitting yet |

---

## Recent Changes

- **Fixed `npm run electron:dev`** — Vite now binds to `127.0.0.1` so `wait-on` resolves on Windows; Electron picks up a `--dev` CLI flag to load the dev server instead of stale `dist/`.
- **Piece-level stock tracking** — ingredients have an optional `pieces_per_pack` field; POS auto-deducts pieces and auto-opens packs as needed via FIFO.
- **FIFO batch visibility** — Production Log and inventory table can expand to show each active shipment with received date, expiry, and remaining qty.
- **Atomic POS order placement** — `placeOrderAtomic()` validates and applies all stock mutations in a single SQLite transaction with snapshot rollback.
- **Auto stock deduction from POS** — placing an order with recipes attached now consumes countable ingredients automatically.
- **Tightened Production Log UI** — batch rows condensed, redundant legend removed, stock preview simplified.
- **SQLite migration** — fully migrated from localStorage/JSON to `better-sqlite3` with auto-migration from legacy JSON file.

---

## Roadmap

- [x] Electron desktop wrap
- [x] SQLite migration (better-sqlite3, WAL, ACID)
- [x] Piece-level stock tracking + FIFO batch visibility
- [x] Auto stock deduction on POS orders via recipes
- [x] Atomic order placement with snapshot rollback
- [x] GCash payment with reference number
- [x] Ingredient categories + Production Log grouping
- [x] Expiry date tracking per batch
- [x] Activity log (all inventory changes)
- [x] Supply chain (POs + deliveries + partial delivery completion)
- [x] Backup export/import + demo data reset
- [ ] Signed `.exe` installer via electron-builder
- [ ] Receipt printer + cash drawer integration
- [ ] First-launch setup wizard (admin password)
- [ ] Individual cashier accounts per person
- [ ] PDF report exports
- [ ] Order void → stock reversal