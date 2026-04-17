import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/api'
import { useAuth } from '@/lib/AuthContext'
import { Plus, PackageCheck, AlertCircle, ShoppingBag, Eye, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { toast } from 'sonner'
import PageHeader from '@/components/shared/PageHeader'
import DeleteConfirmModal from '@/components/shared/DeleteConfirmModal'

// ─── Formatting & Badges ─────────────────────────────────────────────
const formatCurrency = (val) => `₱${Number(val || 0).toFixed(2)}`
const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'MMM d, yyyy') : '-'

const StatusBadge = ({ status }) => {
  const config = {
    pending:   { bg: 'bg-gray-100', text: 'text-gray-700',   label: 'Pending' },
    ordered:   { bg: 'bg-blue-100', text: 'text-blue-700',   label: 'Ordered' },
    partially_received: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Incomplete' },
    received:  { bg: 'bg-green-100', text: 'text-green-700', label: 'Received' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700',     label: 'Cancelled' },
  }
  const c = config[status] || config.pending
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>{c.label}</span>
}

// ─── Create Purchase Order Dialog ────────────────────────────────────
function CreatePODialog({ open, onClose, onSuccess, ingredients, savedSuppliers, onSupplierAdded }) {
  const [supplier, setSupplier] = useState('')
  const [newSupplier, setNewSupplier] = useState('')
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [loading, setLoading] = useState(false)

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setSupplier('')
      setNewSupplier('')
      setShowNewSupplier(false)
      setExpectedDate(format(new Date(), 'yyyy-MM-dd'))
      setNotes('')
      setItems([])
      setSelectedIngredientId('')
    }
  }, [open])

  const handleAddNewSupplier = async () => {
    if (!newSupplier.trim()) return
    await api.suppliers.add(newSupplier.trim())
    setSupplier(newSupplier.trim())
    setNewSupplier('')
    setShowNewSupplier(false)
    if (onSupplierAdded) onSupplierAdded()
    toast.success(`Supplier "${newSupplier.trim()}" saved`)
  }

  const availableIngredients = ingredients.filter(
    (ing) => !items.find((i) => String(i.ingredientId) === String(ing.id))
  )

  const handleSelectNewItem = () => {
    if (!selectedIngredientId) return
    const ing = ingredients.find((x) => String(x.id) === String(selectedIngredientId))
    if (!ing) return
    setItems([...items, { ingredientId: ing.id, name: ing.name, unit: ing.unit || 'units', quantity: 1, unitCost: Number(ing.cost_per_unit) || 0 }])
    setSelectedIngredientId('')
    toast.success(`${ing.name} added`)
  }

  const handleRemoveItem = (idx) => setItems(items.filter((_, i) => i !== idx))
  
  const updateItem = (idx, field, value) => {
    const newItems = [...items]
    if (field === 'quantity') {
      newItems[idx][field] = Math.max(1, Number(value) || 1)
    } else if (field === 'unitCost') {
      newItems[idx][field] = Math.max(0, Number(value) || 0)
    } else {
      newItems[idx][field] = value
    }
    setItems(newItems)
  }

  const grandTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)

  const handleSubmit = async () => {
    if (!supplier || !expectedDate) return toast.error('Please fill in Supplier and Expected Date')
    const validItems = items.filter((x) => x.ingredientId && Number(x.quantity) > 0)
    if (validItems.length === 0) return toast.error('Add at least one valid item')

    setLoading(true)
    try {
      const poItems = validItems.map(row => {
        const ing = ingredients.find(i => i.id === row.ingredientId)
        return {
          ingredientId: row.ingredientId,
          ingredientName: ing?.name || row.name,
          unit: row.unit || ing?.unit || 'units',
          quantityOrdered: Number(row.quantity),
          unitCost: Number(row.unitCost),
          totalCost: Number(row.quantity) * Number(row.unitCost)
        }
      })

      await api.purchaseOrders.create({
        supplier,
        expectedDate,
        notes,
        totalCost: grandTotal,
        items: poItems
      })
      toast.success('Purchase Order created successfully!')
      onSuccess()
      onClose()
    } catch (_err) {
      toast.error('Failed to create PO')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[92vh] flex flex-col min-w-0">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">New Order from Supplier</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1 mt-2 min-h-0 min-w-0">

          {/* Supplier row */}
          <div className="w-full min-w-0">
            <Label className="text-sm font-semibold mb-2 block">Supplier</Label>
            {showNewSupplier ? (
              <div className="w-full min-w-0 space-y-2">
                <Input
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  placeholder="Enter new supplier name..."
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNewSupplier()}
                  autoFocus
                  className="w-full max-w-full h-10"
                />
                <div className="flex w-full flex-col items-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewSupplier(false); setNewSupplier('') }}>Cancel</Button>
                  <Button type="button" size="sm" onClick={handleAddNewSupplier} disabled={!newSupplier.trim()}>Save Supplier</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B01010]/30 focus:border-[#B01010]"
                >
                  <option value="">— Select a supplier —</option>
                  {savedSuppliers.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Button type="button" variant="outline" onClick={() => setShowNewSupplier(true)} className="whitespace-nowrap flex-shrink-0">
                  + New Supplier
                </Button>
              </div>
            )}
          </div>

          {/* Date + Notes row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Expected Delivery Date</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="h-10" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Notes <span className="font-normal text-slate-400">(optional)</span></Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. deliver to back door" className="h-10" />
            </div>
          </div>

          {/* Items table */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Items to Order</Label>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-slate-600 text-left">Item</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600 text-left w-24">Qty</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600 text-left w-28">Unit</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600 text-left w-32">Cost (₱)</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600 text-right w-28">Subtotal</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                        No items yet — select an item below to add it
                      </td>
                    </tr>
                  )}
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-2.5">
                        <Input type="number" min="1" step="1" value={item.quantity} onFocus={(e) => e.target.select()} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="h-8 w-20" />
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{item.unit || 'units'}</td>
                      <td className="px-4 py-2.5">
                        <Input type="number" min="0" step="0.01" value={item.unitCost} onFocus={(e) => e.target.select()} onChange={(e) => updateItem(idx, 'unitCost', e.target.value)} className="h-8 w-24" />
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-700">₱{(item.quantity * item.unitCost).toFixed(2)}</td>
                      <td className="px-2 py-2.5 text-center">
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add item row */}
              <div className="px-4 py-3 bg-slate-50 border-t flex items-center gap-3">
                <select
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                  disabled={availableIngredients.length === 0}
                  className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B01010]/30 disabled:opacity-50"
                >
                  <option value="">{availableIngredients.length === 0 ? 'All items added' : 'Select item to add...'}</option>
                  {availableIngredients.map((ing) => (
                    <option key={ing.id} value={String(ing.id)}>{ing.name}</option>
                  ))}
                </select>
                <Button type="button" variant="outline" onClick={handleSelectNewItem} disabled={!selectedIngredientId} className="h-9 whitespace-nowrap">
                  + Add Item
                </Button>
                <div className="ml-auto text-right whitespace-nowrap">
                  <span className="text-xs text-slate-500">Total</span>
                  <span className="ml-2 text-lg font-bold text-[#B01010]">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="flex justify-end gap-3 pt-4 border-t mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={loading} onClick={handleSubmit} className="bg-[#B01010] hover:bg-[#8A0C0C] px-6">
            {loading ? 'Creating...' : 'Create Order'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Receive Delivery Dialog ─────────────────────────────────────────
function ReceiveDeliveryDialog({ open, onClose, onSuccess, ingredients, activePOs, currentUser, completionPO = null, savedSuppliers, onSupplierAdded }) {
  const [sourceType, setSourceType] = useState('po') // 'po' or 'direct'
  const [selectedPOId, setSelectedPOId] = useState('')
  const [selectedDirectIngredientId, setSelectedDirectIngredientId] = useState('')
  const [supplier, setSupplier] = useState('')
  const [receivedDate, setReceivedDate] = useState('')
  const [notes, setNotes] = useState('')
  
  // Array of { ingredientId, name, qtyOrdered, qtyReceived, unitCost, expiry_date, discrepancy }
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const isCompletingPartial = Boolean(completionPO)
  const openPurchaseOrders = activePOs.filter((p) => ['pending', 'ordered'].includes(p.status))

  // Auto-fill from PO when selected
  useEffect(() => {
    if (isCompletingPartial && completionPO) {
      setSourceType('po')
      setSelectedPOId(completionPO.id)
      setSupplier(completionPO.supplier || '')
      const poItems = Array.isArray(completionPO.items) ? completionPO.items : []
      setItems(poItems
        .map((i) => {
          const qtyOrdered = Number(i.quantityOrdered || 0)
          const qtyReceivedSoFar = Number(i.quantityReceived || 0)
          const stillMissing = Math.max(0, qtyOrdered - qtyReceivedSoFar)
          return {
            ingredientId: i.ingredientId,
            name: i.ingredientName,
            unit: i.unit || 'units',
            qtyOrdered,
            qtyReceivedSoFar,
            stillMissing,
            qtyReceived: stillMissing,
            unitCost: Number(i.unitCost || 0),
            expiry_date: i.expiry_date || null,
            discrepancy: qtyReceivedSoFar - qtyOrdered,
          }
        })
        .filter((item) => item.stillMissing > 0)
      )
      return
    }

    if (sourceType === 'po' && selectedPOId) {
      const po = activePOs.find((p) => p.id === selectedPOId)
      if (po) {
        setSupplier(po.supplier || '')
        const poItems = Array.isArray(po.items) ? po.items : []
        setItems(poItems.map(i => ({
          ingredientId: i.ingredientId,
          name: i.ingredientName,
          unit: i.unit || 'units',
          qtyOrdered: i.quantityOrdered,
          qtyReceived: i.quantityReceived ?? i.quantityOrdered,
          unitCost: i.unitCost,
          expiry_date: i.expiry_date || null,
          discrepancy: (Number(i.quantityReceived ?? i.quantityOrdered) - Number(i.quantityOrdered || 0)),
        })))
      }
    } else if (sourceType === 'direct') {
      setSupplier('')
      setItems([])
      setSelectedDirectIngredientId('')
    }
  }, [sourceType, selectedPOId, activePOs, isCompletingPartial, completionPO])

  const availableDirectIngredients = ingredients.filter(
    (ing) => !items.find((i) => String(i.ingredientId) === String(ing.id))
  )

  const handleSelectDirectItem = () => {
    if (!selectedDirectIngredientId) return
    const ing = ingredients.find((x) => String(x.id) === String(selectedDirectIngredientId))
    if (!ing) return
    setItems([...items, { ingredientId: ing.id, name: ing.name, unit: ing.unit || 'units', qtyOrdered: 0, qtyReceived: 1, unitCost: Number(ing.cost_per_unit) || 0, expiry_date: null, discrepancy: 0 }])
    setSelectedDirectIngredientId('')
    toast.success(`${ing.name} added`)
  }

  useEffect(() => {
    if (open) {
      setSourceType('po')
      setSelectedPOId(completionPO?.id || '')
      setSelectedDirectIngredientId('')
      setSupplier(completionPO?.supplier || '')
      setReceivedDate(format(new Date(), 'yyyy-MM-dd'))
      setNotes('')
      setItems([])
    }
  }, [open, completionPO])

  const grandTotal = items.reduce((sum, item) => sum + (Number(item.qtyReceived) * Number(item.unitCost)), 0)

  const handleDirectItemChange = (idx, field, value) => {
    const newItems = [...items]
    if (field === 'unitCost') {
      newItems[idx][field] = Math.max(0, Number(value) || 0)
    } else if (field === 'qtyReceived') {
      newItems[idx][field] = Math.max(0, Number(value) || 0)
    } else if (field === 'expiry_date') {
      newItems[idx][field] = value || null
    } else {
      newItems[idx][field] = value
    }
    if (field === 'ingredientId') {
      const ing = ingredients.find(i => i.id === value)
      if (ing) {
        newItems[idx].name = ing.name
        newItems[idx].unitCost = Number(ing.cost_per_unit) || 0
      }
    }
    const ordered = Number(newItems[idx].qtyOrdered || 0)
    const received = Number(newItems[idx].qtyReceived || 0)
    newItems[idx].discrepancy = received - ordered
    setItems(newItems)
  }

  const handleSubmit = async () => {
    if (sourceType === 'po' && !selectedPOId) return toast.error('Please select a Purchase Order')
    if (sourceType === 'direct' && !supplier) return toast.error('Please enter a Supplier name')
    
    const validItems = items.filter(x => x.ingredientId && Number(x.qtyReceived) > 0)
    if (validItems.length === 0) return toast.error('Must receive at least one item')

    setLoading(true)
    try {
      const adminName = currentUser?.full_name || 'Admin'
      const deliveryItems = validItems.map(row => ({
        ingredientId: row.ingredientId,
        ingredientName: row.name,
        unit: row.unit || 'units',
        quantityOrdered: Number(row.qtyOrdered) || 0,
        quantityReceived: Number(row.qtyReceived),
        expiry_date: row.expiry_date || null,
        discrepancy: Number(row.qtyReceived) - (Number(row.qtyOrdered) || 0),
        unitCost: Number(row.unitCost),
        totalCost: Number(row.qtyReceived) * Number(row.unitCost)
      }))

      if (isCompletingPartial && completionPO) {
        await api.deliveries.completePartial({
          purchaseOrderId: completionPO.id,
          receivedBy: adminName,
          notes: notes || `Partial completion for ${completionPO.po_number}`,
          receivedAt: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
          items: deliveryItems.map((item) => ({
            ingredientId: item.ingredientId,
            quantityReceived: item.quantityReceived,
            expiry_date: item.expiry_date,
          })),
        })
      } else if (sourceType === 'po') {
        const po = activePOs.find(p => p.id === selectedPOId)
        await api.deliveries.receive({
          sourceType: 'po',
          purchaseOrderId: po.id,
          supplier: po.supplier,
          receivedBy: adminName,
          notes,
          receivedAt: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
          items: deliveryItems,
        })

      } else {
        await api.deliveries.receive({
          sourceType: 'direct',
          supplier,
          receivedBy: adminName,
          notes,
          receivedAt: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
          items: deliveryItems,
        })
      }

      toast.success(isCompletingPartial ? '✅ Partial delivery completion saved' : '✅ Delivery recorded — stock updated')
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err?.message || 'Failed to record delivery')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>{isCompletingPartial ? 'Mark as Done' : 'Record Delivery'}</DialogTitle></DialogHeader>
        
        <div className="space-y-6 mt-2 flex-1 overflow-y-auto pr-1">
          {/* Source Toggle */}
          {!isCompletingPartial && (
            <div className="flex gap-4 p-1 bg-slate-100 rounded-lg">
              <button 
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${sourceType === 'po' ? 'bg-white shadow text-[#B01010]' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setSourceType('po')}
              >
                From an existing order
              </button>
              <button 
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${sourceType === 'direct' ? 'bg-white shadow text-[#B01010]' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setSourceType('direct')}
              >
                Walk-in / No order
              </button>
            </div>
          )}

          {isCompletingPartial && completionPO && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
              <p className="text-sm font-semibold text-orange-800">Completing partial delivery for {completionPO.po_number}</p>
              <p className="text-sm text-orange-700">Supplier: {completionPO.supplier}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sourceType === 'po' && !isCompletingPartial && (
              <div className="col-span-2">
                <Label>Select Purchase Order</Label>
                <select
                  value={selectedPOId}
                  onChange={(e) => setSelectedPOId(e.target.value)}
                  disabled={openPurchaseOrders.length === 0}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {openPurchaseOrders.length === 0 ? 'No active POs found' : 'Select an open PO...'}
                  </option>
                  {openPurchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} — {po.supplier} ({formatDate(po.expectedDate)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label>Supplier Name</Label>
              {sourceType === 'po' || isCompletingPartial ? (
                <Input value={supplier} disabled className="mt-1" />
              ) : (
                <Select value={supplier} onValueChange={setSupplier}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {savedSuppliers.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Date Received</Label>
              <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Notes (Optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 2 boxes missing, credit applied" className="mt-1" />
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-slate-50 border rounded-xl overflow-visible">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[700px]">
                <thead className="bg-slate-100 border-b">
                  <tr>
                    <th className="px-3 py-2 font-medium min-w-[200px]">Inventory Item</th>
                    {sourceType === 'po' && !isCompletingPartial && <th className="px-3 py-2 font-medium w-36 text-right">Qty Ordered</th>}
                    {isCompletingPartial && <th className="px-3 py-2 font-medium w-36 text-right">Originally Ordered</th>}
                    {isCompletingPartial && <th className="px-3 py-2 font-medium w-36 text-right">Received So Far</th>}
                    {isCompletingPartial && <th className="px-3 py-2 font-medium w-36 text-right text-orange-700">Still Missing</th>}
                    <th className="px-3 py-2 font-medium w-40 border-l-2 border-l-green-200 bg-green-50/50">{isCompletingPartial ? 'Now Receiving' : 'Qty Received'}</th>
                    <th className="px-3 py-2 font-medium w-44">Expiry Date (optional)</th>
                    <th className="px-3 py-2 font-medium w-36 text-right">Unit Cost</th>
                    <th className="px-3 py-2 font-medium w-36 text-right">Line Total</th>
                    {sourceType === 'direct' && <th className="w-12 text-center"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.length === 0 && (
                    <tr><td colSpan={isCompletingPartial ? 9 : (sourceType === 'po' ? 7 : 6)} className="p-4 text-center text-slate-500">No items to receive.</td></tr>
                  )}
                  {items.map((item, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                        {item.name}
                      </td>
                      
                      {sourceType === 'po' && !isCompletingPartial && (
                        <td className="px-3 py-2 text-right font-medium text-slate-500">{item.qtyOrdered} <span className="text-xs text-slate-400">{item.unit || 'units'}</span></td>
                      )}
                      {isCompletingPartial && (
                        <td className="px-3 py-2 text-right font-medium text-slate-500">{item.qtyOrdered} <span className="text-xs text-slate-400">{item.unit || 'units'}</span></td>
                      )}
                      {isCompletingPartial && (
                        <td className="px-3 py-2 text-right font-medium text-slate-500">{item.qtyReceivedSoFar} <span className="text-xs text-slate-400">{item.unit || 'units'}</span></td>
                      )}
                      {isCompletingPartial && (
                        <td className="px-3 py-2 text-right font-semibold text-orange-700">{item.stillMissing} <span className="text-xs text-orange-500">{item.unit || 'units'}</span></td>
                      )}
                      
                      <td className="px-3 py-2 border-l-2 border-l-green-200 bg-green-50/20">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              value={item.qtyReceived}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleDirectItemChange(idx, 'qtyReceived', e.target.value)}
                              className={`h-9 min-w-[80px] font-bold ${sourceType === 'po' && !isCompletingPartial && Number(item.qtyReceived) !== Number(item.qtyOrdered) ? 'text-amber-600 border-amber-300' : 'text-green-700 border-green-300'}`}
                            />
                            <span className="text-xs text-slate-500 whitespace-nowrap">{item.unit || 'units'}</span>
                          </div>
                          {sourceType === 'po' && !isCompletingPartial && Number(item.qtyReceived) !== Number(item.qtyOrdered) && (
                            <p className={`text-[11px] font-medium ${item.discrepancy < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                              {item.discrepancy < 0 ? `Short by ${Math.abs(item.discrepancy)}` : `Over by ${item.discrepancy}`}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="date"
                          value={item.expiry_date || ''}
                          onChange={(e) => handleDirectItemChange(idx, 'expiry_date', e.target.value)}
                          className="h-9 min-w-[150px]"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        {sourceType === 'po' ? formatCurrency(item.unitCost) : (
                          <Input type="number" min="0" value={item.unitCost} onFocus={(e) => e.target.select()} onChange={(e) => handleDirectItemChange(idx, 'unitCost', e.target.value)} className="h-9 min-w-[100px]" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-700 whitespace-nowrap">
                        {formatCurrency(item.qtyReceived * item.unitCost)}
                      </td>
                      {sourceType === 'direct' && (
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-50 border-t flex justify-between items-center">
              {sourceType === 'direct' ? (
                <div className="flex-1 max-w-sm flex gap-2">
                  <select
                    value={selectedDirectIngredientId}
                    onChange={(e) => setSelectedDirectIngredientId(e.target.value)}
                    disabled={availableDirectIngredients.length === 0}
                    className="flex-1 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      {availableDirectIngredients.length === 0 ? 'All inventory items added' : 'Select inventory item...'}
                    </option>
                    {availableDirectIngredients.map((ing) => (
                      <option key={ing.id} value={String(ing.id)}>{ing.name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSelectDirectItem}
                    disabled={!selectedDirectIngredientId || availableDirectIngredients.length === 0}
                    className="h-9"
                  >
                    Add
                  </Button>
                </div>
              ) : <div />}
              <div className="text-right flex items-center gap-4">
                <span className="text-sm text-slate-500">Total Value Received</span>
                <span className="text-xl font-bold bg-green-100 text-green-800 px-3 py-1 rounded-lg">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={loading || items.length===0} onClick={handleSubmit} className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
              <PackageCheck className="w-4 h-4 mr-2" />
              {loading ? 'Processing...' : 'Confirm Delivery'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delivery Detail View Modal ──────────────────────────────────────
function DeliveryDetailModal({ delivery, onClose }) {
  if (!delivery) return null
  return (
    <Dialog open={!!delivery} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Delivery Details</DialogTitle></DialogHeader>
        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="text-slate-500">Reference:</div><div className="font-medium text-right">{delivery.purchaseOrderId || delivery.ref || delivery.id}</div>
            <div className="text-slate-500">Date Received:</div><div className="font-medium text-right">{formatDate(delivery.receivedAt)}</div>
            <div className="text-slate-500">Supplier:</div><div className="font-medium text-right">{delivery.supplier}</div>
            <div className="text-slate-500">Received By:</div><div className="font-medium text-right">{delivery.receivedBy}</div>
            {delivery.notes && (
              <div className="col-span-2 mt-2 p-3 bg-slate-50 rounded-lg border text-slate-700 italic">" {delivery.notes} "</div>
            )}
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Ordered</th>
                  <th className="px-3 py-2 text-right font-medium">Received</th>
                  <th className="px-3 py-2 text-left font-medium">Expiry</th>
                  <th className="px-3 py-2 text-right font-medium">Cost/Unit</th>
                  <th className="px-3 py-2 text-right font-medium">Line Total</th>
                  <th className="px-3 py-2 text-left font-medium">Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {delivery.items?.map((item, i) => (
                  <tr key={i} className={item.discrepancy ? 'bg-amber-50/50' : ''}>
                    <td className="px-3 py-2">{item.ingredientName}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{Number(item.quantityOrdered || 0)} <span className="text-xs text-slate-400">{item.unit || 'units'}</span></td>
                    <td className="px-3 py-2 text-right font-semibold text-green-700">
                      +{item.quantityReceived} <span className="text-xs text-slate-500">{item.unit || 'units'}</span>
                      {item.discrepancy !== 0 && (
                        <span className={`ml-2 text-[11px] font-medium ${item.discrepancy < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                          {item.discrepancy < 0 ? `short ${Math.abs(item.discrepancy)}` : `over ${item.discrepancy}`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{item.expiry_date ? formatDate(item.expiry_date) : '-'}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{formatCurrency(item.unitCost)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.totalCost)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center text-[11px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">Batch tracked</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t">
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-right text-slate-500">Total Value</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(delivery.totalValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Manage Suppliers Modal ──────────────────────────────────────────
function ManageSuppliersModal({ open, onClose, savedSuppliers, onChanged }) {
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    try {
      await api.suppliers.add(newName.trim())
      toast.success(`"${newName.trim()}" added`)
      setNewName('')
      onChanged()
    } catch (err) {
      toast.error(err.message || 'Failed to add supplier')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.suppliers.remove(deleteTarget)
      toast.success(`"${deleteTarget}" removed`)
      setDeleteTarget(null)
      onChanged()
    } catch (err) {
      toast.error(err.message || 'Failed to remove supplier')
      setDeleteTarget(null)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-xl w-[95vw] max-w-sm mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Manage Suppliers</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New supplier name..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B01010]/30 focus:border-[#B01010]"
            />
            <Button type="submit" size="sm" disabled={saving || !newName.trim()}>Add</Button>
          </form>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {savedSuppliers.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No saved suppliers yet</p>
            )}
            {savedSuppliers.map((s) => (
              <div key={s} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group">
                <span className="text-sm text-gray-800">{s}</span>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(s)}
                  className="text-gray-300 hover:text-red-500 group-hover:text-gray-400 transition-colors"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {deleteTarget && (
            <DeleteConfirmModal
              title="Remove Supplier"
              message={<>Remove <strong>{deleteTarget}</strong> from your saved suppliers?</>}
              onConfirm={confirmDelete}
              onCancel={() => setDeleteTarget(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function SupplyChain() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('po')
  const [loading, setLoading] = useState(true)

  const [ingredients, setIngredients] = useState([])
  const [pos, setPos] = useState([])
  const [deliveries, setDeliveries] = useState([])
  
  const [poFilter, setPoFilter] = useState('all') // all, pending, ordered, partially_received, received

  const [createPoOpen, setCreatePoOpen] = useState(false)
  const [receiveDelOpen, setReceiveDelOpen] = useState(false)
  const [viewDelivery, setViewDelivery] = useState(null)
  const [completionPO, setCompletionPO] = useState(null)
  const [manageSuppliersOpen, setManageSuppliersOpen] = useState(false)
  const [savedSuppliers, setSavedSuppliers] = useState([])

  const loadSuppliers = useCallback(() => api.suppliers.list().then(setSavedSuppliers), [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ings, p, d] = await Promise.all([
        api.ingredients.list(),
        api.purchaseOrders.list(),
        api.deliveries.list(),
      ])
      setIngredients(ings)
      setPos(p)
      setDeliveries(d)
      await loadSuppliers()
      setLoading(false)
    } catch (_err) {
      setLoading(false)
      toast.error('Failed to load data')
    }
  }, [loadSuppliers])

  useEffect(() => { loadData() }, [loadData])

  // Action helpers
  const handleOrderStatusUpdate = async (id, status) => {
    await api.purchaseOrders.update(id, { status })
    toast.success(`PO marked as ${status}`)
    loadData()
  }

  // Summary logic
  const stats = useMemo(() => {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    
    return {
      pending: pos.filter(p => p.status === 'pending').length,
      ordered: pos.filter(p => p.status === 'ordered').length,
      receivedMonth: deliveries.filter(d => new Date(d.receivedAt) >= startOfMonth).length
    }
  }, [pos, deliveries])

  const filteredPOs = pos.filter(p => poFilter === 'all' || p.status === poFilter)

  return (
    <div className="flex flex-col h-full gap-4 pb-4">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold">Deliveries</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track supplier orders and incoming stock</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" className="whitespace-nowrap font-semibold text-slate-600 border-slate-200 hover:bg-slate-50" onClick={() => setManageSuppliersOpen(true)}>
            Suppliers
          </Button>
          <Button variant="outline" className="whitespace-nowrap gap-2 font-semibold text-[#B01010] border-[#B01010]/30 hover:bg-[#B01010]/5" onClick={() => setCreatePoOpen(true)}>
            <ShoppingBag className="w-4 h-4" /> New Order
          </Button>
          <Button className="whitespace-nowrap gap-2 font-semibold bg-green-600 hover:bg-green-700" onClick={() => { setCompletionPO(null); setReceiveDelOpen(true) }}>
            <PackageCheck className="w-4 h-4" /> Record Delivery
          </Button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white border rounded-xl px-5 py-4 shadow-sm flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </div>
        </div>
        <div className="bg-white border rounded-xl px-5 py-4 shadow-sm flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">In Transit</p>
            <p className="text-2xl font-bold text-blue-600">{stats.ordered}</p>
          </div>
        </div>
        <div className="bg-white border rounded-xl px-5 py-4 shadow-sm flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-green-50 text-green-600 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Received this month</p>
            <p className="text-2xl font-bold text-green-600">{stats.receivedMonth}</p>
          </div>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 mb-4 space-x-6">
          <TabsTrigger value="po" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#B01010] data-[state=active]:text-[#B01010] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2 font-semibold text-base">
            My Orders
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#B01010] data-[state=active]:text-[#B01010] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2 font-semibold text-base">
            Received
          </TabsTrigger>
        </TabsList>

        <TabsContent value="po" className="m-0 flex-1 flex flex-col outline-none">
          <div className="flex gap-2 mb-4">
            {['all', 'pending', 'ordered', 'partially_received', 'received'].map(opt => (
              <button 
                key={opt}
                onClick={() => setPoFilter(opt)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all capitalize border ${poFilter === opt ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {opt === 'partially_received' ? 'partially received' : opt}
              </button>
            ))}
          </div>

          <div className="bg-white border rounded-xl shadow-sm flex-1 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 border-b sticky top-0 z-10 backdrop-blur-xl">
                <tr>
                  <th className="px-5 py-3 font-semibold text-slate-500">PO #</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Date Created</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Supplier</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Items</th>
                  <th className="px-5 py-3 font-semibold text-slate-500 text-right">Total Cost</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Expected Date</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Status</th>
                  <th className="px-5 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground animate-pulse">Loading orders...</td></tr>}
                {!loading && filteredPOs.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No purchase orders found.</td></tr>}
                {filteredPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 font-bold text-slate-700">
                      <div className="flex items-center gap-2">
                        <span>{po.po_number}</span>
                        {(po.status === 'partially_received' || (po.items || []).some((item) => Number(item.discrepancy || 0) !== 0)) && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700">
                            Discrepancy
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(po.created_at)}</td>
                    <td className="px-5 py-3 font-medium">{po.supplier}</td>
                    <td className="px-5 py-3 text-slate-500">
                      <div className="flex flex-col gap-1">
                        <span>{po.items?.length || 0} items</span>
                        <span className="text-xs text-slate-400">{(po.items || []).map((item) => `${Number(item.quantityOrdered || 0)} ${item.unit || 'units'}`).slice(0, 2).join(', ')}{(po.items || []).length > 2 ? '...' : ''}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">{formatCurrency(po.totalCost)}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(po.expectedDate)}</td>
                    <td className="px-5 py-3"><StatusBadge status={po.status} /></td>
                    <td className="px-5 py-3 whitespace-nowrap text-right">
                      {po.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOrderStatusUpdate(po.id, 'ordered')} className="h-7 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50">Mark Ordered</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOrderStatusUpdate(po.id, 'cancelled')} className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-700">Cancel</Button>
                        </div>
                      )}
                      {po.status === 'ordered' && (
                        <div className="flex justify-end gap-2">
                           {/* Received flow is handled via the Receive Delivery top button now, but we can have a convenience shortcut here if helpful. For now, following exactly the specs, actions are mostly pending->ordered */}
                          <Button variant="outline" size="sm" onClick={() => {
                            setCreatePoOpen(false); 
                            setCompletionPO(null);
                            setReceiveDelOpen(true); 
                            // Could pre-select PO here if we lifted state, but spec says dropdown in dialog is fine.
                          }} className="h-7 text-xs font-semibold text-green-600 border-green-200 hover:bg-green-50">Receive</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOrderStatusUpdate(po.id, 'cancelled')} className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-700">Cancel</Button>
                        </div>
                      )}
                      {po.status === 'partially_received' && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setCompletionPO(po); setReceiveDelOpen(true) }}
                            className="h-7 text-xs font-semibold text-orange-700 border-orange-200 hover:bg-orange-50"
                            disabled={deliveries.some((delivery) => delivery.purchaseOrderRefId === po.id && delivery.isPartialCompletion)}
                          >
                            Mark as Done
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="deliveries" className="m-0 flex-1 flex flex-col outline-none">
          <div className="bg-white border rounded-xl shadow-sm flex-1 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 border-b sticky top-0 z-10 backdrop-blur-xl">
                <tr>
                  <th className="px-5 py-3 font-semibold text-slate-500">Delivery #</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Date Received</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Supplier</th>
                  <th className="px-5 py-3 font-semibold text-slate-500 text-center">Linked PO</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Items</th>
                  <th className="px-5 py-3 font-semibold text-slate-500 text-right">Total Value</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Received By</th>
                  <th className="px-5 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground animate-pulse">Loading deliveries...</td></tr>}
                {!loading && deliveries.length === 0 && <tr><td colSpan={8} className="p-0"><div className="w-full flex flex-col items-center justify-center gap-2 h-64 text-muted-foreground"><PackageCheck className="w-10 h-10 opacity-20" /> No delivery history yet.</div></td></tr>}
                {deliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setViewDelivery(del)}>
                    <td className="px-5 py-3 font-bold text-slate-700">
                      <div className="flex items-center gap-2">
                        <span>{del.id}</span>
                        {del.hasDiscrepancy && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700">Warning</span>
                        )}
                        {del.isPartialCompletion && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-100 text-orange-700">Completion</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(del.receivedAt)}</td>
                    <td className="px-5 py-3 font-medium">{del.supplier}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${del.purchaseOrderId && del.purchaseOrderId !== 'Direct' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{del.purchaseOrderId || 'Direct'}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      <div>{del.items?.length || 0} items ({(del.items || []).reduce((sum, item) => sum + Number(item.quantityReceived || 0), 0)} total)</div>
                      {del.items?.some(item => item.expiry_date) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {del.items.filter(item => item.expiry_date).map((item, i) => {
                            const exp = new Date(`${item.expiry_date}T00:00:00`)
                            const now = new Date()
                            const daysLeft = Math.ceil((exp - now) / 86400000)
                            const color = daysLeft < 0 ? 'bg-red-100 text-red-700' : daysLeft <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-green-50 text-green-700'
                            return (
                              <span key={i} className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium ${color}`}>
                                {item.ingredientName?.split(' ').slice(0, 2).join(' ')}: {formatDate(item.expiry_date)}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-green-700">{formatCurrency(del.totalValue)}</td>
                    <td className="px-5 py-3 text-slate-500">{del.receivedBy}</td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"><Eye className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <CreatePODialog
        open={createPoOpen}
        onClose={() => setCreatePoOpen(false)}
        onSuccess={loadData}
        ingredients={ingredients}
        savedSuppliers={savedSuppliers}
        onSupplierAdded={loadSuppliers}
      />

      <ReceiveDeliveryDialog
        open={receiveDelOpen}
        onClose={() => { setReceiveDelOpen(false); setCompletionPO(null) }}
        onSuccess={loadData}
        ingredients={ingredients}
        activePOs={pos}
        currentUser={user}
        completionPO={completionPO}
        savedSuppliers={savedSuppliers}
        onSupplierAdded={loadSuppliers}
      />

      <DeliveryDetailModal
        delivery={viewDelivery}
        onClose={() => setViewDelivery(null)}
      />

      <ManageSuppliersModal
        open={manageSuppliersOpen}
        onClose={() => setManageSuppliersOpen(false)}
        savedSuppliers={savedSuppliers}
        onChanged={loadSuppliers}
      />
    </div>
  )
}
