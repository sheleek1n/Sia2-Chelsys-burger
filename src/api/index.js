/**
 * Local API – in-memory + localStorage. Swap for Electron IPC + SQLite later.
 */

const STORAGE_KEY = 'chelsys_burger_data'
const CURRENT_USER_KEY = 'chelsys_current_user'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return {
    users: [
      { id: '1', username: 'admin', password: 'admin123', role: 'admin', full_name: 'Admin User' },
    ],
    orders: [
      { id: 'seed_ord_1', order_number: 'ORD-100001', cashier_name: 'Admin', total_amount: 299, payment_method: 'cash', status: 'completed', order_date: new Date().toISOString().split('T')[0], items: [{ menu_item_id: 'seed_menu_1', menu_item_name: 'Classic Burger', quantity: 1, unit_price: 299, subtotal: 299 }] },
    ],
    // Unified ingredients — single source of truth for both Admin Inventory and Cashier Production Log
    ingredients: [
      { id: 'ing_1', name: 'Beef Patty',       unit: 'pcs',        current_stock: 50,  warning_level: 10, cost_per_unit: 45,  supplier: 'Local Meat Co.' },
      { id: 'ing_2', name: 'Burger Buns',       unit: 'pack of 24', current_stock: 80,  warning_level: 20, cost_per_unit: 8,   supplier: 'Bakery' },
      { id: 'ing_3', name: 'Ketchup',           unit: '1kg bag',    current_stock: 2,   warning_level: 3,  cost_per_unit: 120, supplier: 'Condiments Inc.' },
      { id: 'ing_4', name: 'Spicy Sauce',       unit: '1kg bag',    current_stock: 1,   warning_level: 2,  cost_per_unit: 95,  supplier: 'Condiments Inc.' },
      { id: 'ing_5', name: 'Mayonnaise',        unit: '1kg bag',    current_stock: 5,   warning_level: 2,  cost_per_unit: 90,  supplier: 'Condiments Inc.' },
      { id: 'ing_6', name: 'Cheese Slices',     unit: 'pack of 20', current_stock: 10,  warning_level: 4,  cost_per_unit: 75,  supplier: 'Dairy Best' },
      { id: 'ing_7', name: 'Fries',             unit: '1kg bag',    current_stock: 15,  warning_level: 5,  cost_per_unit: 120, supplier: 'FoodPro' },
      { id: 'ing_8', name: 'Chicken Fillets',   unit: 'pack of 10', current_stock: 20,  warning_level: 5,  cost_per_unit: 450, supplier: 'Poultry Farm' },
    ],
    menuItems: [
      { id: 'seed_menu_1', name: 'Classic Burger',       category: 'burger', price: 299, is_available: true },
      { id: 'seed_menu_2', name: 'Cheese Burger',        category: 'burger', price: 329, is_available: true },
      { id: 'seed_menu_3', name: 'Fries',                category: 'sides',  price: 89,  is_available: true },
      { id: 'seed_menu_4', name: 'Coke (Regular)',       category: 'drinks', price: 49,  is_available: true },
      { id: 'seed_menu_5', name: 'Burger + Fries Combo', category: 'combo',  price: 349, is_available: true },
    ],
    purchaseOrders: [],
    deliveries: [],
    stockLogs: [],
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (_) {}
}

let db = load()

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// Auto-increment PO number: PO-0001, PO-0002 …
function nextPoNumber() {
  const existing = (db.purchaseOrders || [])
    .map((p) => parseInt((p.po_number || '').replace('PO-', ''), 10))
    .filter((n) => !isNaN(n))
  const max = existing.length ? Math.max(...existing) : 0
  return `PO-${String(max + 1).padStart(4, '0')}`
}

// —— Auth ——
function getStoredUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

