/**
 * Local API – in-memory store, persisted to:
 *   - Electron file (userData/chelsys-burger-data.json) when running in Electron
 *   - localStorage when running in the browser
 *
 * The Electron path survives browser cache clears and is more reliable.
 */

const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron === true

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

// Electron data loaded asynchronously — see initElectronDb() below
let _electronDataLoaded = false

function load() {
  // If Electron data has been loaded already, it's in the db variable — skip localStorage
  if (isElectron && _electronDataLoaded) return null

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
      { id: 'seed_ord_1', order_number: 'ORD-100001', cashier_name: 'Admin', total_amount: 299, payment_method: 'cash', status: 'completed', order_date: localDate(), items: [{ menu_item_id: 'seed_menu_1', menu_item_name: 'Classic Burger', quantity: 1, unit_price: 299, subtotal: 299, emoji: '🍔' }] },
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
      { id: 'seed_menu_1', name: 'Classic Burger',       category: 'burger', price: 299, is_available: true, emoji: null },
      { id: 'seed_menu_2', name: 'Cheese Burger',        category: 'burger', price: 329, is_available: true, emoji: null },
      { id: 'seed_menu_3', name: 'Fries',                category: 'sides',  price: 89,  is_available: true, emoji: null },
      { id: 'seed_menu_4', name: 'Coke (Regular)',       category: 'drinks', price: 49,  is_available: true, emoji: null },
      { id: 'seed_menu_5', name: 'Burger + Fries Combo', category: 'combo',  price: 349, is_available: true, emoji: null },
    ],
    purchaseOrders: [],
    deliveries: [],
    stockBatches: [],    // FIFO batch tracking per ingredient
    stockLogs: [],
    inventoryLogs: [],   // Activity log — fills as actions happen
  }
}

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function save(data) {
  if (isElectron) {
    // Save to Electron file system via IPC
    try {
      window.electronAPI.db.save(data)
    } catch (err) {
      console.error('[Chelsys] Failed to save via Electron IPC:', err)
    }
    return
  }
  // Fallback: save to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('[Chelsys] Failed to save data to localStorage:', err)
    if (err.name === 'QuotaExceededError' || err.code === 22) {
      alert('Storage is full! Your latest changes may not be saved. Please export or clear old data.')
    }
  }
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

if ((db.menuItems || []).some((item) => item.emoji === undefined)) {
  db.menuItems = (db.menuItems || []).map((item) => ({
    ...item,
    emoji: item.emoji ?? null,
  }))
  save(db)
}

if ((db.purchaseOrders || []).some((po) => (po.items || []).some((item) => item.quantityReceived === undefined || item.discrepancy === undefined || item.unit === undefined))) {
  const ingredientById = new Map((db.ingredients || []).map((item) => [item.id, item]))
  db.purchaseOrders = (db.purchaseOrders || []).map((po) => ({
    ...po,
    items: (po.items || []).map((item) => {
      const quantityOrdered = Number(item.quantityOrdered || 0)
      const quantityReceived = Number(item.quantityReceived || 0)
      const ingredientUnit = ingredientById.get(item.ingredientId)?.unit || 'units'
      return {
        ...item,
        unit: item.unit || ingredientUnit,
        quantityReceived,
        discrepancy: item.discrepancy !== undefined ? Number(item.discrepancy || 0) : quantityReceived - quantityOrdered,
      }
    }),
  }))
  save(db)
}

if ((db.deliveries || []).some((delivery) => delivery.isPartialCompletion === undefined || delivery.parentDeliveryId === undefined)) {
  db.deliveries = (db.deliveries || []).map((delivery) => ({
    ...delivery,
    isPartialCompletion: Boolean(delivery.isPartialCompletion),
    parentDeliveryId: delivery.parentDeliveryId ?? null,
  }))
  save(db)
}

