# Chelsy's Burger POS System

A point-of-sale and back-office management system built for a single-branch fast food restaurant.

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

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app opens at **http://localhost:5173**

---

## Available Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start dev server with hot reload     |
| `npm run build`   | Build for production into `dist/`    |
| `npm run preview` | Preview the production build locally |
| `npm run lint`    | Run ESLint to check code quality     |

---

## Default Accounts

These are the seed accounts on first run. Change passwords via the **Accounts** page after logging in as admin.

| Role    | Username | Password |
| ------- | -------- | -------- |
| Admin   | admin    | admin123 |
| Cashier | user     | user123  |

---

## Tech Stack

| Layer            | Technology         | Purpose                                    |
| ---------------- | ------------------ | ------------------------------------------ |
| UI Framework     | React 19           | Component-based user interface             |
| Styling          | TailwindCSS 4      | Utility-first CSS                          |
| Icons            | Lucide React       | Icon library                               |
| Charts           | Recharts           | Sales and revenue charts on the dashboard  |
| State Management | Zustand            | Lightweight store for cashier sessions     |
| Routing          | React Router DOM 7 | Page navigation and route protection       |
| Notifications    | Sonner             | Toast messages for success/error feedback  |
| Date Utilities   | date-fns           | Date formatting and comparisons            |
| Build Tool       | Vite 7             | Dev server, hot module reload, bundling    |
| Linting          | ESLint 9           | Code quality and consistency               |
| Data Storage     | localStorage       | All data persists in the browser (for now) |

---

## Architecture

```
Browser
 |
 |-- React App (Vite + React Router)
 |    |
 |    |-- Pages
 |    |    |-- Dashboard .......... Sales KPIs, charts, alerts (admin only)
 |    |    |-- CashierPOS ......... Order-taking screen (cashier + admin)
 |    |    |-- Orders ............. Order history, void/refund management
 |    |    |-- ProductionLog ...... "Open Pack" stock logging (cashier + admin)
 |    |    |-- Products ........... Menu items + inventory management (admin only)
 |    |    |-- SupplyChain ........ Purchase orders + deliveries (admin only)
 |    |    |-- Settings ........... User account management (admin only)
 |    |
 |    |-- src/api/index.js        ** Single API layer **
 |    |    All data reads/writes go through this one file.
 |    |    Nothing else touches localStorage directly.
 |    |
 |    |-- localStorage            ** Data store **
 |         Stores: users, orders, menu items, ingredients,
 |         ingredient categories, purchase orders, deliveries,
 |         stock logs, inventory logs
```

### Key Design Decisions

1. **POS and inventory are separate.** Selling a burger does not auto-deduct ingredients. Staff logs usage manually via "Open Pack" in the Production Log. This fits a small team where one pack of buns covers many orders across hours.

2. **One API file for everything.** `src/api/index.js` is the only file that reads/writes localStorage. When the app migrates to Electron + SQLite, only this file needs to change.

3. **Unified login, two roles.**
   - Admin: persistent session (survives page refresh), access to all pages
   - Cashier: session-only login (resets when the app closes), access to POS, Order History, and Production Log only

4. **Local timezone dates.** All date recording uses the device's local time, not UTC — so orders placed at any hour of the day in the Philippines are stamped with the correct local date.

---

## Project Structure

```
src/
  api/
    index.js ............... API layer (localStorage CRUD + business logic)
  components/
    dashboard/ ............. Dashboard widgets (StatCard, RevenueChart, TopItems)
    orders/ ................ OrderForm (POS cart + checkout), ReceiptModal
    shared/ ................ Reusable components (PageHeader, MenuItemImage)
    ui/ .................... Base UI components (button, input, dialog, etc.)
  lib/
    AuthContext.jsx ........ Admin session provider
    useCashierStore.js ..... Zustand store for cashier session
  pages/
    Dashboard.jsx .......... Sales summary + inventory alerts
    CashierPOS.jsx ......... Order-taking interface
    Orders.jsx ............. Order history with filters and void/refund
    ProductionLog.jsx ...... Ingredient usage logging
    Products.jsx ........... Menu and inventory management
    SupplyChain.jsx ........ Purchase orders and deliveries
    Settings.jsx ........... Admin account management
  utils/
    menuItemIcons.js ....... Emoji mappings for menu categories
  App.jsx .................. Router + role-based auth wrapper
  Layout.jsx ............... Sidebar navigation
  pages.config.js .......... Page registry
  index.css ................ TailwindCSS config + custom styles
```

---

## Future Roadmap

- [ ] Wrap in Electron for a standalone desktop `.exe`
- [ ] Migrate from localStorage to SQLite (via Prisma ORM)
- [ ] Receipt printer and cash drawer integration
- [ ] PDF report exports
