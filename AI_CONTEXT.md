# AI_CONTEXT.md — Chelsy's Burger POS

> Source of truth for multi-AI collaboration. Keep lean. Update after any feature/architecture/bug change.

## Project Overview
Chelsy's Burger POS is a single-branch fast-food POS + inventory system for a Filipino burger shop (owner: Kin). It runs as a desktop Electron app (crash-safe SQLite storage), with separate Cashier and Admin modes. Built for non-technical staff — all user-facing language is plain English, no jargon.

### Test Credentials (demo seed)
- **Admin**: `admin` / `admin123` (session persists across reloads)
- **Cashier**: `user` / `user123` ("Maria" — session-only, no persistence)

## Tech Stack & Tooling
- **Frontend**: React 19 + Vite 7, TailwindCSS 4, Radix UI primitives, `lucide-react` icons, `sonner` toasts, `recharts`, `react-router-dom` 7, `zustand` (cashier session), `date-fns`
- **Desktop shell**: Electron 41 (`main.cjs` + `preload.cjs`), `@electron/rebuild` for native module compilation
- **Persistence**: `better-sqlite3` (WAL mode, ACID transactions) — single file at `userData/chelsys-burger.db`. Falls back to `localStorage` in pure browser mode. Auto-migrates from legacy JSON file on first run.
- **Scripts**: `npm run dev` (Vite), `npm run electron:dev` (Vite + Electron), `npm run build`. `postinstall` runs `electron-rebuild` for `better-sqlite3`.

## System Architecture

### Folders
```
electron/         Electron main process, preload, SQLite layer
src/api/index.js  Single API layer — in-memory db mirror, save() via IPC
src/pages/        Route-level screens (Dashboard, CashierPOS, Products, ProductionLog, Orders, SupplyChain, Settings, Login)
src/components/   UI components (inventory/, orders/, shared/, ui/)
src/lib/          AuthContext, useCashierStore (zustand), helpers
```

### Data flow
1. Renderer loads once via `window.electronAPI.db.load()` → mirrors full db object in `src/api/index.js`
2. All API methods mutate the in-memory `db`, then call `save(db)` → IPC → `database.cjs` runs a single SQLite transaction (delete+insert across 11 tables)
3. Nested arrays (orders.items, menuItems.recipe) stored as JSON TEXT columns; dynamic delivery fields in `_extra` TEXT

### IPC contract (only 3 channels)
- `db:load` — returns the entire db object
- `db:save(data)` — replaces all tables in a single transaction
- `db:getPath` — returns absolute SQLite file path (for Settings display)

### SQLite tables (11)
`users`, `ingredient_categories`, `ingredients`, `menu_items`, `orders`, `purchase_orders`, `deliveries`, `stock_batches`, `stock_logs`, `inventory_logs`, `saved_suppliers`

### Key design patterns
- **Unified ingredients**: one source of truth for admin inventory & cashier Production Log
- **FIFO batches** (`stockBatches`): every delivery creates a batch row; consumption depletes oldest-received first
- **Three ingredient types**:
  - *Piece-tracked* (`pieces_per_pack > 1`): buns, cheese, chicken fillets, burger box → POS auto-deducts pieces, auto-opens packs as needed via `consumePieces()`
  - *Pack-based countable* (`pieces_per_pack` null/1): beef patty (1 per pack) → POS auto-deducts whole packs via `consume()`
  - *Bulk / manual-only* (no recipe entries): sauces, fries bag, paper wrap → deducted by owner in Production Log only, never POS-linked
- **Atomic order placement**: `orders.placeOrderAtomic()` builds a deduction plan, validates stock up front, applies order + all stock mutations in memory, then calls `save(db)` once → ACID via SQLite transaction. Snapshot rollback on any failure.
- **Plain-English UX**: "Ready to Use" (not "loose pieces"), "Stock Shipments" (not "FIFO batches"), "USING NOW" badge (not "NEXT"), "Using stock from" (not "Deducting from")

### API surface (src/api/index.js)
All methods return Promises. Admin-only methods check `getStoredUser().role === 'admin'` and reject otherwise.
- `api.auth` — `login(u,p)`, `logout()`, `getUser()`
- `api.orders` — `list()`, `create()`, `update()`, `delete()`, `checkStock(cartItems)`, **`placeOrderAtomic(data)` ← preferred for POS**
- `api.ingredients` — `list()`, `get()`, `create()`, `update()`, `delete()`, `consume()` (manual pack opening), `consumePieces()` (POS piece-level), `adjust()` (admin add/remove/set), `getExpiryStatus()`
- `api.ingredientCategories` — CRUD (admin only, except list)
- `api.menuItems` — CRUD with recipe support
- `api.purchaseOrders` / `api.deliveries` — Supply Chain workflow, auto-creates stock batches on receive
- `api.stockBatches` / `api.stockLogs` / `api.inventoryLogs` — read-only from UI
- `api.users` — admin user management
- `api.backup` — `exportAll()`, `importAll()`, `getStorageInfo()`, `resetDemoData()`

