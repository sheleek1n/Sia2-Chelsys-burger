import { useState, useEffect } from 'react'
import { api } from '@/api'
import { useAuth } from '@/lib/AuthContext'
import { toast } from 'sonner'
import { UserCog, Plus, Pencil, Trash2, Eye, EyeOff, X } from 'lucide-react'

export default function Settings() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const loadUsers = () => {
    api.users.list().then(setUsers).catch(() => toast.error('Failed to load users')).finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [])

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

      {showModal && (
        <UserModal
          user={editingUser}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadUsers() }}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-sm p-6 mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Account</h3>
            <p className="text-sm text-gray-600 mb-4">
              Remove <strong>{deleteConfirm.full_name}</strong> ({deleteConfirm.username})? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white">
                Delete
              </button>
            </div>
          </div>
        </div>
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
