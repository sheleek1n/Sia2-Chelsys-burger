# AI_CONTEXT.md — Chelsy's Burger POS
> Single source of truth for all AI collaborators (Claude, Cursor, Copilot).
> Update after every feature, architecture change, or bug fix.
> Last updated: 2026-04-20 (session 4)

---

## Project Overview
Single-branch fast-food POS + inventory management system for a Filipino burger shop (owner: Kin).
Runs as a standalone **Electron desktop app** on Windows with all data stored locally in SQLite.
Built for non-technical staff — all UI language is plain English, no jargon.

### Credentials (demo seed)
| Role | Username | Password | Session |
|---|---|---|---|
| Admin | `admin` | `admin123` | Persists on restart |
| Cashier | `user` | `user123` | Resets on close (by design) |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Desktop Shell | Electron 41 (`main.cjs` + `preload.cjs`) | Native Windows app, IPC bridge |
| Database | `better-sqlite3` (WAL mode, ACID) | Local SQLite at `userData/chelsys-burger.db` |
| Frontend | React 19 + Vite 7 | Component UI + HMR dev server |
| Styling | TailwindCSS 4 (not strict) | Utility-first CSS |
| UI Primitives | Radix UI | Accessible headless components |
| Icons | `lucide-react` | Icon library |
| Toasts | `sonner` | Success/error feedback |
| Charts | `recharts` | Dashboard sales charts |
| State | `zustand` | Cashier session only |
| Routing | `react-router-dom` 7 (HashRouter) | HashRouter required for Electron `file://` |
| Dates | `date-fns` | Local timezone date formatting |
| Linting | ESLint 9 | Code quality |

### Scripts
```bash
npm run dev              # Vite browser-only (no SQLite — falls back to seed data)
npm run electron:dev     # Full desktop app: Vite + Electron with hot reload ← USE THIS
npm run build            # Build renderer into dist/
npm start                # Run Electron against built dist/
npm run electron:build   # Build + launch Electron against fresh build
npm run lint             # Run ESLint
```

> **postinstall** runs `electron-rebuild` automatically for `better-sqlite3` after `npm install`.

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
    ├── src/api/index.js ← SINGLE API LAYER — all reads/writes go here
    ├── src/pages/       ← Route-level screens
    ├── src/components/  ← UI components (inventory/, orders/, shared/, ui/)
    └── src/lib/         ← AuthContext, useCashierStore (zustand), helpers
```

### IPC Contract (only 3 channels)
| Channel | Direction | Purpose |
|---|---|---|
| `db:load` | Main → Renderer | Returns entire db object on boot |
| `db:save(data)` | Renderer → Main | Replaces all 12 tables in one SQLite transaction |
| `db:getPath` | Main → Renderer | Returns absolute path to `.db` file |

### Data Flow
```
App boot → window.electronAPI.db.load() → mirrors full db in src/api/index.js
User action → API method mutates in-memory db → save(db) → IPC → SQLite transaction
```

### SQLite Tables (12)
```
users, ingredient_categories, ingredients, menu_items,
orders, purchase_orders, deliveries, stock_batches,
stock_logs, inventory_logs, saved_suppliers, meta
```

> Nested arrays (`orders.items`, `menuItems.recipe`) stored as JSON TEXT columns.
> Dynamic delivery fields stored in `_extra` TEXT column.

---

## Project Structure

```
electron/
  main.cjs ................. Electron main process + IPC + dev/prod detection
  preload.cjs .............. contextBridge exposing electronAPI.db
  database.cjs ............. better-sqlite3 schema, load/save, JSON migration

src/
  api/
    index.js ............... ← ALL data operations go here. Never bypass this.
  components/
    dashboard/ ............. Dashboard widgets
    inventory/ ............. IngredientForm, category manager
    orders/ ................ OrderForm (POS cart + checkout), StockShortageModal
    shared/ ................ Reusable components (PageHeader, DeleteConfirmModal)
    ui/ .................... Base UI (button, input, dialog, etc.)
  lib/
    AuthContext.jsx ........ Admin session provider
    useCashierStore.js ..... Zustand cashier session store
  pages/
    Dashboard.jsx .......... Sales KPIs, charts, inventory alerts (admin only)
    CashierPOS.jsx ......... Order-taking, cart, receipt, stock shortage modal
    Orders.jsx ............. Full order history, void management
    ProductionLog.jsx ...... "Open Pack" logging with FIFO batch view
    Products.jsx ........... Menu items + inventory + recipes + activity log
    SupplyChain.jsx ........ Purchase orders + deliveries
    Settings.jsx ........... Admin accounts + backup + demo reset
    CashierEntry.jsx ....... Unified login (all users)
  utils/
    menuItemIcons.js ....... Emoji mappings for menu categories
  App.jsx .................. HashRouter + role-based auth wrapper
  Layout.jsx ............... Sidebar navigation (role-aware)
  pages.config.js .......... Page registry
