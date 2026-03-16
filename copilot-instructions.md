# Copilot Instructions — Chelsy's Burger POS System

## About This Project
This is **Chelsy's Burger** — a single-branch fast food **POS and Restaurant Management System**
built as a web app first, then wrapped in Electron for desktop later.

**Stack:** React 19 + Vite + TailwindCSS + Zustand + React Router DOM
**Database (web phase):** localStorage via `src/api/index.js`
**Database (desktop phase):** SQLite via Prisma + Electron IPC
**Style:** Utility-first with TailwindCSS — compact, clean, mobile-friendly UI

---

## Project Structure
```
src/
├── api/
│   └── index.js          ← All data operations go here (no direct localStorage elsewhere)
├── pages/
│   ├── CashierPOS.jsx    ← POS screen (cashier role)
│   ├── Dashboard.jsx     ← Sales analytics (admin/manager)
│   ├── Orders.jsx        ← Order history (admin/manager)
│   ├── Products.jsx      ← Menu management (admin/manager)
│   └── SupplyChain.jsx   ← Inventory & purchase orders (admin/manager)
├── store/
│   ├── authStore.js      ← Zustand: admin session state
│   └── cartStore.js      ← Zustand: POS cart state
├── components/
├── App.jsx
└── main.jsx
```

---

## Roles & Access

There are **2 roles** in this system:

| Role | Entry Method | Access |
|---|---|---|
| `cashier` | Name entry only — no password | POS screen only |
| `admin` | Username + password login | Everything |

### Permission Matrix

| Feature | Admin | Cashier |
|---|:---:|:---:|
| POS / Place Orders | ✅ | ✅ |
| View Today's Orders | ✅ | ✅ |
| View All Order History | ✅ | ❌ |
| Sales Dashboard & Reports | ✅ | ❌ |
| Menu / Product Management | ✅ | ❌ |
| Inventory Management | ✅ | ❌ |
| Purchase Orders & Deliveries | ✅ | ❌ |
| User / Settings Management | ✅ | ❌ |

### Role Check Pattern
Always guard admin-only components like this:
```jsx
const { user } = useAuthStore()
if (user?.role !== 'admin') return <AccessDenied />
```

---

## Feature 1: Cashier Name Entry Screen

- Shown when the app opens and no cashier session is active.
- **No password or login** — cashier types their name only.
- Single input: `"Enter your name to start..."` + **Start Shift** button.
- On submit: saves name to Zustand session state as `servedBy`.
- Name resets when the app is closed (no persistence — each shift starts fresh).
- Show restaurant name "Chelsy's Burger" at top, current date below it.
- Empty name → inline error: `"Please enter your name to continue."`
- Do NOT build: user accounts, passwords, avatars, or profile settings for cashiers.

---

## Feature 2: POS Sales Monitoring (CashierPOS.jsx)

### Cart Behavior
- Left panel: menu grid grouped by category.
- Right panel: current order / cart.
- Each cart item: name, unit price, editable quantity, line total, trash icon.
- **Quantity is directly editable** — clicking the number turns it into a text input.
  - Auto-select text on focus so cashier can type immediately.
  - `inputMode="numeric"` for touch devices.
  - Type `0` or clear → removes item from cart.
  - Invalid input → revert to previous quantity silently.
  - Max quantity: 999.

### Order Totals
- Subtotal → Discount (manual peso amount, optional) → Total.
- No VAT or tax computation.

### Payment Methods — **Cash or E-Bank only**
- **Cash:** cashier enters amount tendered → system shows change in real time.
  - Block submission if tendered < total.
- **E-Bank:** (GCash, Maya, mobile banking) — no change needed, change field hidden.

### Place Order Button
- Disabled if cart is empty or cash tendered < total.
- On success: show receipt modal → clear cart → ready for next order.