// ── Stock Batches migration: create opening batches for existing stock ──
if (!db.stockBatches) db.stockBatches = []
if (db.stockBatches.length === 0 && (db.ingredients || []).some((i) => (i.current_stock || 0) > 0)) {
  db.ingredients.forEach((item) => {
    if ((item.current_stock || 0) > 0) {
      db.stockBatches.push({
        id: `batch_opening_${item.id}`,
        ingredientId: item.id,
        ingredientName: item.name,
        quantity: item.current_stock,
        originalQuantity: item.current_stock,
        receivedAt: new Date().toISOString(),
        expiryDate: item.expiry_date || null,
        deliveryId: null,
        poNumber: null,
        supplier: item.supplier || 'Opening Stock',
        isExhausted: false,
      })
    }
  })
  save(db)
}

// ── FIFO helpers ──────────────────────────────────────────────────────────
function deductFIFO(ingredientId, quantityToDeduct) {
  const batches = (db.stockBatches || [])
    .filter((b) => b.ingredientId === ingredientId && !b.isExhausted)
    .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt))

  let remaining = quantityToDeduct
  for (const batch of batches) {
    if (remaining <= 0) break
    if (batch.quantity >= remaining) {
      batch.quantity -= remaining
      if (batch.quantity === 0) batch.isExhausted = true
      remaining = 0
    } else {
      remaining -= batch.quantity
      batch.quantity = 0
      batch.isExhausted = true
    }
  }
}

function recalculateStock(ingredientId) {
  return (db.stockBatches || [])
    .filter((b) => b.ingredientId === ingredientId && !b.isExhausted)
    .reduce((sum, b) => sum + b.quantity, 0)
}

function normalizePaymentMethod(value) {
  return value === 'cash' ? 'cash' : 'gcash'
}

function normalizeGcashReference(value) {
  if (value === undefined || value === null) return null
  const nextValue = String(value).trim().slice(0, 20)
  return nextValue || null
}

if ((db.orders || []).some((order) => !['cash', 'gcash'].includes(order.payment_method) || order.gcash_reference === undefined)) {
  db.orders = (db.orders || []).map((order) => {
    const payment_method = normalizePaymentMethod(order.payment_method)
    return {
      ...order,
      payment_method,
      gcash_reference: payment_method === 'gcash' ? normalizeGcashReference(order.gcash_reference) : null,
    }
  })
  save(db)
}

function normalizeEmojiValue(value) {
  if (value === undefined || value === null) return null
  const nextValue = String(value).trim()
  return nextValue || null
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

/**
 * Initialize database from Electron file system.
 * Call this once at app startup when running in Electron.
 * In browser mode, this is a no-op (data already loaded from localStorage).
 */
async function initElectronDb() {
  if (!isElectron) return
  try {
    const fileData = await window.electronAPI.db.load()
    if (fileData && typeof fileData === 'object') {
      // Merge file data into in-memory db
      Object.assign(db, fileData)
      _electronDataLoaded = true
      console.log('[Chelsys] Loaded data from Electron file storage')
    } else {
      // No file yet — save current (seeded) db to file
      save(db)
      _electronDataLoaded = true
      console.log('[Chelsys] Created new Electron database from seed data')
    }

    // Also migrate localStorage data to file if it exists and file was empty
    if (!fileData) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const lsData = JSON.parse(raw)
          Object.assign(db, lsData)
          save(db)
          console.log('[Chelsys] Migrated localStorage data to Electron file storage')
        }
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.error('[Chelsys] Failed to load from Electron:', err)
  }
}

