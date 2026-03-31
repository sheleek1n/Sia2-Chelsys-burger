/**
 * Local API – in-memory + localStorage. Swap for Electron IPC + SQLite later.
 */

const STORAGE_KEY = 'chelsys_burger_data'
const CURRENT_USER_KEY = 'chelsys_current_user'
const DEFAULT_UNCATEGORIZED_ID = 7

const DEFAULT_INGREDIENT_CATEGORIES = [
  { id: 1, name: 'Proteins', emoji: '🥩', order: 1 },
  { id: 2, name: 'Bread & Buns', emoji: '🍞', order: 2 },
  { id: 3, name: 'Dairy', emoji: '🧀', order: 3 },
  { id: 4, name: 'Sauces & Condiments', emoji: '🥫', order: 4 },
  { id: 5, name: 'Sides & Extras', emoji: '🍟', order: 5 },
  { id: 6, name: 'Packaging', emoji: '🧴', order: 6 },
  { id: 7, name: 'Uncategorized', emoji: '📦', order: 99 },
]

const SEEDED_CATEGORY_BY_INGREDIENT_NAME = {
  'Beef Patty': 1,
  'Chicken Fillets': 1,
  'Burger Buns': 2,
  'Cheese Slices': 3,
  'Mayonnaise': 3,
  'Ketchup': 4,
  'Spicy Sauce': 4,
  'Fries': 5,
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return {
    users: [
      { id: '1', username: 'admin', password: 'admin123', role: 'admin', full_name: 'Admin User' },
      { id: '2', username: 'user', password: 'user123', role: 'cashier', full_name: 'Cashier User' },
    ],
    orders: [
      { id: 'seed_ord_1', order_number: 'ORD-100001', cashier_name: 'Admin', total_amount: 299, payment_method: 'cash', status: 'completed', order_date: new Date().toISOString().split('T')[0], items: [{ menu_item_id: 'seed_menu_1', menu_item_name: 'Classic Burger', quantity: 1, unit_price: 299, subtotal: 299 }] },
    ],
    // Unified ingredients — single source of truth for both Admin Inventory and Cashier Production Log
    ingredientCategories: [...DEFAULT_INGREDIENT_CATEGORIES],
    ingredients: [
      { id: 'ing_1', name: 'Beef Patty',       unit: 'pcs',        current_stock: 50,  warning_level: 10, cost_per_unit: 45,  supplier: 'Local Meat Co.', expiry_date: null, categoryId: 1 },
      { id: 'ing_2', name: 'Burger Buns',      unit: 'pack of 24', current_stock: 80,  warning_level: 20, cost_per_unit: 8,   supplier: 'Bakery', expiry_date: null, categoryId: 2 },
      { id: 'ing_3', name: 'Ketchup',          unit: '1kg bag',    current_stock: 2,   warning_level: 3,  cost_per_unit: 120, supplier: 'Condiments Inc.', expiry_date: null, categoryId: 4 },
      { id: 'ing_4', name: 'Spicy Sauce',      unit: '1kg bag',    current_stock: 1,   warning_level: 2,  cost_per_unit: 95,  supplier: 'Condiments Inc.', expiry_date: null, categoryId: 4 },
      { id: 'ing_5', name: 'Mayonnaise',       unit: '1kg bag',    current_stock: 5,   warning_level: 2,  cost_per_unit: 90,  supplier: 'Condiments Inc.', expiry_date: null, categoryId: 3 },
      { id: 'ing_6', name: 'Cheese Slices',    unit: 'pack of 20', current_stock: 10,  warning_level: 4,  cost_per_unit: 75,  supplier: 'Dairy Best', expiry_date: null, categoryId: 3 },
      { id: 'ing_7', name: 'Fries',            unit: '1kg bag',    current_stock: 15,  warning_level: 5,  cost_per_unit: 120, supplier: 'FoodPro', expiry_date: null, categoryId: 5 },
      { id: 'ing_8', name: 'Chicken Fillets',  unit: 'pack of 10', current_stock: 20,  warning_level: 5,  cost_per_unit: 450, supplier: 'Poultry Farm', expiry_date: null, categoryId: 1 },
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
    inventoryLogs: [],   // Activity log — fills as actions happen
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (_) {}
}

let db = load()

// Ensure inventoryLogs exists for existing localStorage data
if (!db.inventoryLogs) {
  db.inventoryLogs = []
  save(db)
}

if ((db.ingredients || []).some((item) => item.expiry_date === undefined)) {
  db.ingredients = (db.ingredients || []).map((item) => ({ ...item, expiry_date: item.expiry_date ?? null }))
  save(db)
}

if (!Array.isArray(db.ingredientCategories) || db.ingredientCategories.length === 0) {
  db.ingredientCategories = [...DEFAULT_INGREDIENT_CATEGORIES]
  save(db)
}

if (!(db.ingredientCategories || []).some((c) => Number(c.id) === DEFAULT_UNCATEGORIZED_ID)) {
  db.ingredientCategories = [...(db.ingredientCategories || []), DEFAULT_INGREDIENT_CATEGORIES.find((c) => c.id === DEFAULT_UNCATEGORIZED_ID)]
  save(db)
}

if ((db.ingredients || []).some((item) => item.categoryId === undefined || item.categoryId === null)) {
  db.ingredients = (db.ingredients || []).map((item) => ({
    ...item,
    categoryId: item.categoryId ?? SEEDED_CATEGORY_BY_INGREDIENT_NAME[item.name] ?? DEFAULT_UNCATEGORIZED_ID,
  }))
  save(db)
}

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

function formatDateForLog(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getExpiryStatus(expiry_date) {
  if (!expiry_date) return null

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const expiry = new Date(`${expiry_date}T00:00:00`)
  const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))

  if (daysUntilExpiry < 0) return { label: 'Expired', color: 'red', severity: 'critical', days: daysUntilExpiry }
  if (daysUntilExpiry <= 3) return { label: `Expiring in ${daysUntilExpiry} days`, color: 'orange', severity: 'warning', days: daysUntilExpiry }
  if (daysUntilExpiry <= 7) return { label: 'Expiring Soon', color: 'yellow', severity: 'warning', days: daysUntilExpiry }
  return { label: 'Fresh', color: 'green', severity: 'info', days: daysUntilExpiry }
}

// ── Inventory Log Helper ────────────────────────────────────────────────────
function createLog({ action, ingredientId, ingredientName, performedBy, details, previousValue, newValue, severity }) {
  const log = {
    id: uid(),
    createdAt: new Date().toISOString(),
    action,
    ingredientId: ingredientId || null,
    ingredientName: ingredientName || null,
    performedBy: performedBy || 'System',
    details,
    previousValue: previousValue || null,
    newValue: newValue || null,
    severity: severity || 'info',
  }
  db.inventoryLogs = db.inventoryLogs || []
  db.inventoryLogs.push(log)
  save(db)
  return log
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
      const user = db.users.find((u) => u.username === username && u.password === password)
      if (!user) {
        return Promise.reject(new Error('Invalid credentials'))
      }
      
      const session = { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
      
      // Only persist admin sessions to localStorage
      if (user.role === 'admin') {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session))
      } else {
        localStorage.removeItem(CURRENT_USER_KEY)
      }
      
      return Promise.resolve(session)
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
  ingredientCategories: {
    list() {
      const list = [...(db.ingredientCategories || [])].sort((a, b) => {
        if (Number(a.id) === DEFAULT_UNCATEGORIZED_ID) return 1
        if (Number(b.id) === DEFAULT_UNCATEGORIZED_ID) return -1
        return Number(a.order || 999) - Number(b.order || 999)
      })
      return Promise.resolve(list)
    },
    create({ name, emoji }) {
      const currentUser = getStoredUser()
      if (!currentUser || currentUser.role !== 'admin') {
        return Promise.reject(new Error('Admin access required'))
      }
      if (!name || !String(name).trim()) {
        return Promise.reject(new Error('Category name is required'))
      }

      const existing = db.ingredientCategories || []
      const nextId = existing.length ? Math.max(...existing.map((c) => Number(c.id) || 0)) + 1 : 1
      const maxOrder = existing.length
        ? Math.max(...existing.filter((c) => Number(c.id) !== DEFAULT_UNCATEGORIZED_ID).map((c) => Number(c.order) || 0), 0)
        : 0
      const row = {
        id: nextId,
        name: String(name).trim(),
        emoji: emoji || '📦',
        order: maxOrder + 1,
      }
      db.ingredientCategories = [...existing, row]
      save(db)
      return Promise.resolve(row)
    },
    update(id, data) {
      const currentUser = getStoredUser()
      if (!currentUser || currentUser.role !== 'admin') {
        return Promise.reject(new Error('Admin access required'))
      }
      const categoryId = Number(id)
      db.ingredientCategories = db.ingredientCategories || []
      const i = db.ingredientCategories.findIndex((c) => Number(c.id) === categoryId)
      if (i < 0) return Promise.resolve(null)

      const nextName = data?.name !== undefined ? String(data.name).trim() : db.ingredientCategories[i].name
      if (!nextName) {
        return Promise.reject(new Error('Category name is required'))
      }

      db.ingredientCategories[i] = {
        ...db.ingredientCategories[i],
        ...data,
        name: nextName,
      }
      save(db)
      return Promise.resolve(db.ingredientCategories[i])
    },
    delete(id) {
      const currentUser = getStoredUser()
      if (!currentUser || currentUser.role !== 'admin') {
        return Promise.reject(new Error('Admin access required'))
      }
      const categoryId = Number(id)
      db.ingredientCategories = db.ingredientCategories || []
      const category = db.ingredientCategories.find((c) => Number(c.id) === categoryId)
      if (!category) return Promise.resolve()

      if (categoryId === DEFAULT_UNCATEGORIZED_ID || String(category.name).toLowerCase() === 'uncategorized') {
        return Promise.reject(new Error('Uncategorized cannot be deleted'))
      }

      const hasAssigned = (db.ingredients || []).some((item) => Number(item.categoryId ?? DEFAULT_UNCATEGORIZED_ID) === categoryId)
      if (hasAssigned) {
        return Promise.reject(new Error('Remove or reassign ingredients before deleting this category'))
      }

      db.ingredientCategories = db.ingredientCategories.filter((c) => Number(c.id) !== categoryId)
      save(db)
      return Promise.resolve()
    },
  },

  ingredients: {
    getExpiryStatus(expiry_date) {
      return getExpiryStatus(expiry_date)
    },
    list() {
      return Promise.resolve([...(db.ingredients || [])])
    },
    get(id) {
      return Promise.resolve((db.ingredients || []).find((x) => x.id === id) ?? null)
    },
    create(data) {
      const row = {
        id: uid(),
        expiry_date: null,
        categoryId: Number(data?.categoryId ?? DEFAULT_UNCATEGORIZED_ID),
        ...data,
      }
      db.ingredients = db.ingredients || []
      db.ingredients.push(row)
      save(db)

      // Log: item_added
      createLog({
        action: 'item_added',
        ingredientId: row.id,
        ingredientName: data.name,
        performedBy: 'Admin',
        details: `Added ${data.name} with initial stock of ${data.current_stock} ${data.unit}`,
        newValue: `${data.current_stock} ${data.unit}`,
        severity: 'info',
      })

      if (row.expiry_date) {
        const formattedDate = formatDateForLog(row.expiry_date)
        createLog({
          action: 'expiry_added',
          ingredientId: row.id,
          ingredientName: row.name,
          performedBy: 'Admin',
          details: `Expiry date set for ${row.name}: ${formattedDate}`,
          newValue: formattedDate,
          severity: 'info',
        })
      }

      return Promise.resolve(row)
    },
    update(id, data) {
      db.ingredients = db.ingredients || []
      const i = db.ingredients.findIndex((x) => x.id === id)
      if (i < 0) return Promise.resolve(null)
      const oldItem = { ...db.ingredients[i] }
      db.ingredients[i] = {
        ...db.ingredients[i],
        ...data,
        ...(data.categoryId !== undefined ? { categoryId: Number(data.categoryId) } : {}),
      }
      save(db)

      // Build detail string showing what changed
      const changes = []
      if (data.name !== undefined && data.name !== oldItem.name) changes.push(`name: ${oldItem.name} → ${data.name}`)
      if (data.current_stock !== undefined && data.current_stock !== oldItem.current_stock) changes.push(`stock: ${oldItem.current_stock} → ${data.current_stock}`)
      if (data.warning_level !== undefined && data.warning_level !== oldItem.warning_level) changes.push(`warning level: ${oldItem.warning_level} → ${data.warning_level}`)
      if (data.unit !== undefined && data.unit !== oldItem.unit) changes.push(`unit: ${oldItem.unit} → ${data.unit}`)
      if (data.cost_per_unit !== undefined && data.cost_per_unit !== oldItem.cost_per_unit) changes.push(`cost: ₱${oldItem.cost_per_unit} → ₱${data.cost_per_unit}`)
      if (data.supplier !== undefined && data.supplier !== oldItem.supplier) changes.push(`supplier: ${oldItem.supplier} → ${data.supplier}`)
      if (data.expiry_date !== undefined && data.expiry_date !== oldItem.expiry_date) changes.push(`expiry date: ${oldItem.expiry_date || 'none'} → ${data.expiry_date || 'none'}`)
      if (data.categoryId !== undefined && Number(data.categoryId) !== Number(oldItem.categoryId)) {
        const categoryById = (db.ingredientCategories || []).reduce((acc, c) => ({ ...acc, [Number(c.id)]: c.name }), {})
        changes.push(`category: ${categoryById[Number(oldItem.categoryId)] || 'Uncategorized'} → ${categoryById[Number(data.categoryId)] || 'Uncategorized'}`)
      }

      const detailStr = changes.length > 0 ? `Updated ${oldItem.name}: ${changes.join(', ')}` : `Updated ${oldItem.name}`

      createLog({
        action: 'item_edited',
        ingredientId: id,
        ingredientName: oldItem.name,
        performedBy: 'Admin',
        details: detailStr,
        severity: 'info',
      })

      if (data.expiry_date && data.expiry_date !== oldItem.expiry_date) {
        const formattedDate = formatDateForLog(data.expiry_date)
        createLog({
          action: 'expiry_added',
          ingredientId: id,
          ingredientName: db.ingredients[i].name,
          performedBy: 'Admin',
          details: `Expiry date set for ${db.ingredients[i].name}: ${formattedDate}`,
          newValue: formattedDate,
          severity: 'info',
        })
      }

      return Promise.resolve(db.ingredients[i])
    },
    delete(id) {
      const ingredient = (db.ingredients || []).find((x) => x.id === id)
      db.ingredients = (db.ingredients || []).filter((x) => x.id !== id)
      save(db)

      // Log: item_deleted
      if (ingredient) {
        createLog({
          action: 'item_deleted',
          ingredientId: id,
          ingredientName: ingredient.name,
          performedBy: 'Admin',
          details: `Deleted ${ingredient.name}`,
          severity: 'info',
        })
      }

      return Promise.resolve()
    },

    // Cashier: atomically deducts 1 pack and writes a stock log entry.
    consume(itemId, { loggedBy, note }) {
      db.ingredients = db.ingredients || []
      const i = db.ingredients.findIndex((x) => x.id === itemId)
      if (i < 0) return Promise.reject(new Error('Ingredient not found'))
      const item = db.ingredients[i]
      const oldStock = item.current_stock || 0
      const newStock = Math.max(0, oldStock - 1)
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

      // Log: pack_opened
      createLog({
        action: 'pack_opened',
        ingredientId: itemId,
        ingredientName: item.name,
        performedBy: loggedBy,
        previousValue: `${oldStock} ${item.unit}`,
        newValue: `${newStock} ${item.unit}`,
        details: `${loggedBy} opened 1 pack of ${item.name}`,
        severity: 'info',
      })

      // Check low stock after consume
      if (newStock <= item.warning_level) {
        createLog({
          action: 'low_stock',
          ingredientId: itemId,
          ingredientName: item.name,
          performedBy: 'System',
          details: `${item.name} dropped to ${newStock} — below warning level of ${item.warning_level}`,
          newValue: `${newStock} ${item.unit}`,
          severity: newStock === 0 ? 'critical' : 'warning',
        })
      }

      return Promise.resolve({ item: db.ingredients[i], log: logEntry })
    },

    // Admin: add / remove / set stock with a reason log.
    // type: 'add' | 'remove' | 'set'
    adjust(itemId, { type, qty, reason, loggedBy }) {
      db.ingredients = db.ingredients || []
      const i = db.ingredients.findIndex((x) => x.id === itemId)
      if (i < 0) return Promise.reject(new Error('Ingredient not found'))
      const item = db.ingredients[i]
      const oldStock = item.current_stock || 0
      let newStock = oldStock
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

      // Log: stock_adjusted
      const actionVerb = type === 'add' ? 'added' : type === 'remove' ? 'removed' : 'set to'
      createLog({
        action: 'stock_adjusted',
        ingredientId: itemId,
        ingredientName: item.name,
        performedBy: loggedBy || 'Admin',
        previousValue: `${oldStock} ${item.unit}`,
        newValue: `${newStock} ${item.unit}`,
        details: `${loggedBy || 'Admin'} ${actionVerb} ${qty} ${item.unit} — Reason: ${reason || 'N/A'}`,
        severity: 'info',
      })

      // Check low stock after adjust
      if (newStock <= item.warning_level) {
        createLog({
          action: 'low_stock',
          ingredientId: itemId,
          ingredientName: item.name,
          performedBy: 'System',
          details: `${item.name} dropped to ${newStock} — below warning level of ${item.warning_level}`,
          newValue: `${newStock} ${item.unit}`,
          severity: newStock === 0 ? 'critical' : 'warning',
        })
      }

      return Promise.resolve({ item: db.ingredients[i], log: logEntry })
    },

    checkAndLogExpiryAlerts() {
      const currentUser = getStoredUser()
      if (!currentUser || currentUser.role !== 'admin') {
        return Promise.reject(new Error('Admin access required'))
      }

      const ingredients = [...(db.ingredients || [])]
      const createdLogs = []

      ingredients.forEach((item) => {
        if (!item.expiry_date) return
        const status = getExpiryStatus(item.expiry_date)
        const formattedDate = formatDateForLog(item.expiry_date)
        if (!status) return

        if (status.severity === 'critical') {
          const log = createLog({
            action: 'expired',
            ingredientId: item.id,
            ingredientName: item.name,
            performedBy: 'System',
            details: `${item.name} has expired (expired: ${formattedDate})`,
            newValue: formattedDate,
            severity: 'critical',
          })
          createdLogs.push(log)
        } else if (status.severity === 'warning') {
          const log = createLog({
            action: 'expiring_soon',
            ingredientId: item.id,
            ingredientName: item.name,
            performedBy: 'System',
            details: `${item.name} is expiring in ${status.days} days (${formattedDate})`,
            newValue: formattedDate,
            severity: 'warning',
          })
          createdLogs.push(log)
        }
      })

      return Promise.resolve(createdLogs)
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
          const oldStock = db.ingredients[ing].current_stock || 0
          const newStock = oldStock + (line.quantity || 0)
          db.ingredients[ing] = {
            ...db.ingredients[ing],
            current_stock: newStock,
          }

          // Legacy stock log
          const logEntry = {
            id: uid(), itemId: line.ingredientId, itemName: line.ingredientName,
            action: 'received', quantity: line.quantity,
            note: `PO ${po.po_number}`, loggedBy: receivedBy || 'Admin',
            createdAt: new Date().toISOString(),
          }
          db.stockLogs = db.stockLogs || []
          db.stockLogs.push(logEntry)

          // Log: delivery_received
          createLog({
            action: 'delivery_received',
            ingredientId: line.ingredientId,
            ingredientName: line.ingredientName,
            performedBy: receivedBy || 'Admin',
            details: `Received ${line.quantity} ${db.ingredients[ing].unit || 'units'} from ${line.supplierName || po.supplier || 'supplier'} (via ${po.po_number})`,
            previousValue: `${oldStock} ${db.ingredients[ing].unit || 'units'}`,
            newValue: `${newStock} ${db.ingredients[ing].unit || 'units'}`,
            severity: 'info',
          })
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

      // Log: delivery_received (when delivery payload is tied to an ingredient stock update)
      if (data?.ingredientId) {
        const ingredient = (db.ingredients || []).find((x) => x.id === data.ingredientId)
        const qty = Number(data.quantity ?? data.qty ?? 0)
        const unit = data.unit || ingredient?.unit || 'units'
        const oldStock = Number(data.oldStock ?? ingredient?.current_stock ?? 0)
        const newStock = Number(data.newStock ?? (oldStock + qty))
        const supplier = data.supplier || ingredient?.supplier || 'supplier'

        createLog({
          action: 'delivery_received',
          ingredientId: data.ingredientId,
          ingredientName: data.ingredientName || ingredient?.name,
          performedBy: data.loggedBy || 'Admin',
          details: `Received ${qty} ${unit} from ${supplier}${data.poNumber ? ` (via ${data.poNumber})` : ''}`,
          previousValue: `${oldStock} ${unit}`,
          newValue: `${newStock} ${unit}`,
          severity: 'info',
        })
      }

      save(db)
      return Promise.resolve(row)
    },
    receive(data) {
      const {
        sourceType = 'direct',
        purchaseOrderId,
        supplier,
        receivedBy = 'Admin',
        notes,
        receivedAt,
        items = [],
      } = data || {}

      db.ingredients = db.ingredients || []
      db.stockLogs = db.stockLogs || []
      db.purchaseOrders = db.purchaseOrders || []
      db.deliveries = db.deliveries || []

      let po = null
      if (sourceType === 'po') {
        po = db.purchaseOrders.find((x) => x.id === purchaseOrderId)
        if (!po) return Promise.reject(new Error('PO not found'))
      }

      const normalizedItems = []
      let hasDiscrepancy = false

      items.forEach((line) => {
        const ingredientIndex = db.ingredients.findIndex((x) => x.id === line.ingredientId)
        if (ingredientIndex < 0) return

        const ingredient = db.ingredients[ingredientIndex]
        const quantityOrdered = Number(line.quantityOrdered || 0)
        const quantityReceived = Number(line.quantityReceived || 0)
        const discrepancy = quantityReceived - quantityOrdered
        const oldStock = Number(ingredient.current_stock || 0)
        const newStock = oldStock + quantityReceived

        db.ingredients[ingredientIndex] = {
          ...ingredient,
          current_stock: newStock,
          ...(line.expiry_date ? { expiry_date: line.expiry_date } : {}),
        }

        const stockLogEntry = {
          id: uid(),
          itemId: ingredient.id,
          itemName: ingredient.name,
          action: 'received',
          quantity: quantityReceived,
          note: sourceType === 'po' && po ? `PO ${po.po_number}` : `Direct Delivery (${supplier || 'supplier'})`,
          loggedBy: receivedBy,
          createdAt: new Date().toISOString(),
        }
        db.stockLogs.push(stockLogEntry)

        createLog({
          action: 'delivery_received',
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          performedBy: receivedBy,
          details: `Received ${quantityReceived} ${ingredient.unit} from ${supplier || po?.supplier || 'supplier'}${po ? ` (PO: ${po.po_number})` : ''}`,
          previousValue: `${oldStock} ${ingredient.unit}`,
          newValue: `${newStock} ${ingredient.unit}`,
          severity: 'info',
        })

        if (line.expiry_date) {
          const formattedDate = formatDateForLog(line.expiry_date)
          createLog({
            action: 'expiry_added',
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            performedBy: receivedBy,
            details: `Expiry date updated from delivery batch: ${formattedDate}`,
            newValue: formattedDate,
            severity: 'info',
          })
        }

        if (sourceType === 'po' && discrepancy !== 0) {
          hasDiscrepancy = true
          if (discrepancy < 0) {
            createLog({
              action: 'delivery_discrepancy',
              ingredientId: ingredient.id,
              ingredientName: ingredient.name,
              performedBy: receivedBy,
              details: `Short delivery - ordered ${quantityOrdered}, received ${quantityReceived} (short by ${Math.abs(discrepancy)})`,
              previousValue: `${quantityOrdered} ordered`,
              newValue: `${quantityReceived} received`,
              severity: 'warning',
            })
          } else {
            createLog({
              action: 'delivery_discrepancy',
              ingredientId: ingredient.id,
              ingredientName: ingredient.name,
              performedBy: receivedBy,
              details: `Over delivery - ordered ${quantityOrdered}, received ${quantityReceived} (over by ${discrepancy})`,
              previousValue: `${quantityOrdered} ordered`,
              newValue: `${quantityReceived} received`,
              severity: 'warning',
            })
          }
        }

        normalizedItems.push({
          ingredientId: ingredient.id,
          ingredientName: line.ingredientName || ingredient.name,
          quantityOrdered,
          quantityReceived,
          unitCost: Number(line.unitCost || ingredient.cost_per_unit || 0),
          totalCost: Number(quantityReceived * Number(line.unitCost || ingredient.cost_per_unit || 0)),
          expiry_date: line.expiry_date || null,
          discrepancy,
        })
      })

      if (po) {
        const status = hasDiscrepancy ? 'partially_received' : 'received'
        const updatedPoItems = (po.items || []).map((poItem) => {
          const receivedLine = normalizedItems.find((x) => x.ingredientId === poItem.ingredientId)
          return {
            ...poItem,
            quantityReceived: receivedLine ? receivedLine.quantityReceived : 0,
            expiry_date: receivedLine?.expiry_date || null,
            discrepancy: receivedLine?.discrepancy || 0,
          }
        })

        const poIndex = db.purchaseOrders.findIndex((x) => x.id === po.id)
        db.purchaseOrders[poIndex] = {
          ...po,
          status,
          received_at: receivedAt || new Date().toISOString(),
          received_by: receivedBy,
          items: updatedPoItems,
        }
      }

      const totalValue = normalizedItems.reduce((sum, row) => sum + Number(row.totalCost || 0), 0)
      const row = {
        id: uid(),
        ref: sourceType === 'po' ? undefined : `DIR-${Date.now().toString(36).toUpperCase()}`,
        supplier: supplier || po?.supplier || 'supplier',
        receivedAt: receivedAt || new Date().toISOString(),
        receivedBy,
        notes: notes || null,
        purchaseOrderId: po ? po.po_number : 'Direct',
        purchaseOrderRefId: po ? po.id : null,
        hasDiscrepancy,
        totalValue,
        items: normalizedItems,
      }

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

  // ── Inventory Logs (Activity Log) ─────────────────────────────────────────
  inventoryLogs: {
    list({ ingredientId, dateFrom, dateTo, action, severity } = {}) {
      let logs = [...(db.inventoryLogs || [])]

      if (ingredientId) {
        logs = logs.filter((l) => l.ingredientId === ingredientId)
      }
      if (dateFrom) {
        const from = new Date(dateFrom)
        from.setHours(0, 0, 0, 0)
        logs = logs.filter((l) => new Date(l.createdAt) >= from)
      }
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        logs = logs.filter((l) => new Date(l.createdAt) <= to)
      }
      if (action) {
        logs = logs.filter((l) => l.action === action)
      }
      if (severity) {
        logs = logs.filter((l) => l.severity === severity)
      }

      // Sort most recent first
      logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      return Promise.resolve(logs)
    },
    clear() {
      const currentUser = getStoredUser()
      if (!currentUser || currentUser.role !== 'admin') {
        return Promise.reject(new Error('Admin access required'))
      }
      db.inventoryLogs = []
      save(db)
      return Promise.resolve()
    },
  },
}