export const api = {
  auth: {
    getUser() {
      return Promise.resolve(getStoredUser())
    },
    login(username, password) {
      const user = db.users.find((u) => u.username === username && (u.password === password || !password))
      if (user && user.role === 'admin') {
        const session = { id: user.id, full_name: user.full_name, role: user.role }
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session))
        return Promise.resolve(session)
      }
      return Promise.reject(new Error('Invalid credentials'))
    },
    logout() {
      localStorage.removeItem(CURRENT_USER_KEY)
      return Promise.resolve()
    },
  },

  orders: {
    list(limit = 500) {
      const list = [...db.orders].sort((a, b) => new Date(b.order_date) - new Date(a.order_date))
      return Promise.resolve(list.slice(0, limit))
    },
    create(data) {
      const row = { id: uid(), ...data }
      db.orders.push(row)
      save(db)
      return Promise.resolve(row)
    },
    update(id, data) {
      const i = db.orders.findIndex((o) => o.id === id)
      if (i >= 0) db.orders[i] = { ...db.orders[i], ...data }
      save(db)
      return Promise.resolve(db.orders[i])
    },
    delete(id) {
      db.orders = db.orders.filter((o) => o.id !== id)
      save(db)
      return Promise.resolve()
    },
  },

  // ── Unified Ingredients ──────────────────────────────────────────────────
  // Single source of truth used by both Admin Products page and Cashier Production Log.
  ingredients: {
    list() {
      return Promise.resolve([...(db.ingredients || [])])
    },
    get(id) {
      return Promise.resolve((db.ingredients || []).find((x) => x.id === id) ?? null)
    },
    create(data) {
      const row = { id: uid(), ...data }
      db.ingredients = db.ingredients || []
      db.ingredients.push(row)
      save(db)
      return Promise.resolve(row)
    },
    update(id, data) {
      db.ingredients = db.ingredients || []
      const i = db.ingredients.findIndex((x) => x.id === id)
      if (i >= 0) db.ingredients[i] = { ...db.ingredients[i], ...data }
      save(db)
      return Promise.resolve(db.ingredients[i])
    },
    delete(id) {
      db.ingredients = (db.ingredients || []).filter((x) => x.id !== id)
      save(db)
      return Promise.resolve()
    },

    // Cashier: atomically deducts 1 pack and writes a stock log entry.
    consume(itemId, { loggedBy, note }) {
      db.ingredients = db.ingredients || []
      const i = db.ingredients.findIndex((x) => x.id === itemId)
      if (i < 0) return Promise.reject(new Error('Ingredient not found'))
      const item = db.ingredients[i]
      const newStock = Math.max(0, (item.current_stock || 0) - 1)
      db.ingredients[i] = { ...item, current_stock: newStock }
      const logEntry = {
        id: uid(),
        itemId,
        itemName: item.name,
        action: 'consumed',
        quantity: -1,
        note: note || null,
        loggedBy,
        createdAt: new Date().toISOString(),
      }
      db.stockLogs = db.stockLogs || []
      db.stockLogs.push(logEntry)
      save(db)
      return Promise.resolve({ item: db.ingredients[i], log: logEntry })
    },

    // Admin: add / remove / set stock with a reason log.
    // type: 'add' | 'remove' | 'set'
    adjust(itemId, { type, qty, reason, loggedBy }) {
      db.ingredients = db.ingredients || []
      const i = db.ingredients.findIndex((x) => x.id === itemId)
      if (i < 0) return Promise.reject(new Error('Ingredient not found'))
      const item = db.ingredients[i]
      let newStock = item.current_stock || 0
      if (type === 'add')    newStock = newStock + qty
      else if (type === 'remove') newStock = Math.max(0, newStock - qty)
      else if (type === 'set')    newStock = qty
      db.ingredients[i] = { ...item, current_stock: newStock }
      const logEntry = {
        id: uid(),
        itemId,
        itemName: item.name,
        action: type,
        quantity: type === 'set' ? qty : (type === 'add' ? qty : -qty),
        note: reason || null,
        loggedBy,
        createdAt: new Date().toISOString(),
      }
      db.stockLogs = db.stockLogs || []
      db.stockLogs.push(logEntry)
      save(db)
      return Promise.resolve({ item: db.ingredients[i], log: logEntry })
    },
  },

  menuItems: {
    list() {
      return Promise.resolve([...db.menuItems])
    },
    create(data) {
      const row = { id: uid(), ...data }
      db.menuItems.push(row)
      save(db)
      return Promise.resolve(row)
    },
    update(id, data) {
      const i = db.menuItems.findIndex((x) => x.id === id)
      if (i >= 0) db.menuItems[i] = { ...db.menuItems[i], ...data }
      save(db)
      return Promise.resolve(db.menuItems[i])
    },
    delete(id) {
      db.menuItems = db.menuItems.filter((x) => x.id !== id)
      save(db)
      return Promise.resolve()
    },
  },

  purchaseOrders: {
    list(limit = 200) {
      const list = [...(db.purchaseOrders || [])]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      return Promise.resolve(list.slice(0, limit))
    },
    create(data) {
      const po_number = nextPoNumber()
      const row = { id: uid(), po_number, status: 'pending', created_at: new Date().toISOString(), ...data }
      db.purchaseOrders = db.purchaseOrders || []
      db.purchaseOrders.push(row)
      save(db)
      return Promise.resolve(row)
    },
    update(id, data) {
      db.purchaseOrders = db.purchaseOrders || []
      const i = db.purchaseOrders.findIndex((x) => x.id === id)
      if (i >= 0) db.purchaseOrders[i] = { ...db.purchaseOrders[i], ...data }
      save(db)
      return Promise.resolve(db.purchaseOrders[i])
    },
    // Mark as received: update status and add stock for each line item
    receive(id, { receivedBy } = {}) {
      db.purchaseOrders = db.purchaseOrders || []
      const i = db.purchaseOrders.findIndex((x) => x.id === id)
      if (i < 0) return Promise.reject(new Error('PO not found'))
      const po = db.purchaseOrders[i]
      // Add stock for each line item
      const items = po.items || []
      items.forEach((line) => {
        const ing = (db.ingredients || []).findIndex((x) => x.id === line.ingredientId)
        if (ing >= 0) {
          db.ingredients[ing] = {
            ...db.ingredients[ing],
            current_stock: (db.ingredients[ing].current_stock || 0) + (line.quantity || 0),
          }
          const logEntry = {
            id: uid(), itemId: line.ingredientId, itemName: line.ingredientName,
            action: 'received', quantity: line.quantity,
            note: `PO ${po.po_number}`, loggedBy: receivedBy || 'Admin',
            createdAt: new Date().toISOString(),
          }
          db.stockLogs = db.stockLogs || []
          db.stockLogs.push(logEntry)
        }
      })
      db.purchaseOrders[i] = { ...po, status: 'received', received_at: new Date().toISOString(), received_by: receivedBy || 'Admin' }
      save(db)
      return Promise.resolve(db.purchaseOrders[i])
    },
    delete(id) {
      db.purchaseOrders = (db.purchaseOrders || []).filter((x) => x.id !== id)
      save(db)
      return Promise.resolve()
    },
  },

  deliveries: {
    list(limit = 100) {
      const list = [...(db.deliveries || [])].sort((a, b) => new Date(b.delivery_date) - new Date(a.delivery_date))
      return Promise.resolve(list.slice(0, limit))
    },
    create(data) {
      const row = { id: uid(), ...data }
      db.deliveries = db.deliveries || []
      db.deliveries.push(row)
      save(db)
      return Promise.resolve(row)
    },
    update(id, data) {
      db.deliveries = db.deliveries || []
      const i = db.deliveries.findIndex((x) => x.id === id)
      if (i >= 0) db.deliveries[i] = { ...db.deliveries[i], ...data }
      save(db)
      return Promise.resolve(db.deliveries[i])
    },
    delete(id) {
      db.deliveries = (db.deliveries || []).filter((x) => x.id !== id)
      save(db)
      return Promise.resolve()
    },
  },

  stockLogs: {
    list(limit = 500) {
      const list = [...(db.stockLogs || [])]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      return Promise.resolve(list.slice(0, limit))
    },
    create(data) {
      const row = { id: uid(), ...data }
      db.stockLogs = db.stockLogs || []
      db.stockLogs.push(row)
      save(db)
      return Promise.resolve(row)
    },
  },
}
