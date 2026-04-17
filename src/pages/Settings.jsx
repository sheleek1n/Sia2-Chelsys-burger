import { useState, useEffect, useCallback } from 'react'
import { api } from '@/api'
import { useAuth } from '@/lib/AuthContext'
import { toast } from 'sonner'
import { UserCog, Plus, Pencil, Trash2, Eye, EyeOff, X, Download, Upload, AlertTriangle } from 'lucide-react'
import DeleteConfirmModal from '@/components/shared/DeleteConfirmModal'
import { format } from 'date-fns'

export default function Settings() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [storageInfo, setStorageInfo] = useState(null)

  const loadStorageInfo = useCallback(async () => {
    try {
      const info = await api.backup.getStorageInfo()
      setStorageInfo(info)
    } catch { /* ignore */ }
  }, [])

  const loadUsers = () => {
    api.users.list().then(setUsers).catch(() => toast.error('Failed to load users')).finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers(); loadStorageInfo() }, [loadStorageInfo])

  const openAdd = () => {
    setEditingUser(null)
    setShowModal(true)
  }

  const openEdit = (user) => {
    setEditingUser(user)
    setShowModal(true)
  }

  const handleDelete = async (user) => {
    try {
      await api.users.delete(user.id)
      toast.success(`${user.full_name} has been removed`)
      setDeleteConfirm(null)
      loadUsers()
    } catch (err) {
      toast.error(err.message || 'Failed to delete user')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog className="w-5 h-5" /> Manage Accounts
          </h1>
          <p className="text-sm text-gray-500 mt-1">Control who can log in and what they can access</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#B01010] hover:bg-[#8e0d0d] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Role legend */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 text-xs text-gray-600">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <strong>Admin</strong> — full access to all pages
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 text-xs text-gray-600">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <strong>Cashier</strong> — New Order, Order History, Inventory Log only
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Username</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-900">
                  {u.full_name}
                  {u.id === currentUser?.id && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">(you)</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{u.username}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {u.role === 'admin' ? 'Admin' : 'Cashier'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(u)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Data Backup & Restore ───────────────────────────────── */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Data Management</h2>
        <p className="text-sm text-gray-500 mb-4">Backup your data or restore from a previous backup file</p>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Export */}
            <div className="flex-1 border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Download className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-sm text-gray-900">Export Backup</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">Download all data as a JSON file. Keep this safe — it's your full database.</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const data = await api.backup.exportAll()
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `chelsys-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                    toast.success('Backup downloaded')
                  } catch { toast.error('Failed to export') }
                }}
                className="w-full px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >
                Download Backup
              </button>
            </div>

            {/* Import */}
            <div className="flex-1 border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-sm text-gray-900">Restore Backup</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">Upload a backup file to restore. This will <strong>replace</strong> all current data.</p>
              <label className="block">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    e.target.value = ''
                    if (!window.confirm(`Restore from "${file.name}"?\n\nThis will REPLACE all current data. Make sure you have a backup first.`)) return
                    try {
                      const text = await file.text()
                      const jsonData = JSON.parse(text)
                      await api.backup.importAll(jsonData)
                      toast.success('Data restored — reloading...')
                      setTimeout(() => window.location.reload(), 1000)
                    } catch (err) {
                      toast.error(err.message || 'Failed to restore backup')
                    }
                  }}
                />
                <span className="block w-full px-4 py-2 text-sm font-medium text-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer">
                  Upload Backup File
                </span>
              </label>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              {storageInfo?.type === 'sqlite'
                ? <><strong>Storage:</strong> SQLite database — crash-safe, ACID-compliant local storage.<br /><span className="text-amber-600 font-mono text-[10px]">{storageInfo.location}</span></>
                : storageInfo?.type === 'electron'
                  ? <><strong>Storage:</strong> Data is saved to a local file on your computer. Safe from browser cache clears.<br /><span className="text-amber-600 font-mono text-[10px]">{storageInfo.location}</span></>
                  : <><strong>Tip:</strong> Download a backup regularly, especially before clearing browser data. All your data lives in this browser — if the cache is cleared, everything is lost.</>
              }
            </p>
          </div>

          {/* ── Reset to Demo Data ─────────────────────────────────── */}
          <div className="mt-4 border-2 border-red-200 bg-red-50/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h3 className="font-semibold text-sm text-red-800">Reset to Demo Data</h3>
            </div>
            <p className="text-xs text-red-700 mb-3">
              Wipes <strong>all</strong> current data (ingredients, orders, batches, logs) and reloads the fresh demo seed. Use this for testing the system. <strong>This cannot be undone — export a backup first if you need it.</strong>
            </p>
            <button
              onClick={async () => {
                if (!window.confirm('Wipe ALL current data and load fresh demo seed?\n\nThis is irreversible. Make sure you have a backup.')) return
                if (!window.confirm('Final confirmation — proceed with reset?')) return
                try {
                  const summary = await api.backup.resetDemoData()
                  toast.success(`Demo data loaded: ${summary.ingredients} items, ${summary.stockBatches} batches, ${summary.menuItems} menu items — reloading...`)
                  setTimeout(() => window.location.reload(), 1200)
                } catch (err) {
                  toast.error(err?.message || 'Reset failed')
                }
              }}
              className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Reset &amp; Load Demo Data
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <UserModal
          user={editingUser}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadUsers() }}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          title="Delete Account"
          message={<>Remove <strong>{deleteConfirm.full_name}</strong> ({deleteConfirm.username})? This account will be permanently removed.</>}
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

function UserModal({ user, onClose, onSaved }) {
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(user?.role || 'cashier')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)

  const isEdit = !!user

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        const data = { full_name: fullName, username, role }
        if (password) data.password = password
        await api.users.update(user.id, data)
        toast.success('Account updated')
      } else {
        await api.users.create({ full_name: fullName, username, password, role })
        toast.success('Account created')
      }
      onSaved()
    } catch (err) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Edit Account' : 'New Account'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B01010]/30 focus:border-[#B01010]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B01010]/30 focus:border-[#B01010]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isEdit ? 'New Password (leave blank to keep)' : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#B01010]/30 focus:border-[#B01010]"
                required={!isEdit}
                placeholder={isEdit ? '••••••••' : ''}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B01010]/30 focus:border-[#B01010]"
            >
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-[#B01010] hover:bg-[#8e0d0d] text-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
