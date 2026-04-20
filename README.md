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
| Admin | `admin` | `admin123` | Full access to all pages; session persists on restart |
| Cashier | `user` | `user123` | POS + My Orders only; session resets on close |

> Change passwords via the **Settings** page after logging in as admin.

---

## Features

### Admin (Dashboard, Orders, Inventory, Supply Chain, Settings)

- **Dashboard** — Daily/weekly sales KPIs, revenue chart, top-selling items, low-stock alerts, and a **projected stock runout** widget (estimates days remaining per ingredient based on the last 7 days of consumption).
- **POS / Cashier** — Cart-based order taking, GCash + cash payment, receipt modal, stock shortage warnings.
- **Orders** — Full order history with expandable rows (click any row to see itemised breakdown), void management with automatic stock reversal, incident note display.
- **Inventory (Products page)** — Menu items, ingredient management with three tracking types (piece-level, pack-counted, bulk/manual), FIFO batch visibility, activity log.
- **Production Log** — Manual "Open Pack" entries with FIFO batch source tracking and grouping by ingredient category.
- **Supply Chain** — Purchase orders, partial and multi-step deliveries (a PO can receive multiple short shipments until fully fulfilled), FIFO batch creation on completion.
- **Settings** — Admin account management, database backup export/import, and one-click **Reset & Load Demo Data**.

### Cashier

- **My Orders tab** — Cashiers see only their own orders for the current shift. Each row is expandable to show itemised details, payment method, and any incident note. Cashiers can add or edit incident notes directly from this tab.

### UX Details

- Password visibility toggle on all login screens (Admin Login and Cashier Entry).
- Exit confirmation dialog — the app prompts "Are you sure you want to exit?" before closing.
- Expandable order rows throughout the Orders page with inline item preview (first 2 items + "+ N more").

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
│   ├── Exit confirmation dialog (intercepts window close event)
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

5. **Multi-step partial deliveries.** `deliveries.completePartial()` allows unlimited completions per PO — a PO stays `partially_received` until all items are accounted for, so multiple short shipments are fully supported.

6. **HashRouter, not BrowserRouter.** Required because Electron loads the renderer from `file://`.

7. **Local timezone dates.** All dates use the device's local time — Philippines business-day boundaries are correct.

---

## Project Structure

```
electron/
  main.cjs ................. Electron main process + IPC + dev/prod detection + exit dialog
  preload.cjs .............. contextBridge exposing electronAPI.db
  database.cjs ............. better-sqlite3 schema, load/save, JSON migration

src/
  api/
    index.js ............... ← ALL data operations go here
  components/
    dashboard/ ............. Dashboard widgets (incl. ProjectedRunout)
    inventory/ ............. IngredientForm, category manager
    orders/ ................ OrderForm (POS cart), StockShortageModal, ReceiptModal
    shared/ ................ PageHeader, DeleteConfirmModal
    ui/ .................... Base UI (button, input, dialog, etc.)
  lib/
    AuthContext.jsx ........ Admin session provider
    useCashierStore.js ..... Zustand cashier session store
  pages/
    Dashboard.jsx .......... Sales KPIs, charts, alerts, runout forecast (admin only)
    CashierPOS.jsx ......... New Order tab + My Orders tab (cashier session only)
    Orders.jsx ............. Order history, expandable rows, void management
    ProductionLog.jsx ...... "Open Pack" logging with FIFO batch view
    Products.jsx ........... Menu + inventory + recipes + activity log
    SupplyChain.jsx ........ Purchase orders + multi-step deliveries
    Settings.jsx ........... Admin accounts + backup + demo reset
    Login.jsx .............. Admin login screen (with password toggle)
    CashierEntry.jsx ....... Cashier login screen (with password toggle)
  utils/
    menuItemIcons.js ....... Emoji mappings for menu categories
  App.jsx .................. HashRouter + role-based auth wrapper
  Layout.jsx ............... Sidebar navigation (role-aware)
  pages.config.js .......... Page registry
```

---

## Seed / Demo Data

Pressing **Settings → Reset & Load Demo Data** wipes the database and loads a realistic week's worth of data:

- **39 orders** spread across 7 days, placed by both `Admin User` (admin) and `Maria Santos` (cashier) in a realistic ratio.
- One order (`seed_ord_2`, today) has an incident note flagged with ⚠️ — visible in both the Orders page and the cashier's My Orders tab.
- **10 inventory log entries** covering deliveries, low-stock alerts, and manual adjustments — all with `previousValue` and `newValue` for a complete audit trail.
- **6 purchase orders** in various states (`pending`, `partially_received`, `received`, `cancelled`) to demonstrate the full supply chain flow.
- Multiple batches per ingredient to demonstrate FIFO consumption.

> Seed version is controlled by `SEED_VERSION` in `src/api/index.js`. Bumping the version triggers an automatic reseed on next launch.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `electron:dev` shows Vite ready but no window | Check port 5173 is free. Script passes `--host 127.0.0.1` to fix IPv6 binding issue on Windows. |
| `NODE_MODULE_VERSION mismatch` | Run `npm rebuild better-sqlite3` or `npx electron-rebuild -f -w better-sqlite3` |
| `node test.js` fails with ABI error | Expected — better-sqlite3 is compiled for Electron's ABI, not system Node. Always test inside Electron. |
| DB file not found | Auto-created on first run at: `C:\Users\<you>\AppData\Roaming\chelsys-burger\chelsys-burger.db` |
| Old data / missing demo content | Run **Settings → Reset & Load Demo Data** to wipe and reseed |
| Build chunk >500kB warning | Known and acceptable — no code-splitting yet |

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
- [x] Supply chain (POs + multi-step partial deliveries)
- [x] Backup export/import + demo data reset
- [x] Projected stock runout forecast (Dashboard)
- [x] Expandable order rows with inline item preview
- [x] Cashier "My Orders" tab with incident notes
- [x] Password visibility toggle on all login screens
- [x] Exit confirmation dialog
- [x] Order void with automatic stock reversal
- [ ] Signed `.exe` installer via electron-builder
- [ ] Receipt printer + cash drawer integration
- [ ] First-launch setup wizard (admin password)
- [ ] PDF report exports
