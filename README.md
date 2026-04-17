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

> **Browser-only preview:** `npm run dev` still works at `http://localhost:5173`, but the SQLite layer is Electron-only — the browser build falls back to in-memory seed data.

---

## Available Scripts

| Command                  | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| `npm run dev`            | Vite dev server in the browser only (no SQLite persistence)          |
| `npm run electron:dev`   | Launch the desktop app against the Vite dev server (hot reload)      |
| `npm run build`          | Build the renderer into `dist/`                                      |
| `npm start`              | Run Electron against the built `dist/` bundle                        |
| `npm run electron:build` | `npm run build` + launch Electron against the fresh build            |
| `npm run preview`        | Preview the production build in the browser                          |
| `npm run lint`           | Run ESLint                                                           |

---

## Default Accounts

These are the seed accounts on first run. Change passwords via the **Accounts** page after logging in as admin.

| Role    | Username | Password |
| ------- | -------- | -------- |
| Admin   | admin    | admin123 |
| Cashier | user     | user123  |

---

## Tech Stack

| Layer            | Technology              | Purpose                                           |
| ---------------- | ----------------------- | ------------------------------------------------- |
| Desktop Shell    | Electron 41             | Native Windows app, IPC bridge to SQLite          |
| Data Storage     | better-sqlite3          | Local SQLite DB stored in the OS `userData` folder |
| UI Framework     | React 19                | Component-based user interface                    |
| Styling          | TailwindCSS 4           | Utility-first CSS                                 |
| Icons            | Lucide React            | Icon library                                      |
| Charts           | Recharts                | Sales and revenue charts on the dashboard         |
| State Management | Zustand                 | Cashier session store                             |
| Routing          | React Router DOM 7      | HashRouter (required for Electron `file://`)     |
| Notifications    | Sonner                  | Toast messages for success/error feedback         |
| Date Utilities   | date-fns                | Date formatting and comparisons                   |
| Build Tool       | Vite 7                  | Dev server, HMR, bundling                         |
| Linting          | ESLint 9                | Code quality and consistency                      |

---

## Architecture

```
Electron Desktop App
 |
 |-- Main Process (electron/main.cjs)
 |    |-- Creates the BrowserWindow
 |    |-- Loads Vite dev server in dev (--dev flag) or dist/index.html in prod
 |    |-- IPC handlers:  db:load, db:save, db:getPath
 |
 |-- Preload (electron/preload.cjs)
 |    |-- Exposes window.electronAPI.db to the renderer via contextBridge
 |
 |-- Database (electron/database.cjs)
 |    |-- better-sqlite3 with WAL mode
 |    |-- Auto-migrates from legacy chelsys-burger-data.json if present
 |    |-- DB file: <userData>/chelsys-burger.db
 |
 |-- Renderer (React App)
      |-- Pages
      |    |-- Dashboard .......... Sales KPIs, charts, alerts (admin only)
      |    |-- CashierPOS ......... Order-taking screen (cashier + admin)
      |    |-- Orders ............. Order history, void/refund management
      |    |-- ProductionLog ...... "Open Pack" logging with FIFO batch view
      |    |-- Products ........... Menu items + inventory management (admin only)
      |    |-- SupplyChain ........ Purchase orders + deliveries (admin only)
      |    |-- Settings ........... User account management (admin only)
      |
      |-- src/api/index.js        ** Single API layer **
           Every read/write goes through this file. It calls
           window.electronAPI.db when running in Electron, and falls
           back to seed data in the browser.
```

### Key Design Decisions

1. **POS and inventory remain decoupled by default.** Selling a burger does not blindly auto-deduct ingredients — but if a menu item has a **recipe**, the POS does call the stock consume API per recipe item after order creation. Staff can still open packs manually via the Production Log.

2. **Piece-level + batch-level tracking.** Ingredients support an optional `pieces_per_pack` value (e.g. 24 buns per pack). Incoming stock is recorded as **batches** with received/expiry dates, supplier, and PO number. Opening a pack consumes from the oldest batch first (FIFO) and is shown in the confirm modal as "Using stock from Shipment #xxxx".

