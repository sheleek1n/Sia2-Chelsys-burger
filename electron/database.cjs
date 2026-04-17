/**
 * Electron local database — SQLite3 via better-sqlite3.
 * Located at: userData/chelsys-burger.db
 *
 * Replaces the old JSON file storage. Provides ACID transactions,
 * WAL mode for performance, and crash recovery.
 *
 * On first run, automatically migrates from the legacy JSON file
 * (chelsys-burger-data.json) if one exists.
 *
 * Maintains the same load()/save() interface so the renderer's
 * api/index.js needs zero changes.
 */
const { app } = require('electron')
const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const DB_FILENAME = 'chelsys-burger.db'
const OLD_JSON_FILENAME = 'chelsys-burger-data.json'

let _db = null

function getDbPath() {
  return path.join(app.getPath('userData'), DB_FILENAME)
}

// ── Open / create the SQLite database ──────────────────────────────
function getDb() {
  if (_db) return _db

  const dbPath = getDbPath()
  _db = new Database(dbPath)

  // Performance settings
  _db.pragma('journal_mode = WAL')
  _db.pragma('synchronous = NORMAL')
  _db.pragma('foreign_keys = ON')

  // Create tables
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      full_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingredient_categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT,
      order_num INTEGER DEFAULT 99
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT,
      pieces_per_pack INTEGER,
      current_stock REAL DEFAULT 0,
      open_pieces REAL DEFAULT 0,
      warning_level REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      supplier TEXT,
      expiry_date TEXT,
      categoryId INTEGER DEFAULT 7
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      price REAL DEFAULT 0,
      is_available INTEGER DEFAULT 1,
      emoji TEXT,
      image TEXT,
      recipe TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT,
      cashier_name TEXT,
      total_amount REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      gcash_reference TEXT,
      status TEXT DEFAULT 'completed',
      order_date TEXT,
      created_at TEXT,
      items TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT,
      supplier TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      received_at TEXT,
      received_by TEXT,
      items TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      ref TEXT,
      supplier TEXT,
      receivedAt TEXT,
      receivedBy TEXT,
      notes TEXT,
      purchaseOrderId TEXT,
      purchaseOrderRefId TEXT,
      hasDiscrepancy INTEGER DEFAULT 0,
      isPartialCompletion INTEGER DEFAULT 0,
      parentDeliveryId TEXT,
      totalValue REAL DEFAULT 0,
      items TEXT DEFAULT '[]',
      _extra TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS stock_batches (
      id TEXT PRIMARY KEY,
      ingredientId TEXT,
      ingredientName TEXT,
      quantity REAL DEFAULT 0,
      originalQuantity REAL DEFAULT 0,
      receivedAt TEXT,
      expiryDate TEXT,
      deliveryId TEXT,
      poNumber TEXT,
      supplier TEXT,
      isExhausted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stock_logs (
      id TEXT PRIMARY KEY,
      itemId TEXT,
      itemName TEXT,
      action TEXT,
      quantity REAL DEFAULT 0,
      note TEXT,
      loggedBy TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_logs (
      id TEXT PRIMARY KEY,
      createdAt TEXT,
      action TEXT,
      ingredientId TEXT,
      ingredientName TEXT,
      performedBy TEXT,
      details TEXT,
      previousValue TEXT,
      newValue TEXT,
      severity TEXT
    );

    CREATE TABLE IF NOT EXISTS saved_suppliers (
      name TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  return _db
}

// ── Known columns per table (for round-trip fidelity) ──────────────
const DELIVERY_KNOWN_COLS = [
  'id', 'ref', 'supplier', 'receivedAt', 'receivedBy', 'notes',
  'purchaseOrderId', 'purchaseOrderRefId', 'hasDiscrepancy',
  'isPartialCompletion', 'parentDeliveryId', 'totalValue', 'items',
]

// ── Helpers: serialize a row object for INSERT ─────────────────────
function toBool(v) { return v ? 1 : 0 }
function fromBool(v) { return v === 1 || v === true }
function jsonStr(v) { return JSON.stringify(v ?? []) }
function jsonParse(v) { try { return JSON.parse(v || '[]') } catch { return [] } }
function jsonParseObj(v) { try { return JSON.parse(v || '{}') } catch { return {} } }

// ── LOAD: read all tables → assemble the db object ─────────────────
function load() {
  const db = getDb()

  // Check if we have data at all
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c

  if (userCount === 0) {
    // Try migrating from old JSON file
    const migrated = migrateFromJson()
    if (migrated) {
      console.log('[Chelsys DB] Migrated from JSON file to SQLite')
      return migrated
    }
    return null // signals api/index.js to use seed data
  }

  const users = db.prepare('SELECT * FROM users').all()

  const ingredientCategories = db.prepare('SELECT * FROM ingredient_categories').all()
    .map(r => ({ ...r, order: r.order_num }))

  const ingredients = db.prepare('SELECT * FROM ingredients').all()
    .map(r => ({
      ...r,
      pieces_per_pack: r.pieces_per_pack ?? null,
      open_pieces: r.open_pieces ?? 0,
      expiry_date: r.expiry_date ?? null,
    }))

  const menuItems = db.prepare('SELECT * FROM menu_items').all()
    .map(r => ({
      ...r,
      is_available: fromBool(r.is_available),
      emoji: r.emoji ?? null,
      image: r.image ?? null,
      recipe: jsonParse(r.recipe),
    }))

  const orders = db.prepare('SELECT * FROM orders').all()
    .map(r => ({
      ...r,
      gcash_reference: r.gcash_reference ?? null,
      items: jsonParse(r.items),
    }))

  const purchaseOrders = db.prepare('SELECT * FROM purchase_orders').all()
    .map(r => ({
      ...r,
      items: jsonParse(r.items),
    }))

  const deliveries = db.prepare('SELECT * FROM deliveries').all()
    .map(r => {
      const extra = jsonParseObj(r._extra)
      const row = {
        ...extra,
        id: r.id,
        ref: r.ref ?? undefined,
        supplier: r.supplier,
        receivedAt: r.receivedAt,
        receivedBy: r.receivedBy,
        notes: r.notes ?? null,
        purchaseOrderId: r.purchaseOrderId,
        purchaseOrderRefId: r.purchaseOrderRefId ?? null,
        hasDiscrepancy: fromBool(r.hasDiscrepancy),
        isPartialCompletion: fromBool(r.isPartialCompletion),
        parentDeliveryId: r.parentDeliveryId ?? null,
        totalValue: r.totalValue ?? 0,
        items: jsonParse(r.items),
      }
      // Clean up undefined refs
      if (row.ref === null) delete row.ref
      return row
    })

  const stockBatches = db.prepare('SELECT * FROM stock_batches').all()
    .map(r => ({
      ...r,
      isExhausted: fromBool(r.isExhausted),
      expiryDate: r.expiryDate ?? null,
      deliveryId: r.deliveryId ?? null,
      poNumber: r.poNumber ?? null,
    }))

  const stockLogs = db.prepare('SELECT * FROM stock_logs').all()
    .map(r => ({
      ...r,
      note: r.note ?? null,
    }))

  const inventoryLogs = db.prepare('SELECT * FROM inventory_logs').all()
    .map(r => ({
      ...r,
      ingredientId: r.ingredientId ?? null,
      ingredientName: r.ingredientName ?? null,
      previousValue: r.previousValue ?? null,
      newValue: r.newValue ?? null,
    }))

  const savedSuppliers = db.prepare('SELECT name FROM saved_suppliers').all()
    .map(r => r.name)

  const metaRows = db.prepare('SELECT key, value FROM meta').all()
  const meta = metaRows.reduce((acc, row) => {
    try {
      acc[row.key] = JSON.parse(row.value)
    } catch {
      acc[row.key] = row.value
    }
    return acc
  }, {})

  return {
    users,
    orders,
    ingredients,
    ingredientCategories,
    menuItems,
    purchaseOrders,
    deliveries,
    stockBatches,
    stockLogs,
    inventoryLogs,
    savedSuppliers,
    meta,
  }
}

// ── SAVE: write the db object → SQLite tables (in a transaction) ───
function save(data) {
  const db = getDb()

  const saveTransaction = db.transaction((d) => {
    // ── Users ──
    db.prepare('DELETE FROM users').run()
    const insertUser = db.prepare(
      'INSERT INTO users (id, username, password, role, full_name) VALUES (?, ?, ?, ?, ?)'
    )
    for (const u of d.users || []) {
      insertUser.run(u.id, u.username, u.password, u.role, u.full_name)
    }

    // ── Ingredient Categories ──
    db.prepare('DELETE FROM ingredient_categories').run()
    const insertCat = db.prepare(
      'INSERT INTO ingredient_categories (id, name, emoji, order_num) VALUES (?, ?, ?, ?)'
    )
    for (const c of d.ingredientCategories || []) {
      insertCat.run(Number(c.id), c.name, c.emoji ?? null, c.order ?? c.order_num ?? 99)
    }

    // ── Ingredients ──
    db.prepare('DELETE FROM ingredients').run()
    const insertIng = db.prepare(
      `INSERT INTO ingredients (id, name, unit, pieces_per_pack, current_stock, open_pieces,
        warning_level, cost_per_unit, supplier, expiry_date, categoryId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const i of d.ingredients || []) {
      insertIng.run(
        i.id, i.name, i.unit ?? null, i.pieces_per_pack ?? null,
        i.current_stock ?? 0, i.open_pieces ?? 0,
        i.warning_level ?? 0, i.cost_per_unit ?? 0,
        i.supplier ?? null, i.expiry_date ?? null,
        i.categoryId ?? 7
      )
    }

    // ── Menu Items ──
    db.prepare('DELETE FROM menu_items').run()
    const insertMenu = db.prepare(
      `INSERT INTO menu_items (id, name, category, price, is_available, emoji, image, recipe)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const m of d.menuItems || []) {
      insertMenu.run(
        m.id, m.name, m.category ?? 'other', m.price ?? 0,
        toBool(m.is_available), m.emoji ?? null, m.image ?? null,
        jsonStr(m.recipe)
      )
    }

    // ── Orders ──
    db.prepare('DELETE FROM orders').run()
    const insertOrder = db.prepare(
      `INSERT INTO orders (id, order_number, cashier_name, total_amount, payment_method,
        gcash_reference, status, order_date, created_at, items)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const o of d.orders || []) {
      insertOrder.run(
        o.id, o.order_number ?? null, o.cashier_name ?? null,
        o.total_amount ?? 0, o.payment_method ?? 'cash',
        o.gcash_reference ?? null, o.status ?? 'completed',
        o.order_date ?? null, o.created_at ?? null,
        jsonStr(o.items)
      )
    }

    // ── Purchase Orders ──
    db.prepare('DELETE FROM purchase_orders').run()
    const insertPO = db.prepare(
      `INSERT INTO purchase_orders (id, po_number, supplier, status, notes,
        created_at, updated_at, received_at, received_by, items)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const po of d.purchaseOrders || []) {
      insertPO.run(
        po.id, po.po_number ?? null, po.supplier ?? null,
        po.status ?? 'pending', po.notes ?? null,
        po.created_at ?? null, po.updated_at ?? null,
        po.received_at ?? null, po.received_by ?? null,
        jsonStr(po.items)
      )
    }

    // ── Deliveries ──
    db.prepare('DELETE FROM deliveries').run()
    const insertDel = db.prepare(
      `INSERT INTO deliveries (id, ref, supplier, receivedAt, receivedBy, notes,
        purchaseOrderId, purchaseOrderRefId, hasDiscrepancy, isPartialCompletion,
        parentDeliveryId, totalValue, items, _extra)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const del of d.deliveries || []) {
      // Capture any extra fields not in the known columns
      const extra = {}
      for (const key of Object.keys(del)) {
        if (!DELIVERY_KNOWN_COLS.includes(key)) {
          extra[key] = del[key]
        }
      }
      insertDel.run(
        del.id, del.ref ?? null, del.supplier ?? null,
        del.receivedAt ?? null, del.receivedBy ?? null,
        del.notes ?? null, del.purchaseOrderId ?? null,
        del.purchaseOrderRefId ?? null, toBool(del.hasDiscrepancy),
        toBool(del.isPartialCompletion), del.parentDeliveryId ?? null,
        del.totalValue ?? 0, jsonStr(del.items),
        JSON.stringify(extra)
      )
    }

    // ── Stock Batches ──
    db.prepare('DELETE FROM stock_batches').run()
    const insertBatch = db.prepare(
      `INSERT INTO stock_batches (id, ingredientId, ingredientName, quantity,
        originalQuantity, receivedAt, expiryDate, deliveryId, poNumber, supplier, isExhausted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const b of d.stockBatches || []) {
      insertBatch.run(
        b.id, b.ingredientId, b.ingredientName ?? null,
        b.quantity ?? 0, b.originalQuantity ?? 0,
        b.receivedAt ?? null, b.expiryDate ?? null,
        b.deliveryId ?? null, b.poNumber ?? null,
        b.supplier ?? null, toBool(b.isExhausted)
      )
    }

    // ── Stock Logs ──
    db.prepare('DELETE FROM stock_logs').run()
    const insertStockLog = db.prepare(
      `INSERT INTO stock_logs (id, itemId, itemName, action, quantity, note, loggedBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const l of d.stockLogs || []) {
      insertStockLog.run(
        l.id, l.itemId ?? null, l.itemName ?? null,
        l.action ?? null, l.quantity ?? 0,
        l.note ?? null, l.loggedBy ?? null, l.createdAt ?? null
      )
    }

    // ── Inventory Logs ──
    db.prepare('DELETE FROM inventory_logs').run()
    const insertInvLog = db.prepare(
      `INSERT INTO inventory_logs (id, createdAt, action, ingredientId, ingredientName,
        performedBy, details, previousValue, newValue, severity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const l of d.inventoryLogs || []) {
      insertInvLog.run(
        l.id, l.createdAt ?? null, l.action ?? null,
        l.ingredientId ?? null, l.ingredientName ?? null,
        l.performedBy ?? null, l.details ?? null,
        l.previousValue ?? null, l.newValue ?? null,
        l.severity ?? null
      )
    }

    // ── Saved Suppliers ──
    db.prepare('DELETE FROM saved_suppliers').run()
    const insertSupplier = db.prepare('INSERT INTO saved_suppliers (name) VALUES (?)')
    for (const s of d.savedSuppliers || []) {
      insertSupplier.run(s)
    }

    // ── Meta ──
    db.prepare('DELETE FROM meta').run()
    const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)')
    for (const [key, value] of Object.entries(d.meta || {})) {
      insertMeta.run(key, JSON.stringify(value))
    }
  })

  try {
    saveTransaction(data)
  } catch (err) {
    console.error('[Chelsys DB] Failed to save to SQLite:', err.message)
  }
}

// ── Migration from legacy JSON file ────────────────────────────────
function migrateFromJson() {
  const jsonPath = path.join(app.getPath('userData'), OLD_JSON_FILENAME)
  try {
    if (!fs.existsSync(jsonPath)) return null

    const raw = fs.readFileSync(jsonPath, 'utf-8')
    const jsonData = JSON.parse(raw)
    if (!jsonData || typeof jsonData !== 'object') return null

    // Write to SQLite
    save(jsonData)

    // Rename old file as backup
    const backupPath = jsonPath + '.migrated-to-sqlite.bak'
    try { fs.renameSync(jsonPath, backupPath) } catch { /* ignore */ }

    console.log('[Chelsys DB] Migrated legacy JSON data to SQLite')
    console.log('[Chelsys DB] Old file renamed to:', backupPath)

    // Return the data so api/index.js can use it
    return jsonData
  } catch (err) {
    console.error('[Chelsys DB] Failed to migrate from JSON:', err.message)
    return null
  }
}

// ── Cleanup on app exit ────────────────────────────────────────────
function close() {
  if (_db) {
    try { _db.close() } catch { /* ignore */ }
    _db = null
  }
}

module.exports = { load, save, getDbPath, close }