### Receipt Modal
- Order number (e.g. `ORD-0042`), date/time, cashier name (`servedBy`).
- Itemized list, subtotal, discount, total, payment method, change (if cash).
- **Print Receipt** button → `window.print()` for now (Electron phase: thermal printer).
- **New Order** button → closes modal, resets cart.

### Cashier Order History
- Today's orders only, current session only.
- Table: Order #, Time, Items summary, Total, Payment method.
- Most recent first.
- Total transaction count + total revenue at bottom.
- Filter by payment method (All / Cash / E-Bank).

### Data Shape
```js
Order {
  id: string              // "ORD-0042"
  createdAt: datetime
  servedBy: string        // from cashier session
  items: [
    { menuItemId, name, unitPrice, quantity, subtotal }
  ]
  subtotal: number
  discount: number
  total: number
  paymentMethod: "cash" | "ebank"
  amountPaid: number
  change: number
}
```

### Do NOT build
- ❌ Automatic inventory deduction on sale
- ❌ Tax/VAT computation
- ❌ Customer accounts or loyalty points
- ❌ Order editing after placement

---

## Feature 3: Inventory Consumption Tracking (SupplyChain.jsx)

### Core Concept: Pack-Based Tracking
Staff track **supply packs opened**, not individual units.
Example: 1 pack of burger buns = 24 buns → log "opened 1 pack" not "used 24 buns."

### Inventory Item Fields
```js
InventoryItem {
  id, name,
  unit: string        // "pack of 24", "1kg bag"
  currentStock: number
  warningLevel: number
  supplier: string    // optional
  updatedAt: datetime
}
```

### Stock List Display
- Table with: Name, Unit, Current Stock, Warning Level, Status badge.
- Status: 🔴 Critical (at/below warning), 🟡 Low (within 2 of warning), 🟢 Normal.
- Low/critical items sorted to the top.

### Log Usage ("Open a Pack") — primary daily action
1. Click **"Log Usage"** next to an item.
2. Modal: item name (read-only), quantity opened (default 1), optional note.
3. Confirm → deduct from stock, save to history log.
- Block if quantity > current stock.

### Manual Stock Adjustment (Admin only)
- Types: Add Stock / Remove Stock / Set Stock (override).
- Requires: quantity + reason (mandatory).
- Every adjustment saved to history log.

### Low Stock Warnings
- Admin sets warning level per item.
- Alert section at top of page showing all items at/below threshold.
- Quick **Restock** button per alert item.

### Usage History Log
```js
StockLog {
  id, itemId, itemName,
  action: "consumed" | "added" | "adjusted"
  quantity: number    // negative for consumed/removed
  note: string
  loggedBy: string
  createdAt: datetime
}
```
- Filterable by item, date range, action type.

### Purchase Orders (Basic)
```js
PurchaseOrder {
  id: string          // "PO-0012"
  supplier: string
  status: "pending" | "ordered" | "received"
  expectedDate: date
  items: [{ itemId, itemName, quantityOrdered, quantityReceived }]
  createdAt, receivedAt: datetime
}
```
- Create PO → select items + quantities + supplier + expected date.
- Receive delivery → confirm quantities → stock auto-incremented.

### Do NOT build
- ❌ Auto-deduction from POS sales
- ❌ Per-item ingredient/recipe mapping
- ❌ Supplier payment or accounting
- ❌ Expiry date tracking

---

## General Coding Rules

1. **All data operations go through `src/api/index.js`** — never read/write localStorage directly in a component.
2. **Zustand for global state** — auth session, cashier session, cart. Local `useState` for UI-only state.
3. **TailwindCSS only** — no inline styles, no separate CSS files.
4. **Keep components focused** — split large pages into smaller sub-components inside a `/components` folder.
5. **Consistent naming:** `camelCase` for variables/functions, `PascalCase` for components.
6. **Error handling:** always show user-friendly inline error messages, never raw JS errors.
7. **No backend calls** — everything is local. No `fetch()`, no axios, no external APIs.