3. **One API file for everything.** `src/api/index.js` is the only module that reads/writes the persistent store. The Electron DB swap was a single-file change.

4. **HashRouter, not BrowserRouter.** Required because Electron loads the renderer from `file://`, and BrowserRouter assumes server-side URL routing.

5. **Unified login, two roles.**
   - Admin: persistent session (survives app restart), access to all pages
   - Cashier: session-only login, limited to POS, Orders, and Production Log

6. **Local timezone dates.** All date recording uses the device's local time, not UTC — Philippines business-day boundaries are correct.

---

## Project Structure

```
electron/
  main.cjs ................. Electron main process + IPC
  preload.cjs .............. contextBridge exposing electronAPI.db
  database.cjs ............. better-sqlite3 schema, load/save, JSON migration

src/
  api/
    index.js ............... API layer (calls electronAPI.db, business logic)
  components/
    dashboard/ ............. Dashboard widgets
    inventory/ ............. IngredientForm, category manager
    orders/ ................ OrderForm (POS cart + checkout), ReceiptModal
    shared/ ................ Reusable components (PageHeader, MenuItemImage)
    ui/ .................... Base UI components (button, input, dialog, etc.)
  lib/
    AuthContext.jsx ........ Admin session provider
    useCashierStore.js ..... Zustand store for cashier session
  pages/
    Dashboard.jsx .......... Sales summary + inventory alerts
    CashierPOS.jsx ......... Order-taking interface (auto stock deduction via recipes)
    Orders.jsx ............. Order history with filters and void/refund
    ProductionLog.jsx ...... Pack logging with FIFO batch details + piece preview
    Products.jsx ........... Menu and inventory management
    SupplyChain.jsx ........ Purchase orders and deliveries
    Settings.jsx ........... Admin account management
    CashierEntry.jsx ....... Cashier quick sign-in
  utils/
    menuItemIcons.js ....... Emoji mappings for menu categories
  App.jsx .................. HashRouter + role-based auth wrapper
  Layout.jsx ............... Sidebar navigation
  pages.config.js .......... Page registry
  index.css ................ TailwindCSS + custom styles
```

---

## Recent Changes

- **Piece-level stock tracking** — ingredients have an optional `pieces_per_pack` field; Production Log shows both packs and pieces in the confirm modal, toast, and Today's Summary.
- **FIFO batch visibility** — Production Log cards can expand to show each active shipment (received date, expiry, remaining qty). The Confirm Modal highlights the exact batch a pack will be deducted from.
- **Auto stock deduction from POS** — placing an order with recipes attached now consumes ingredients automatically via `api.ingredients.consume()` with an `"Auto-deducted from POS order ..."` log note.
- **Tightened Production Log UI** — batch rows collapsed from 4 stacked lines to 1, redundant legend removed, confirm-modal stock preview condensed to a single row.
- **Fixed `npm run electron:dev`** — Vite now binds to `127.0.0.1` so `wait-on` resolves on Windows, and Electron picks up a `--dev` CLI flag to load the dev server instead of stale `dist/`.

---

## Troubleshooting

**`npm run electron:dev` shows Vite ready but no window opens**
Resolved in the current scripts. If it recurs, check that port 5173 is free and that Vite is binding to `127.0.0.1` (the script passes `--host 127.0.0.1`).

**`better-sqlite3` module version mismatch**
Run `npm rebuild better-sqlite3` or `npx electron-rebuild -f -w better-sqlite3`. The `postinstall` hook runs this automatically after `npm install`.

**Where is the database file?**
`electron/database.cjs` stores it in Electron's `userData` folder. The exact path is printed by the `db:getPath` IPC call, or visible under:
`C:\Users\<you>\AppData\Roaming\chelsys-burger\chelsys-burger.db`

---

## Future Roadmap

- [x] Wrap in Electron for a standalone desktop app
- [x] Migrate from localStorage to SQLite (via better-sqlite3)
- [x] Piece-level stock tracking and FIFO batch visibility
- [x] Auto stock deduction on POS orders via recipes
- [ ] Package a signed `.exe` installer with `electron-builder`
- [ ] Receipt printer and cash drawer integration
- [ ] PDF report exports