```

---

## Roles & Permissions

### Access Matrix
| Feature | Admin | Cashier |
|---|:---:|:---:|
| POS / Place Orders | ✅ | ✅ |
| View Orders | ✅ | ✅ view only |
| Add Incident Note | ✅ | ✅ own orders |
| Void Orders | ✅ | ❌ |
| Dashboard & Reports | ✅ | ❌ |
| Products / Menu Mgmt | ✅ | ❌ |
| Raw Ingredients | ✅ | ❌ |
| Recipes | ✅ | ❌ |
| Activity Log | ✅ | ❌ |
| Production Log | ✅ | ✅ |
| Supply Chain | ✅ | ❌ |
| Settings & Backup | ✅ | ❌ |

### Session Behavior
- **Admin**: session persists in `localStorage` across restarts
- **Cashier**: session-only (Zustand), resets on close — by design

---

## Key Design Decisions

### 0. Seed Version Gate (Electron Boot)
- `SEED_VERSION = '7'` in `src/api/index.js`
- On Electron startup, `initElectronDb()` checks `fileData.meta.seed_version`
- If mismatch: app wipes stale persisted data and writes fresh seed
- If match: app loads existing SQLite data normally (preserves real work)
- Seed metadata is persisted in SQLite `meta` table (`electron/database.cjs`)

### 1. Three Ingredient Types
```
Piece-tracked    (pieces_per_pack > 1)
  Examples: Burger Buns, Cheese Slices, Chicken Fillets, Burger Box
  → POS auto-deducts pieces via consumePieces()
  → Auto-opens packs when open_pieces run out (FIFO)
  → Staff also logs in Production Log when physically opening packs

Pack-based countable  (pieces_per_pack null or 1)
  Examples: Beef Patty (1 per pack)
  → POS auto-deducts whole packs via consume()

Bulk / manual-only  (no recipe entries)
  Examples: Ketchup, Spicy Sauce, Mayonnaise, Fries, Paper Wrap
  → NEVER linked to POS orders
  → Staff logs manually via Production Log only
```

### 2. Atomic Order Placement
`orders.placeOrderAtomic()` — the only method to use for POS orders:
- Builds full deduction plan
- Validates stock upfront
- Applies order + all stock mutations in memory
- Calls `save(db)` once → single ACID SQLite transaction
- Snapshot rollback on any failure
- Race condition detection → re-opens StockShortageModal

### 3. FIFO Batch Tracking
- Every delivery creates a `StockBatch` row
- Consumption depletes oldest-received batch first
- UI shows "Using current restock • Expires Apr 22" (plain English)
- `current_stock` always = `SUM(stockBatches where !isExhausted)`

### 4. POS ↔ Inventory Relationship
- Items WITH a recipe → POS auto-deducts countable ingredients on order
- Items WITHOUT a recipe → no stock check, no deduction
- Bulk/sauce ingredients → never in recipes, manual log only
- Staff can still open packs manually via Production Log anytime

### 5. Plain-English UX (important for non-technical staff)
| Technical term | User-facing label |
|---|---|
| FIFO batch | Restock |
| Shipment | (deprecated — use Restock) |
| Batch ID | (hidden from UI) |
| Loose pieces | Ready to Use |
| NEXT batch | USING NOW |
| Deducting from | Using current restock |
| open_pieces | (hidden, read-only info card) |

---

## API Surface (`src/api/index.js`)
All methods return Promises. Admin-only methods reject if `role !== 'admin'`.

```js
api.auth             → login(u,p), logout(), getUser()
api.orders           → list(), create(), update(), delete(),
                       checkStock(cartItems),
                       placeOrderAtomic(data),  ← USE THIS for POS
                       voidWithReversal(orderId, { voidedBy, voidNote })  ← USE THIS for void
api.ingredients      → list(), get(), create(), update(), delete(),
                       consume(),              ← manual pack open
                       consumePieces(),        ← POS piece-level deduction
                       adjust(),               ← admin add/remove/set
                       getExpiryStatus()