### Critical invariants
- `open_pieces < pieces_per_pack` always (otherwise a pack should have closed)
- `pieces_per_pack > 1` is the gate for piece-tracking in `consume()` (NOT `> 0` — avoids ghost pieces on ppp=1 items)
- `current_stock` always equals `SUM(stockBatches where ingredientId=X AND !isExhausted)` — recomputed via `recalculateStock()`
- Every `stockLogs` row carries `orderId` when originating from POS placement (field added for future traceability)

## Current State

### Working
- Cashier POS with atomic stock deduction (pieces + pack modes), stock shortage modal with quick-restock
- Production Log with batch/shipment expand, FIFO expiry-aware visual, pack-opening flow
- Admin Inventory table with "Pieces" column (total + ready-to-use breakdown) and shipment expand
- Full SQLite persistence with auto-migration from JSON
- Backup export/import (JSON)
- "Reset & Load Demo Data" button in Settings — wipes and reloads rich seed
- Purchase orders & deliveries (Supply Chain)
- Dashboard, Orders history, user management, GCash/cash payment methods

### Demo seed content (after "Reset & Load Demo Data")
- 10 ingredients spanning all 3 types — Ketchup pre-set to Low Stock, Spicy Sauce to Critical (0)
- 11 FIFO batches with varied expiry dates (Buns has 2 batches → FIFO visibly demoable)
- 8 menu items: 4 burgers with recipes, Fries/Combo, Coke/Iced Tea (no recipes)
- 3 sample orders (2 today, 1 yesterday) for report screens
- Pre-filled `open_pieces`: Buns 18, Cheese 12, Chicken 3 — "Pieces" column immediately interesting

### Known gaps / future work
- No order void/reversal path (deducts are one-way)
- Stock logs don't yet link to order IDs in UI reports (field exists)
- No low-stock *warning* at POS time (only hard shortage blocks)
- Recipe changes don't invalidate historical order-cost reports
- FIFO sorts by `receivedAt` only — not expiry-aware (FEFO not implemented)
- No multi-terminal concurrency protection (single-terminal assumption)

### Gotchas
- **`better-sqlite3` ABI**: compiled for Electron's Node ABI (145), NOT system Node (127). Plain `node test.js` will fail with "NODE_MODULE_VERSION mismatch" — this is expected. Always test inside Electron. `postinstall` rebuild is mandatory.
- **Windows paths**: use forward slashes or escaped backslashes in path strings; SQLite file lives at `app.getPath('userData')/chelsys-burger.db`
- **Auto-migration**: on first SQLite run, `database.cjs` reads any legacy `chelsys-burger-data.json` in userData and renames it to `.migrated-to-sqlite.bak` — idempotent, safe to re-run
- **Session state**: admin login persists in `localStorage`; cashier sessions do NOT (per design)
- **Chunk size warning** on build (>500kB) is known and acceptable — not code-splitting yet

## Future Roadmap
1. **FEFO** — sort batches by expiry first, then received date
2. **Order void → stock reversal** — new `reverseOrder()` API + UI in Orders page
3. **Low-stock soft warning** in POS when order would drop below reorder level
4. **Link stock_logs → order_id in UI** (column/filter in reports)
5. **Daily reconciliation report** — flag orders whose recipes didn't fully deduct
6. **Idempotency key** on order placement (double-click protection)

## Handoff Log
- **2026-04-17 (latest)**: Plain-English rename pass. "Loose" → "Ready", "FIFO/Batch" → "Shipment", "NEXT" → "USING NOW", "auto-opened" → "opened", "Deducting from" → "Using stock from". No code/semantic changes — UI text only across Products, ProductionLog, CashierPOS, IngredientForm, StockShortageModal, api checkStock.
- **2026-04-17**: Ingredient type refactor. Beef Patty demoted to pack-based countable (ppp null). Sauces/fries/wrap removed from all recipes — bulk items are now manual-only (Production Log), never POS-linked. Burger Box promoted to piece-tracked (ppp=50) and added to all burger recipes. Drinks have no recipes.
- **2026-04-17**: Fresh demo seed (`buildFreshSeed()`) with 10 ingredients, 11 FIFO batches, pre-filled `open_pieces`, low+critical scenarios, 8 menu items with proper recipes, 3 seed orders. New `api.backup.resetDemoData()` + red-zone button in Settings for one-click wipe+reseed.
- **2026-04-17**: Inventory UX cleanup. Removed editable `open_pieces` from IngredientForm (now read-only info card for piece-tracked items). Added "Pieces" column to Products inventory table showing total + "ready" breakdown. Relabeled form fields ("Unopened Packs in Storage", "Warn me when packs drop below…").
- **2026-04-17**: Atomic order placement. New `orders.placeOrderAtomic()` replaces previous `create()` + per-recipe-loop pattern. Snapshot-based rollback on any failure. `console.warn` swallowing replaced with surfaced toasts. Race-condition detection re-opens StockShortageModal. `stockLogs` now carry `orderId` for traceability.
- **2026-04-17**: Migrated from JSON file storage to SQLite3 (`better-sqlite3`). `electron/database.cjs` rewritten with 11 tables, auto-migration from `chelsys-burger-data.json`, WAL mode, clean shutdown on `will-quit`. Zero renderer-side changes — same IPC contract.
