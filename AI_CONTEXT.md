# AI_CONTEXT.md — Chelsy's Burger POS
> Single source of truth for all AI collaborators (Claude, Cursor, Copilot).
> Update after every feature, architecture change, or bug fix.
> Last updated: 2026-04-17

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
| `db:save(data)` | Renderer → Main | Replaces all 11 tables in one SQLite transaction |
| `db:getPath` | Main → Renderer | Returns absolute path to `.db` file |

### Data Flow
```
App boot → window.electronAPI.db.load() → mirrors full db in src/api/index.js
User action → API method mutates in-memory db → save(db) → IPC → SQLite transaction
```

### SQLite Tables (11)
```
users, ingredient_categories, ingredients, menu_items,
orders, purchase_orders, deliveries, stock_batches,
stock_logs, inventory_logs, saved_suppliers
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
- UI shows "Using stock from Shipment #XXXX" (plain English)
- `current_stock` always = `SUM(stockBatches where !isExhausted)`

### 4. POS ↔ Inventory Relationship
- Items WITH a recipe → POS auto-deducts countable ingredients on order
- Items WITHOUT a recipe → no stock check, no deduction
- Bulk/sauce ingredients → never in recipes, manual log only
- Staff can still open packs manually via Production Log anytime

### 5. Plain-English UX (important for non-technical staff)
| Technical term | User-facing label |
|---|---|
| FIFO batch | Stock Shipment |
| Loose pieces | Ready to Use |
| NEXT batch | USING NOW |
| Deducting from | Using stock from |
| open_pieces | (hidden, read-only info card) |

---

## API Surface (`src/api/index.js`)
All methods return Promises. Admin-only methods reject if `role !== 'admin'`.

```js
api.auth             → login(u,p), logout(), getUser()
api.orders           → list(), create(), update(), delete(),
                       checkStock(cartItems),
                       placeOrderAtomic(data)  ← USE THIS for POS
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
- Category filter tabs (pill-shaped, red active)
- Menu grid with emoji icons (auto by category + admin override)
- Cart: editable quantity (bulk input), discount, cash/GCash payment
- GCash requires reference number
- Receipt modal (print-friendly, shows emoji, payment, GCash ref)
- My Orders tab: today's orders, expandable rows, incident notes
- Stock shortage blocking modal with `[+ Open Pack]` quick restock

### Dashboard.jsx (Admin only)
- KPI cards: revenue, orders, avg order value
- Sales chart (Today / This Week) — Recharts
- Top selling items
- Inventory alert widget (low stock + expiry groups)
- Cashier summary per shift
- Voided orders excluded from all totals

### Orders.jsx
- Full order history (admin: all cashiers / cashier: today only)
- Search, filter by payment method, status, flagged
- Void orders (admin only, optional note)
- Voided rows: 50% opacity, excluded from revenue

### Products.jsx (Admin only)
- Menu Items tab: add/edit/delete, emoji picker, availability toggle
- Raw Ingredients tab: stock table with batches, expiry, status badges
- Recipes tab: define countable ingredients per menu item
- Activity Log tab: full inventory change history with filters

### ProductionLog.jsx (Cashier + Admin)
- Category filter tabs + section headers
- Tap-friendly ingredient cards
- "Open Pack" → confirm modal → FIFO batch deduction
- Batch rows condensed to single line (shipment · received→expiry · remaining/original)
- Low stock warning toast when hitting threshold

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

## Demo Seed (after "Reset & Load Demo Data" in Settings)
- 10 ingredients across all 3 types
- Ketchup pre-set to Low Stock, Spicy Sauce to Critical (0)
- 11 FIFO batches with varied expiry dates (Buns has 2 → FIFO visibly demoable)
- Pre-filled `open_pieces`: Buns 18, Cheese 12, Chicken 3
- 8 menu items: 4 burgers with recipes, Fries/Combo, Coke/Iced Tea (no recipes)
- 3 sample orders (2 today, 1 yesterday) for report screens

---

## Gotchas & Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `electron:dev` no window | Vite binding to IPv6 `[::1]`, wait-on probes `127.0.0.1` | Fixed: `--host 127.0.0.1` + `--dev` flag |
| `NODE_MODULE_VERSION mismatch` | better-sqlite3 compiled for system Node, not Electron ABI | Run `npm rebuild better-sqlite3` or `npx electron-rebuild -f -w better-sqlite3` |
| `node test.js` fails | better-sqlite3 compiled for Electron ABI (145) not system Node (127) | Expected — always test inside Electron |
| DB file not found | First run auto-creates it | Path: `C:\Users\<you>\AppData\Roaming\chelsys-burger\chelsys-burger.db` |
| Legacy JSON data | Old `chelsys-burger-data.json` in userData | Auto-migrated and renamed to `.migrated-to-sqlite.bak` on first run |
| Build chunk >500kB warning | No code-splitting yet | Known, acceptable — ignore |

---

## Known Gaps / Future Roadmap

| Priority | Feature | Status |
|---|---|---|
| High | Signed `.exe` installer via electron-builder | ⬜ |
| High | First-launch setup wizard (set admin password) | ⬜ |
| High | Order void → stock reversal (`reverseOrder()`) | ⬜ |
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
- [x] Piece-level stock tracking + FIFO batch visibility
- [x] Auto stock deduction on POS orders via recipes
- [x] Atomic order placement with snapshot rollback
- [x] GCash payment with reference number
- [x] Ingredient categories + Production Log grouping
- [x] Expiry date tracking per batch
- [x] Activity log (all inventory changes)
- [x] Supply chain (POs + deliveries + partial delivery completion)
- [x] Backup export/import + demo data reset

---

## Handoff Log
| Date | Change |
|---|---|
| 2026-04-17 | Plain-English rename pass across all UI files |
| 2026-04-17 | Ingredient type refactor — Beef Patty→pack-based, sauces→manual-only, Burger Box→piece-tracked |
| 2026-04-17 | Fresh demo seed with 10 ingredients, 11 FIFO batches, pre-filled open_pieces |
| 2026-04-17 | Inventory UX cleanup — read-only open_pieces, "Pieces" column, relabeled form fields |
| 2026-04-17 | Atomic order placement — placeOrderAtomic() replaces old create() pattern |
| 2026-04-17 | SQLite migration — database.cjs rewritten, 11 tables, auto-migration from JSON |
| 2026-04-17 | Fixed electron:dev — Vite binds to 127.0.0.1, Electron detects --dev flag |
| 2026-04-17 | Production Log UI cleanup — batch rows condensed, legend removed, stock preview simplified |

---

## GitHub
```
Repo:   https://github.com/sheleek1n/Sia2-Chelsys-burger
Branch: claude/pensive-banach
```