api.ingredientCategories → CRUD (admin only except list)
api.menuItems        → CRUD with recipe support
api.recipes          → list(), getByMenuItem(), create(), update(), delete()
api.purchaseOrders   → Supply Chain workflow
api.deliveries       → receive(), completePartial(), list(), etc.
api.stockBatches     → list(), getActive(), getByIngredient() (read-only from UI)
api.stockLogs        → list() (read-only from UI)
api.inventoryLogs    → list(), clear() (read-only from UI except clear)
api.users            → admin user management
api.backup           → exportAll(), importAll(), getStorageInfo(), resetDemoData()
```

---

## Critical Invariants
- `open_pieces < pieces_per_pack` always (otherwise a pack should close)
- `pieces_per_pack > 1` gates piece-tracking — NOT `> 0` (avoids ghost pieces on ppp=1)
- `current_stock` always equals `SUM(stockBatches where ingredientId=X AND !isExhausted)`
- Every `stockLogs` row carries `orderId` when originating from POS placement
- Every `stockLogs` row carries `batchIds: string[]` when packs were consumed from FIFO batches
- `deductFIFO()` returns `{ batchId, qty, expiryDate }[]` — callers must capture and forward to logs
- **Void reversal**: piece-tracked ingredients add qty back to `open_pieces` (pack is already open); pack-based ingredients create a new "Void Reversal" `stockBatch` entry, then `recalculateStock()` syncs `current_stock`
- **Never call `orders.update(id, { status: 'voided' })` directly** — always use `orders.voidWithReversal()` to ensure stock is restored
- All data through `src/api/index.js` — never read/write db directly in components
- Admin-only methods must check `getStoredUser().role === 'admin'` and reject otherwise

---

## Key Data Shapes

```js
Order {
  id, order_number, createdAt, servedBy,
  items: [{ menuItemId, name, emoji, unitPrice, quantity, subtotal }],
  subtotal, discount, total,
  paymentMethod: "cash" | "gcash",
  gcash_reference: string | null,
  amountPaid, change,
  status: "completed" | "voided",
  incidentNote, voidNote, voidedAt, voidedBy
}

Ingredient {
  id, name, unit,
  current_stock, warning_level,
  cost_per_unit, supplier,
  expiry_date: string | null,
  categoryId,
  pieces_per_pack: number | null,  // >1 = piece-tracked, null/1 = pack-based
  open_pieces: number              // read-only, managed by system
}

StockBatch {
  id, ingredientId, ingredientName,
  quantity, originalQuantity,
  receivedAt, expiryDate,
  deliveryId, poNumber, supplier,
  isExhausted: boolean
}

Recipe {
  id, menuItemId, menuItemName,
  ingredients: [{ ingredientId, ingredientName, quantityPerServing, unit }]
  // Only countable ingredients — NO bulk/sauce items ever
}

