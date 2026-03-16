/**
 * Stub API that mimics base44 - stores data in memory + localStorage
 * Replace with Electron IPC + SQLite when building the desktop app.
 */

const STORAGE_KEY = 'chelsys_burger_data'

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return {
    users: [
      { id: '1', username: 'admin', password_hash: 'admin', role: 'admin', full_name: 'Admin User' },
    ],
    orders: [],
    ingredients: [],
    menuItems: [],
    purchaseOrders: [],
    deliveries: [],
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (_) {}
}

let store = loadStore()

function nextId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// Auth stub
const currentUserKey = 'chelsys_current_user'
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(currentUserKey)
    return raw ? JSON.parse(raw) : store.users[0]
  } catch (_) {
    return store.users[0]
  }
}
function setCurrentUser(user) {
  if (user) localStorage.setItem(currentUserKey, JSON.stringify(user))
  else localStorage.removeItem(currentUserKey)
}

export const base44 = {
  auth: {
    me() {
      return Promise.resolve(getCurrentUser())
    },
    login({ username, password }) {
      const user = store.users.find(
        (u) => u.username === username && (u.password_hash === password || password === 'admin')
      )
      if (user && user.role === 'admin') {
        setCurrentUser({ ...user, full_name: user.full_name || user.username, role: user.role })
        return Promise.resolve(user)
      }
      return Promise.reject(new Error('Invalid credentials'))
    },
    logout() {
      setCurrentUser(null)
      return Promise.resolve()
    },
  },

  entities: {
    Order: {
      list(_sort = '-order_date', limit = 500) {
        const list = [...(store.orders || [])]
          .sort((a, b) => new Date(b.order_date) - new Date(a.order_date))
        return Promise.resolve(list.slice(0, limit))
      },
      create(data) {
        const id = nextId('ord')
        const row = { id, ...data }
        store.orders = store.orders || []
        store.orders.push(row)
        saveStore(store)
        return Promise.resolve(row)
      },
      update(id, data) {
        const idx = (store.orders || []).findIndex((o) => o.id === id)
        if (idx >= 0) {
          store.orders[idx] = { ...store.orders[idx], ...data }
          saveStore(store)
        }
        return Promise.resolve(store.orders[idx])
      },
      delete(id) {
        store.orders = (store.orders || []).filter((o) => o.id !== id)
        saveStore(store)
        return Promise.resolve()
      },
    },

    Ingredient: {
      list() {
        return Promise.resolve([...(store.ingredients || [])])
      },
      create(data) {
        const id = nextId('ing')
        const row = { id, ...data }
        store.ingredients = store.ingredients || []
        store.ingredients.push(row)
        saveStore(store)
        return Promise.resolve(row)
      },
      update(id, data) {
        const idx = (store.ingredients || []).findIndex((i) => i.id === id)
        if (idx >= 0) {
          store.ingredients[idx] = { ...store.ingredients[idx], ...data }
          saveStore(store)
        }
        return Promise.resolve(store.ingredients[idx])
      },
      delete(id) {
        store.ingredients = (store.ingredients || []).filter((i) => i.id !== id)
        saveStore(store)
        return Promise.resolve()
      },
    },

    MenuItem: {
      list() {
        return Promise.resolve([...(store.menuItems || [])])
      },
      create(data) {
        const id = nextId('menu')
        const row = { id, ...data }
        store.menuItems = store.menuItems || []
        store.menuItems.push(row)
        saveStore(store)
        return Promise.resolve(row)
      },
      update(id, data) {
        const idx = (store.menuItems || []).findIndex((m) => m.id === id)
        if (idx >= 0) {
          store.menuItems[idx] = { ...store.menuItems[idx], ...data }
          saveStore(store)
        }
        return Promise.resolve(store.menuItems[idx])
      },
      delete(id) {
        store.menuItems = (store.menuItems || []).filter((m) => m.id !== id)
        saveStore(store)
        return Promise.resolve()
      },
    },

    PurchaseOrder: {
      list(_sort = '-created_date', limit = 100) {
        const list = [...(store.purchaseOrders || [])]
          .sort((a, b) => new Date(b.order_date) - new Date(a.order_date))
        return Promise.resolve(list.slice(0, limit))
      },
      create(data) {
        const id = nextId('po')
        const row = { id, ...data }
        store.purchaseOrders = store.purchaseOrders || []
        store.purchaseOrders.push(row)
        saveStore(store)
        return Promise.resolve(row)
      },
      update(id, data) {
        const idx = (store.purchaseOrders || []).findIndex((p) => p.id === id)
        if (idx >= 0) {
          store.purchaseOrders[idx] = { ...store.purchaseOrders[idx], ...data }
          saveStore(store)
        }
        return Promise.resolve(store.purchaseOrders[idx])
      },
      delete(id) {
        store.purchaseOrders = (store.purchaseOrders || []).filter((p) => p.id !== id)
        saveStore(store)
        return Promise.resolve()
      },
    },

    Delivery: {
      list(_sort = '-created_date', limit = 100) {
        const list = [...(store.deliveries || [])]
          .sort((a, b) => new Date(b.delivery_date) - new Date(a.delivery_date))
        return Promise.resolve(list.slice(0, limit))
      },
      create(data) {
        const id = nextId('del')
        const row = { id, ...data }
        store.deliveries = store.deliveries || []
        store.deliveries.push(row)
        saveStore(store)
        return Promise.resolve(row)
      },
      update(id, data) {
        const idx = (store.deliveries || []).findIndex((d) => d.id === id)
        if (idx >= 0) {
          store.deliveries[idx] = { ...store.deliveries[idx], ...data }
          saveStore(store)
        }
        return Promise.resolve(store.deliveries[idx])
      },
      delete(id) {
        store.deliveries = (store.deliveries || []).filter((d) => d.id !== id)
        saveStore(store)
        return Promise.resolve()
      },
    },
  },
}