// Auto-init if running in Electron
if (isElectron) {
  initElectronDb()
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
      const list = [...db.orders].sort((a, b) => {
        const da = a.created_at || a.order_date || ''
        const db2 = b.created_at || b.order_date || ''
        return new Date(db2) - new Date(da)
      })
      return Promise.resolve(list.slice(0, limit))
    },
    create(data) {
      const payment_method = normalizePaymentMethod(data?.payment_method)
      const row = {
        id: uid(),
        ...data,
        payment_method,
        gcash_reference: payment_method === 'gcash' ? normalizeGcashReference(data?.gcash_reference) : null,
      }
      db.orders.push(row)
      save(db)
      return Promise.resolve(row)
    },
    update(id, data) {
      const i = db.orders.findIndex((o) => o.id === id)
      if (i >= 0) {
        const hasPaymentMethod = Object.prototype.hasOwnProperty.call(data || {}, 'payment_method')
        const nextPaymentMethod = hasPaymentMethod
          ? normalizePaymentMethod(data.payment_method)
          : normalizePaymentMethod(db.orders[i].payment_method)

        const hasGcashRef = Object.prototype.hasOwnProperty.call(data || {}, 'gcash_reference')
        const nextGcashReference = nextPaymentMethod === 'gcash'
          ? normalizeGcashReference(hasGcashRef ? data.gcash_reference : db.orders[i].gcash_reference)
          : null

        db.orders[i] = {
          ...db.orders[i],
          ...data,
          payment_method: nextPaymentMethod,
          gcash_reference: nextGcashReference,
        }
      }
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

    // Cashier: atomically deducts packs and writes a stock log entry.
    consume(itemId, { loggedBy, note, qty = 1 }) {
      db.ingredients = db.ingredients || []
      const i = db.ingredients.findIndex((x) => x.id === itemId)
      if (i < 0) return Promise.reject(new Error('Ingredient not found'))
      const item = db.ingredients[i]
      const oldStock = item.current_stock || 0
      const deduct = Math.max(1, Math.floor(qty))
      deductFIFO(itemId, deduct)
      const newStock = recalculateStock(itemId)
      db.ingredients[i] = { ...item, current_stock: newStock }
      const logEntry = {
        id: uid(),
        itemId,
        itemName: item.name,
        action: 'consumed',
        quantity: -deduct,
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
        details: `${loggedBy} opened ${deduct} pack${deduct > 1 ? 's' : ''} of ${item.name}${note ? ` ⚠️ ${note}` : ''}`,
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
      if (type === 'add') {
        // Add as a new batch (manual adjustment)
        db.stockBatches = db.stockBatches || []
        db.stockBatches.push({
          id: uid(),
          ingredientId: itemId,
          ingredientName: item.name,
          quantity: qty,
          originalQuantity: qty,
          receivedAt: new Date().toISOString(),
          expiryDate: null,
          deliveryId: null,
          poNumber: null,
          supplier: 'Manual Adjustment',
          isExhausted: false,
        })
        newStock = recalculateStock(itemId)
      } else if (type === 'remove') {
        deductFIFO(itemId, qty)
        newStock = recalculateStock(itemId)
      } else if (type === 'set') {
        const target = Math.max(0, qty)
        if (target < oldStock) {
          deductFIFO(itemId, oldStock - target)
        } else if (target > oldStock) {
          db.stockBatches = db.stockBatches || []
          db.stockBatches.push({
            id: uid(),
            ingredientId: itemId,
            ingredientName: item.name,
            quantity: target - oldStock,
            originalQuantity: target - oldStock,
            receivedAt: new Date().toISOString(),
            expiryDate: null,
            deliveryId: null,
            poNumber: null,
            supplier: 'Manual Adjustment',
            isExhausted: false,
          })
        }
        newStock = recalculateStock(itemId)
      }
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

      const createdLogs = []

      // Check per batch (not per ingredient)
      ;(db.stockBatches || [])
        .filter((b) => !b.isExhausted && b.expiryDate)
        .forEach((batch) => {
          const status = getExpiryStatus(batch.expiryDate)
          const formattedDate = formatDateForLog(batch.expiryDate)
          if (!status) return

          if (status.severity === 'critical') {
            const log = createLog({
              action: 'expired',
              ingredientId: batch.ingredientId,
              ingredientName: batch.ingredientName,
              performedBy: 'System',
              details: `${batch.ingredientName} — batch from ${formatDateForLog(batch.receivedAt)} has expired (${batch.quantity} remaining)`,
              newValue: formattedDate,
              severity: 'critical',
            })
            createdLogs.push(log)
          } else if (status.severity === 'warning') {
            const log = createLog({
              action: 'expiring_soon',
              ingredientId: batch.ingredientId,
              ingredientName: batch.ingredientName,
              performedBy: 'System',
              details: `${batch.ingredientName} — batch from ${formatDateForLog(batch.receivedAt)} expiring in ${status.days} days (${batch.quantity} remaining)`,
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
      const row = { id: uid(), ...data, emoji: normalizeEmojiValue(data?.emoji) }
      db.menuItems.push(row)
      save(db)
      return Promise.resolve(row)
    },
    update(id, data) {
      const i = db.menuItems.findIndex((x) => x.id === id)
      const nextData = data && Object.prototype.hasOwnProperty.call(data, 'emoji')
        ? { ...data, emoji: normalizeEmojiValue(data.emoji) }
        : data
      if (i >= 0) db.menuItems[i] = { ...db.menuItems[i], ...nextData }
      save(db)
      return Promise.resolve(db.menuItems[i])
    },
    delete(id) {
      db.menuItems = db.menuItems.filter((x) => x.id !== id)
      save(db)
      return Promise.resolve()
    },
  },

  users: {
    list() {
      return Promise.resolve(
        (db.users || []).map(({ password, ...u }) => u)
      )
    },
    create(data) {
      if (!data?.username?.trim() || !data?.password?.trim() || !data?.full_name?.trim()) {
        return Promise.reject(new Error('Username, password, and full name are required'))
      }
      const exists = db.users.some((u) => u.username === data.username.trim())
      if (exists) return Promise.reject(new Error('Username already exists'))
      const user = {
        id: uid(),
        username: data.username.trim(),
        password: data.password.trim(),
        role: data.role || 'cashier',
        full_name: data.full_name.trim(),
      }
      db.users.push(user)
      save(db)
      const { password, ...safe } = user
      return Promise.resolve(safe)
    },
    update(id, data) {
      const i = db.users.findIndex((u) => u.id === id)
      if (i < 0) return Promise.reject(new Error('User not found'))
      if (data.username) {
        const dup = db.users.some((u) => u.username === data.username.trim() && u.id !== id)
        if (dup) return Promise.reject(new Error('Username already exists'))
        db.users[i].username = data.username.trim()
      }
      if (data.full_name) db.users[i].full_name = data.full_name.trim()
      if (data.password) db.users[i].password = data.password.trim()
      if (data.role) db.users[i].role = data.role
      save(db)
      const { password, ...safe } = db.users[i]
      return Promise.resolve(safe)
    },
    delete(id) {
      const user = db.users.find((u) => u.id === id)
      if (!user) return Promise.reject(new Error('User not found'))
      if (user.role === 'admin' && db.users.filter((u) => u.role === 'admin').length <= 1) {
        return Promise.reject(new Error('Cannot delete the last admin account'))
      }
      db.users = db.users.filter((u) => u.id !== id)
      save(db)
      return Promise.resolve()
    },
  },

  suppliers: {
    list() {
      const names = new Set()
      ;(db.ingredients || []).forEach((i) => { if (i.supplier) names.add(i.supplier) })
      ;(db.purchaseOrders || []).forEach((po) => { if (po.supplier) names.add(po.supplier) })
      ;(db.deliveries || []).forEach((d) => { if (d.supplier) names.add(d.supplier) })
      ;(db.savedSuppliers || []).forEach((s) => names.add(s))
      return Promise.resolve([...names].sort())
    },
    add(name) {
      if (!name || !name.trim()) return Promise.reject(new Error('Supplier name is required'))
      db.savedSuppliers = db.savedSuppliers || []
      const trimmed = name.trim()
      if (!db.savedSuppliers.includes(trimmed)) {
        db.savedSuppliers.push(trimmed)
        save(db)
      }
      return Promise.resolve(trimmed)
    },
    remove(name) {
      db.savedSuppliers = (db.savedSuppliers || []).filter((s) => s !== name)
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
      const ingredientById = new Map((db.ingredients || []).map((item) => [item.id, item]))
      const normalizedItems = (data?.items || []).map((item) => {
        const quantityOrdered = Number(item.quantityOrdered || 0)
        const quantityReceived = Number(item.quantityReceived || 0)
        const ingredientUnit = ingredientById.get(item.ingredientId)?.unit || 'units'
        return {
          ...item,
          unit: item.unit || ingredientUnit,
          quantityOrdered,
          quantityReceived,
          discrepancy: quantityReceived - quantityOrdered,
        }
      })
      const row = {
        id: uid(),
        po_number,
        status: 'pending',
        created_at: new Date().toISOString(),
        ...data,
        items: normalizedItems,
      }
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
      const list = [...(db.deliveries || [])].sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
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

        if (po.status === 'partially_received') {
          return Promise.reject(new Error('Use partial completion flow for partially received POs'))
        }

        const existingPoDeliveries = (db.deliveries || []).filter((delivery) => delivery.purchaseOrderRefId === po.id)
        if (existingPoDeliveries.length >= 1) {
          return Promise.reject(new Error('Initial PO delivery already recorded'))
        }
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

        // Create stock batch for FIFO tracking
        const batchId = uid()
        db.stockBatches = db.stockBatches || []
        db.stockBatches.push({
          id: batchId,
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          quantity: quantityReceived,
          originalQuantity: quantityReceived,
          receivedAt: receivedAt || new Date().toISOString(),
          expiryDate: line.expiry_date || null,
          deliveryId: null,
          _pendingLink: batchId, // temporary tag — replaced with deliveryId below
          poNumber: po?.po_number || null,
          supplier: supplier || po?.supplier || 'supplier',
          isExhausted: false,
        })

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
          unit: line.unit || ingredient.unit || 'units',
          quantityOrdered,
          quantityReceived,
          unitCost: Number(line.unitCost || ingredient.cost_per_unit || 0),
          totalCost: Number(quantityReceived * Number(line.unitCost || ingredient.cost_per_unit || 0)),
          expiry_date: line.expiry_date || null,
          discrepancy,
        })
      })

      if (po) {
        const updatedPoItems = (po.items || []).map((poItem) => {
          const receivedLine = normalizedItems.find((x) => x.ingredientId === poItem.ingredientId)
          const previouslyReceived = Number(poItem.quantityReceived || 0)
          const newlyReceived = Number(receivedLine?.quantityReceived || 0)
          const quantityOrdered = Number(poItem.quantityOrdered || 0)
          const cumulativeReceived = previouslyReceived + newlyReceived
          return {
            ...poItem,
            unit: poItem.unit || receivedLine?.unit || 'units',
            quantityReceived: cumulativeReceived,
            expiry_date: receivedLine?.expiry_date || poItem.expiry_date || null,
            discrepancy: cumulativeReceived - quantityOrdered,
          }
        })
        const stillMissing = updatedPoItems.some((item) => Number(item.quantityReceived || 0) < Number(item.quantityOrdered || 0))
        const status = stillMissing ? 'partially_received' : 'received'

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
        isPartialCompletion: false,
        parentDeliveryId: null,
        totalValue,
        items: normalizedItems,
      }

      // Link batches to this delivery using the temporary tag
      ;(db.stockBatches || []).forEach((b) => {
        if (b._pendingLink) {
          b.deliveryId = row.id
          delete b._pendingLink
        }
      })

      db.deliveries.push(row)
      save(db)
      return Promise.resolve(row)
    },
    completePartial(data) {
      const {
        purchaseOrderId,
        items = [],
        receivedBy = 'Admin',
        notes,
        receivedAt,
      } = data || {}

      db.ingredients = db.ingredients || []
      db.stockLogs = db.stockLogs || []
      db.purchaseOrders = db.purchaseOrders || []
      db.deliveries = db.deliveries || []

      const po = db.purchaseOrders.find((x) => x.id === purchaseOrderId)
      if (!po) return Promise.reject(new Error('PO not found'))
      if (po.status !== 'partially_received') return Promise.reject(new Error('PO is not marked as partially received'))

      const completionExists = (db.deliveries || []).some((delivery) => delivery.purchaseOrderRefId === po.id && delivery.isPartialCompletion)
      if (completionExists) {
        return Promise.reject(new Error('Partial completion already recorded for this PO'))
      }

      const originalPartial = (db.deliveries || []).find((delivery) => delivery.purchaseOrderRefId === po.id && delivery.hasDiscrepancy && !delivery.isPartialCompletion)
      const poItemsByIngredientId = new Map((po.items || []).map((item) => [item.ingredientId, item]))

      const normalizedItems = []

      items.forEach((line) => {
        const ingredientIndex = db.ingredients.findIndex((x) => x.id === line.ingredientId)
        if (ingredientIndex < 0) return

        const ingredient = db.ingredients[ingredientIndex]
        const poItem = poItemsByIngredientId.get(line.ingredientId)
        if (!poItem) return

        const ordered = Number(poItem.quantityOrdered || 0)
        const alreadyReceived = Number(poItem.quantityReceived || 0)
        const missingBefore = Math.max(0, ordered - alreadyReceived)
        const nowReceiving = Math.max(0, Number(line.quantityReceived || 0))
        const safeNowReceiving = Math.min(missingBefore, nowReceiving)
        if (safeNowReceiving <= 0) return

        const oldStock = Number(ingredient.current_stock || 0)
        const newStock = oldStock + safeNowReceiving

        db.ingredients[ingredientIndex] = {
          ...ingredient,
          current_stock: newStock,
          ...(line.expiry_date ? { expiry_date: line.expiry_date } : {}),
        }

        // Create stock batch for FIFO tracking
        const partialBatchId = uid()
        db.stockBatches = db.stockBatches || []
        db.stockBatches.push({
          id: partialBatchId,
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          quantity: safeNowReceiving,
          originalQuantity: safeNowReceiving,
          receivedAt: receivedAt || new Date().toISOString(),
          expiryDate: line.expiry_date || null,
          deliveryId: null,
          _pendingLink: partialBatchId,
          poNumber: po.po_number,
          supplier: po.supplier || 'supplier',
          isExhausted: false,
        })

        db.stockLogs.push({
          id: uid(),
          itemId: ingredient.id,
          itemName: ingredient.name,
          action: 'received',
          quantity: safeNowReceiving,
          note: `Partial completion for ${po.po_number}`,
          loggedBy: receivedBy,
          createdAt: new Date().toISOString(),
        })

        createLog({
          action: 'delivery_received',
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          performedBy: receivedBy,
          details: `Partial completion for ${po.po_number}: received ${safeNowReceiving} ${ingredient.unit}`,
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
            details: `Expiry date updated from partial completion: ${formattedDate}`,
            newValue: formattedDate,
            severity: 'info',
          })
        }

        normalizedItems.push({
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          unit: poItem.unit || ingredient.unit || 'units',
          quantityOrdered: ordered,
          quantityReceived: safeNowReceiving,
          unitCost: Number(poItem.unitCost || ingredient.cost_per_unit || 0),
          totalCost: Number(safeNowReceiving * Number(poItem.unitCost || ingredient.cost_per_unit || 0)),
          expiry_date: line.expiry_date || null,
          discrepancy: (alreadyReceived + safeNowReceiving) - ordered,
        })
      })

      if (normalizedItems.length === 0) {
        return Promise.reject(new Error('No valid remaining items to receive'))
      }

      const updatedPoItems = (po.items || []).map((poItem) => {
        const completionLine = normalizedItems.find((line) => line.ingredientId === poItem.ingredientId)
        const ordered = Number(poItem.quantityOrdered || 0)
        const received = Number(poItem.quantityReceived || 0)
        const cumulativeReceived = completionLine ? (received + Number(completionLine.quantityReceived || 0)) : received
        return {
          ...poItem,
          quantityReceived: cumulativeReceived,
          discrepancy: cumulativeReceived - ordered,
          expiry_date: completionLine?.expiry_date || poItem.expiry_date || null,
        }
      })

      const stillMissing = updatedPoItems.some((item) => Number(item.quantityReceived || 0) < Number(item.quantityOrdered || 0))
      const nextPoStatus = stillMissing ? 'partially_received' : 'received'

      const poIndex = db.purchaseOrders.findIndex((x) => x.id === po.id)
      db.purchaseOrders[poIndex] = {
        ...po,
        status: nextPoStatus,
        received_at: receivedAt || new Date().toISOString(),
        received_by: receivedBy,
        items: updatedPoItems,
      }

      const totalValue = normalizedItems.reduce((sum, row) => sum + Number(row.totalCost || 0), 0)
      const row = {
        id: uid(),
        supplier: po.supplier || 'supplier',
        receivedAt: receivedAt || new Date().toISOString(),
        receivedBy,
        notes: notes || null,
        purchaseOrderId: po.po_number,
        purchaseOrderRefId: po.id,
        hasDiscrepancy: stillMissing,
        isPartialCompletion: true,
        parentDeliveryId: originalPartial?.id || null,
        totalValue,
        items: normalizedItems,
      }

      // Link batches to this delivery using the temporary tag
      ;(db.stockBatches || []).forEach((b) => {
        if (b._pendingLink) {
          b.deliveryId = row.id
          delete b._pendingLink
        }
      })

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

  // ── Stock Batches (FIFO tracking) ────────────────────────────────────────
  stockBatches: {
    list(ingredientId) {
      let batches = [...(db.stockBatches || [])]
      if (ingredientId) batches = batches.filter((b) => b.ingredientId === ingredientId)
      return Promise.resolve(batches.sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt)))
    },
    getActive(ingredientId) {
      const batches = (db.stockBatches || [])
        .filter((b) => b.ingredientId === ingredientId && !b.isExhausted)
        .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt))
      return Promise.resolve(batches)
    },
    getByIngredient(ingredientId) {
      const batches = (db.stockBatches || [])
        .filter((b) => b.ingredientId === ingredientId)
        .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt))
      return Promise.resolve(batches)
    },
  },

  stockLogs: {
    list(limit = 500) {
      const list = [...(db.stockLogs || [])]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      return Promise.resolve(list.slice(0, limit))
    },
    todayConsumed() {
      const today = localDate()
      const list = (db.stockLogs || []).filter(
        (l) => l.action === 'consumed' && l.createdAt && localDate(new Date(l.createdAt)) === today
      )
      // Group by itemName and sum quantities (stored as negative, so negate)
      const grouped = {}
      list.forEach((l) => {
        grouped[l.itemName] = (grouped[l.itemName] || 0) + Math.abs(l.quantity || 1)
      })
      return Promise.resolve(grouped)
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

  // ── Backup & Restore ──────────────────────────────────────────────────────
  backup: {
    exportAll() {
      const data = JSON.parse(JSON.stringify(db))
      // Strip passwords from export for safety display but keep for restore
      const exportData = {
        _meta: {
          appName: 'Chelsy\'s Burger POS',
          exportedAt: new Date().toISOString(),
          version: '0.1.0',
        },
        ...data,
      }
      return Promise.resolve(exportData)
    },
    importAll(jsonData) {
      const currentUser = getStoredUser()
      if (!currentUser || currentUser.role !== 'admin') {
        return Promise.reject(new Error('Admin access required'))
      }
      if (!jsonData || typeof jsonData !== 'object') {
        return Promise.reject(new Error('Invalid backup file'))
      }
      // Validate it has at least some expected keys
      const expectedKeys = ['users', 'orders', 'ingredients', 'menuItems']
      const hasValidStructure = expectedKeys.some((key) => Array.isArray(jsonData[key]))
      if (!hasValidStructure) {
        return Promise.reject(new Error('Backup file does not contain valid Chelsy\'s Burger data'))
      }
      // Remove meta before restoring
      const { _meta, ...restoreData } = jsonData
      // Merge into db
      Object.assign(db, restoreData)
      save(db)
      return Promise.resolve({ itemCount: Object.keys(restoreData).length })
    },
    async getStorageInfo() {
      if (isElectron) {
        const dbPath = await window.electronAPI.db.getPath()
        return { type: 'electron', location: dbPath }
      }
      return { type: 'localStorage', location: 'Browser localStorage' }
    },
  },
}