PurchaseOrder {
  id, po_number, supplier,
  status: "pending"|"ordered"|"partially_received"|"received"|"cancelled",
  expectedDate, notes, totalCost,
  items: [{ ingredientId, ingredientName, quantityOrdered,
            quantityReceived, unitCost, expiry_date, discrepancy }],
  createdAt, receivedAt, receivedBy
}
```

---

## Pages & Features

### CashierPOS.jsx
- **Tab bar**: "New Order" (default) | "My Orders" — tab badge shows today's count
- **New Order tab**: full POS experience
  - Category filter tabs (pill-shaped, red active)
  - Menu grid with emoji icons (auto by category + admin override)
  - Dense auto-fit card grid for non-scrolling 1366x768 layout
  - In `All` view: cards arranged by category + compact per-card category tags
  - In `All` view: subtle category accent rails for faster scanning
  - Cart: editable quantity (bulk input), discount, cash/GCash payment
  - GCash requires reference number
  - Receipt modal (print-friendly, shows emoji, payment, GCash ref)
  - Stock shortage blocking modal with `[+ Open Pack]` quick restock
- **My Orders tab**: today's orders for the current cashier
  - Summary bar: count + total revenue
  - Accordion rows: click to expand → shows item table + payment info
  - Incident notes: displayed inline when present; `[Add / Edit Incident Note]` button opens modal
  - Note modal: textarea (200 char max), saves via `api.orders.update()`

### Dashboard.jsx (Admin only)
- KPI cards: revenue, orders, avg order value
- Sales chart (Today / This Week) — Recharts
- Top selling items
- Inventory alert widget (low stock + expiry groups)
- **Projected runout forecast** — calculates avg daily consumption (last 7 days from `stockLogs`), shows ingredients running out within 30 days sorted by urgency
- Cashier summary per shift
- Voided orders excluded from all totals

### Orders.jsx
- Full order history (admin: all cashiers / cashier: today only)
- Search, filter by payment method, status, flagged
- **Expandable rows**: clicking any row (or the chevron in the Order # cell) toggles an item-detail sub-row — shows item name, qty, unit price, subtotal per line
- Items column: truncated inline preview (first 2 items with emoji + qty), "+N more" suffix
- Void orders (admin only, optional note) — calls `voidWithReversal()`, restores stock, shows "Order X cancelled — stock restored" toast
- Voided rows: 50% opacity, excluded from revenue

### Products.jsx (Admin only)
- Menu Items tab: add/edit/delete, emoji picker, availability toggle
- Raw Ingredients tab: stock table with batches, expiry, status badges
- Recipes tab: define countable ingredients per menu item
- Activity Log tab: full inventory change history with filters

### ProductionLog.jsx (Cashier + Admin)
- Category filter tabs
- Tap-friendly ingredient cards
- "Open Pack" → confirm modal → FIFO batch deduction
- Batch rows condensed to single line (restock · received→expiry · left/original)
- Low stock warning toast when hitting threshold
- Dense auto-fit card grid for better small-screen fit
- In `All` view: cards arranged by category + compact per-card category tags
- In `All` view: subtle category accent rails for faster scanning
- Section headers removed from card area (category context comes from filter pills/tags)

### SupplyChain.jsx (Admin only)
- Purchase Orders: create, status flow (Pending → Ordered → Received)
- Receive Delivery: against PO or direct, expiry per item, discrepancy tracking
- Partial delivery → `PARTIALLY RECEIVED` → Complete Delivery later
- Delivery history with discrepancy badges and detail view

### Settings.jsx (Admin only)
- SQLite file path display
- Export/Import backup (JSON)
- Reset & Load Demo Data (one-click wipe + reseed)

---

## Coding Rules
1. All data through `src/api/index.js` — never read/write db directly in components
2. Zustand for global state — `useState` for UI-only state only
3. Role check in every admin-only component:
   ```jsx
   const { user } = useAuthStore()
   if (user?.role !== 'admin') return <Navigate to="/cashier-pos" replace />
   ```
4. Always use `placeOrderAtomic()` for POS orders — never `orders.create()` directly
5. Error messages always user-friendly — never raw JS errors shown to staff
6. No external API calls — fully offline app
7. Plain English in all UI text — no technical jargon for staff-facing labels
8. Number inputs must have `onFocus={(e) => e.target.select()}` for UX

---

## Demo Seed v6 (after "Reset & Load Demo Data" in Settings)
- 10 ingredients across all 3 types
- Ketchup pre-set to Low Stock, Spicy Sauce to Critical (0)
- **Beef Patty intentionally low** — `batch_beef_1` exhausted (qty=0), `batch_beef_2` qty=12/orig=16 → current_stock=12 → ~2 days left → **RED** runout card
- 11 FIFO batches with varied expiry dates (Buns has 2 → FIFO visibly demoable)
- Pre-filled `open_pieces`: Buns 18, Cheese 12, Chicken 3
- 8 menu items: 4 burgers with recipes, Fries/Combo, Coke/Iced Tea (no recipes)
- **39 sample orders** across 7 days (~₱1,500–1,800 revenue per day), including 1 voided for cancelled display testing
- 7 purchase orders: PO-0001 to PO-0006 received/partial + PO-0012 ordered (pending delivery)
  - PO-0006 (Chicken) = `partially_received` with -2 discrepancy — demos Supply Chain discrepancy flow
  - PO-0012 = `ordered` status with Spicy Sauce + Ketchup — demos urgent reorder
- 6 deliveries all cross-linked to POs and stock batches by ID (`purchaseOrderRefId = po.id`, `purchaseOrderId = po.po_number`)
- All stock batches consistent with `current_stock` + `open_pieces` per ingredient
  - Cheese: 7 received, 1 opened → batch qty=6, open_pieces=12 ✅
  - Buns: 2 batches (FIFO visible), 1 opened → open_pieces=18 ✅
  - Chicken: 2 POS auto-opens → batch qty=8/10, open_pieces=3 ✅
  - Spicy Sauce: exhausted batch (qty=0, isExhausted=true) — shows history in logs
- **35 `stockLogs` entries** (5 ingredients × 7 days) powering the Dashboard runout forecast widget:
  - Beef Patty: ~7/day → 12 left → **2 days → RED** card
  - Burger Buns: ~24 pieces/day → ~5 days → **ORANGE** card
  - Cheese Slices: ~12/day → ~11 days → **YELLOW** card
  - Chicken Fillets: ~8/day → ~10 days → **YELLOW** card
  - Burger Box: ~16/day → ~19 days → **YELLOW** card
- 11 inventory log entries covering deliveries, pack opens, low-stock + critical alerts
- 7 saved suppliers pre-filled

---

## Gotchas & Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `electron:dev` no window | Vite binding to IPv6 `[::1]`, wait-on probes `127.0.0.1` | Fixed: `--host 127.0.0.1` + `--dev` flag |
| `NODE_MODULE_VERSION mismatch` | better-sqlite3 compiled for system Node, not Electron ABI | Run `npm rebuild better-sqlite3` or `npx electron-rebuild -f -w better-sqlite3` |
| `node test.js` fails | better-sqlite3 compiled for Electron ABI (145) not system Node (127) | Expected — always test inside Electron |
| DB file not found | First run auto-creates it | Path: `C:\Users\<you>\AppData\Roaming\chelsys-burger\chelsys-burger.db` |
| Legacy JSON data | Old `chelsys-burger-data.json` in userData | Auto-migrated and renamed to `.migrated-to-sqlite.bak` on first run |
| Unexpected seed reset after update | Seed version mismatch on boot | Expected behavior of gate; set matching `meta.seed_version` or keep `SEED_VERSION` stable |
| UI frozen / can't click after closing dialog | Custom `Dialog` scroll-lock not cleared (body `overflow:hidden` stuck) | Fixed in `dialog.jsx` — double cleanup effect always resets body overflow |
| Dialog Cancel/Confirm buttons not visible | Buttons were inside scrollable div in `ReceiveDeliveryDialog` | Fixed — footer moved outside scroll wrapper, always pinned at bottom |
| Build chunk >500kB warning | No code-splitting yet | Known, acceptable — ignore |

---

## Known Gaps / Future Roadmap

| Priority | Feature | Status |
|---|---|---|
| High | Signed `.exe` installer via electron-builder | ⬜ |
| High | First-launch setup wizard (set admin password) | ⬜ |
| High | Order void → stock reversal (`voidWithReversal()`) | ✅ Done |
| Medium | FEFO — sort batches by expiry date first | ⬜ |
| Medium | Low-stock soft warning on POS (not hard block) | ⬜ |
| Medium | Individual cashier accounts per person | ⬜ |
| Medium | Receipt printer + cash drawer integration | ⬜ |
| Low | Stock logs → order ID link in UI reports | ⬜ |
| Low | Daily reconciliation report | ⬜ |
| Low | Idempotency key on order placement | ⬜ |
| Low | PDF report exports | ⬜ |
| Low | Session timeout for admin | ⬜ |

### Completed
- [x] Electron desktop wrap
- [x] SQLite migration (better-sqlite3, WAL, ACID)
- [x] SQLite `meta` table for persistent seed metadata
- [x] Piece-level stock tracking + FIFO batch visibility
- [x] Auto stock deduction on POS orders via recipes
- [x] Atomic order placement with snapshot rollback
- [x] GCash payment with reference number
- [x] Ingredient categories + Production Log grouping
- [x] Expiry date tracking per batch
- [x] Activity log (all inventory changes)
- [x] Supply chain (POs + deliveries + partial delivery completion)
- [x] Backup export/import + demo data reset
- [x] Seed version gate (`SEED_VERSION = '5'`) with auto-reset on stale persisted seed
- [x] Dense auto-fit card grids for POS + Inventory Log with enhanced `All` view scanning cues
- [x] Dialog body scroll-lock bug fixed — double `useEffect` cleanup ensures `overflow` always resets
- [x] SupplyChain `ReceiveDeliveryDialog` footer moved outside scroll area; stale `selectedPOId` cleared on close
- [x] **#1 Expiry per restock** — each `StockBatch` has `expiryDate`; delivery log details now include expiry inline
- [x] **#2 Delivery history with expiry** — `delivery_received` inventoryLog `details` field includes "expires {date}" — visible in Activity Log
- [x] **#3 Ingredient deduction on orders** — `placeOrderAtomic()` with FIFO batch deduction (was already done)
- [x] **#4 Stockout/low-stock logging** — `consumePieces()` and `placeOrderAtomic()` both emit `low_stock` inventoryLog at/below `warning_level` after POS deduction
- [x] **#5 Order-to-batch link** — `deductFIFO()` now returns consumed batch array; `stockLogs` rows include `batchIds: string[]` and `orderId`; SQLite `stock_logs` has `order_id` + `batch_ids` columns
- [x] **#6 Projected runout forecast** — Dashboard widget calculates avg daily consumption from `stockLogs` (last 7 days), displays card grid of ingredients running out within 30 days
- [x] **Void with stock reversal** — `orders.voidWithReversal()` reverses all ingredient deductions; piece-tracked → `open_pieces +=`, pack-based → new reversal `stockBatch` + `recalculateStock()`; `Orders.jsx` `handleVoid` wired to use it
- [x] **Seed v6** — 39 orders (7 days × ~5-7/day, ≈₱1,500–1,800/day revenue), 35 stockLogs entries, corrected PO delivery cross-refs (`purchaseOrderRefId = po.id`), Beef Patty stock set low for RED runout card demo
- [x] **`SEED_VERSION = '6'`** — bumped from 5; all stale persisted data auto-wiped on next Electron boot
- [x] **Cashier variety in seed** — seed orders now split between `'Maria'` (~22) and `'Admin User'` (~17); seed_ord_2 (Maria, today) has an `incidentNote` to demo the ⚠️ flag
- [x] **Expandable order rows in Orders.jsx** — clicking any row reveals per-line item detail (name, qty, unit price, subtotal); chevron indicator in Order # column
- [x] **`previousValue` in all seed inventory logs** — delivery logs now show "0 packs → 3 packs" style before/after in Activity Log; stale log_s7 (wrong action) removed; log_s9 "28 pcs" corrected to "16 pcs"
- [x] **Cashier "My Orders" tab** — tab bar added to CashierPOS; My Orders shows today's orders for the logged-in cashier; expandable rows + incident note add/edit modal
- [x] **`SEED_VERSION = '7'`** — bumped from 6; stale persisted data auto-wiped on next Electron boot

---

## Handoff Log
| Date | Change |
|---|---|
| 2026-04-20 | `consume()` API now rejects if `current_stock < qty` — prevents phantom open_pieces when stock is 0 |
| 2026-04-20 | Seed v4: all stock batches, POs, deliveries, and inventory logs fully cross-linked and self-consistent |
| 2026-04-20 | Dialog `overflow` scroll-lock bug fixed — double cleanup `useEffect` in `dialog.jsx` ensures body is always unblocked |
| 2026-04-20 | `ReceiveDeliveryDialog` footer (Cancel + Confirm) moved outside scrollable area — always visible regardless of content height |
| 2026-04-20 | Stale `selectedPOId` cleared on dialog close — prevents populate `useEffect` from re-firing after Cancel on Mark as Done |
| 2026-04-20 | Seed version gate + persistent SQLite `meta` table (`SEED_VERSION='5'`) |
| 2026-04-20 | #4 Stockout logging: `consumePieces()` + `placeOrderAtomic()` emit `low_stock` inventoryLog after POS deduction reaches/below warning level |
| 2026-04-20 | #5 Order-to-batch link: `deductFIFO()` returns consumed batches; `stockLogs.batchIds` + `stockLogs.orderId` fields; `stock_logs` SQLite columns `order_id`, `batch_ids` added |
| 2026-04-20 | Added SQLite startup backfill migration in `electron/database.cjs` for older DBs: auto-add missing `stock_logs.order_id` and `stock_logs.batch_ids` columns |
| 2026-04-20 | #1/#2 Expiry in delivery history: `delivery_received` log details now include "— expires {date}"; separate `expiry_added` log removed from `deliveries.receive()` and `deliveries.completePartial()` |
| 2026-04-20 | #6 Projected runout forecast widget added to Dashboard — avg daily rate from last 7 days stockLogs, cards sorted by urgency (red <2d, orange <5d, yellow <30d) |
| 2026-04-17 | Seed expanded for QA: voided order, PO/delivery discrepancy flow, suppliers, inventory logs |
| 2026-04-17 | POS + Inventory Log dense auto-fit grid refresh with `All` view card-level category cues |
| 2026-04-17 | Plain-English rename pass across all UI files |
| 2026-04-17 | Ingredient type refactor — Beef Patty→pack-based, sauces→manual-only, Burger Box→piece-tracked |
| 2026-04-17 | Fresh demo seed with 10 ingredients, 11 FIFO batches, pre-filled open_pieces |
| 2026-04-17 | Inventory UX cleanup — read-only open_pieces, "Pieces" column, relabeled form fields |
| 2026-04-17 | Atomic order placement — placeOrderAtomic() replaces old create() pattern |
| 2026-04-17 | SQLite migration — database.cjs rewritten, 11 tables, auto-migration from JSON |
| 2026-04-17 | Fixed electron:dev — Vite binds to 127.0.0.1, Electron detects --dev flag |
| 2026-04-17 | Production Log UI cleanup — batch rows condensed, legend removed, stock preview simplified |
| 2026-04-20 | Renamed "Shipment" → "Restock" across all user-facing UI; hid raw batch IDs (#ef_1) from display. Data layer untouched. |
| 2026-04-20 | `SEED_VERSION` bumped '5' → '6'; stale persisted seed auto-wiped on next Electron boot |
| 2026-04-20 | Seed v6: 39 orders across 7 days (≈₱1,500–1,800/day revenue); replaced sparse 4-order seed for realistic dashboard KPIs |
| 2026-04-20 | Seed v6: 35 stockLog entries (5 ingredients × 7 days) powering Dashboard runout forecast widget |
| 2026-04-20 | Seed v6: Beef Patty stock set low (batch_beef_1 exhausted, batch_beef_2 qty=12/orig=16, current_stock=12) → RED runout card (~2 days) |
| 2026-04-20 | Seed v6: All 6 delivery records corrected — `purchaseOrderRefId` now correctly set to `po.id` (internal ID), `purchaseOrderId` to `po.po_number` (display ref) |
| 2026-04-20 | `orders.voidWithReversal(orderId, { voidedBy, voidNote })` added — reverses all ingredient deductions from voided order; piece-tracked: `open_pieces +=`; pack-based: new reversal stockBatch + recalculateStock() |
| 2026-04-20 | `Orders.jsx` `handleVoid` wired to `voidWithReversal()` instead of bare `update()` — toast now says "Order X cancelled — stock restored" |
| 2026-04-20 | Seed v7: cashier variety added — orders now split between 'Maria' (~22) and 'Admin User' (~17); seed_ord_2 today carries an incidentNote for ⚠️ demo |
| 2026-04-20 | Seed v7: all 10 inventory logs updated with `previousValue` (before-state for deliveries, pack opens, low-stock); stale log_s7 (wrong action) removed; log_s9 details corrected (16 pcs, not 28) |
| 2026-04-20 | `Orders.jsx` expandable rows — click row or chevron to show per-line item detail sub-row; items column now shows inline preview (first 2 items + "+N more") |
| 2026-04-20 | `CashierPOS.jsx` "My Orders" tab — tab bar (New Order / My Orders), My Orders shows today's cashier orders, expandable accordion rows, incident note add/edit modal |
| 2026-04-20 | `SEED_VERSION` bumped '6' → '7' |
| 2026-04-20 | ESC hotkey added for modal dialogs only (`src/components/ui/dialog.jsx`): pressing Escape closes open dialogs; no global app-level Escape behavior added |
| 2026-04-20 | Compact UI pass: one-line compact headers (`PageHeader` compact mode) applied on Supply Chain, Products, Cashier POS, and Orders |
| 2026-04-20 | Supply Chain compact UX: dense/comfort toggle, collapsible PO filters, shorter status labels, condensed empty states, and expiry chip progressive disclosure (`+N more`) |
| 2026-04-20 | POS New Order change: payment panel notes are now hidden by default behind a `+ Add note` toggle (`src/components/orders/OrderForm.jsx`) |
| 2026-04-20 | ESC-close behavior expanded to non-Dialog custom modals (`ReceiptModal`, `StockShortageModal`, `DeleteConfirmModal`, Cashier incident note, ProductionLog confirm, SupplyChain suppliers, Settings user modal, Dashboard EOD modal) |

---

## GitHub
```
Repo:   https://github.com/sheleek1n/Sia2-Chelsys-burger
Branch: claude/pensive-banach
```
