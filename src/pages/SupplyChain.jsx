import { useState, useEffect, useMemo } from 'react'
import { api } from '@/api'
import { useAuth } from '@/lib/AuthContext'
import { Plus, PackageCheck, AlertCircle, ShoppingBag, Eye, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { toast } from 'sonner'
import PageHeader from '@/components/shared/PageHeader'

// ─── Formatting & Badges ─────────────────────────────────────────────
const formatCurrency = (val) => `₱${Number(val || 0).toFixed(2)}`
const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'MMM d, yyyy') : '-'

const StatusBadge = ({ status }) => {
  const config = {
    pending:   { bg: 'bg-gray-100', text: 'text-gray-700',   label: 'Pending' },
    ordered:   { bg: 'bg-blue-100', text: 'text-blue-700',   label: 'Ordered' },
    received:  { bg: 'bg-green-100', text: 'text-green-700', label: 'Received' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700',     label: 'Cancelled' },
  }
  const c = config[status] || config.pending
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>{c.label}</span>
}

// ─── Create Purchase Order Dialog ────────────────────────────────────
function CreatePODialog({ open, onClose, onSuccess, ingredients }) {
  const [supplier, setSupplier] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [loading, setLoading] = useState(false)

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setSupplier('')
      setExpectedDate(new Date().toISOString().split('T')[0])
      setNotes('')
      setItems([])
      setSelectedIngredientId('')
    }
  }, [open])

  const availableIngredients = ingredients.filter(
    (ing) => !items.find((i) => String(i.ingredientId) === String(ing.id))
  )

  const handleSelectNewItem = () => {
    if (!selectedIngredientId) return
    const ing = ingredients.find((x) => String(x.id) === String(selectedIngredientId))
    if (!ing) return
    setItems([...items, { ingredientId: ing.id, name: ing.name, quantity: 1, unitCost: Number(ing.cost_per_unit) || 0 }])
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
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
        <div className="space-y-6 mt-2">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Supplier Name</Label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Local Meat Co." className="mt-1" />
            </div>
            <div>
              <Label>Expected Delivery Date</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Notes (Optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. please deliver to back door" className="mt-1" />
            </div>
          </div>

          <div className="bg-slate-50 border rounded-xl overflow-visible">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[600px]">
                <thead className="bg-slate-100 border-b">
                  <tr>
                    <th className="px-3 py-2 font-medium min-w-[200px]">Inventory Item</th>
                    <th className="px-3 py-2 font-medium w-28">Qty</th>
                    <th className="px-3 py-2 font-medium w-36">Unit Cost (₱)</th>
                    <th className="px-3 py-2 font-medium w-36 text-right">Line Total</th>
                    <th className="px-3 py-2 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-500 border-b border-dashed">No items added yet. Select an inventory item below to begin.</td></tr>
                  )}
                  {items.map((item, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                        {item.name}
                      </td>
                      <td className="px-3 py-2"><Input type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="h-9 min-w-[80px]" /></td>
                      <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={item.unitCost} onChange={(e) => updateItem(idx, 'unitCost', e.target.value)} className="h-9 min-w-[100px]" /></td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700 whitespace-nowrap">₱{(item.quantity * item.unitCost).toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 p-1"><X className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-50 border-t flex justify-between items-center">
              <div className="flex-1 max-w-sm flex gap-2">
                <select
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                  disabled={availableIngredients.length === 0}
                  className="flex-1 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {availableIngredients.length === 0 ? 'All inventory items added' : 'Select inventory item...'}
                  </option>
                  {availableIngredients.map((ing) => (
                    <option key={ing.id} value={String(ing.id)}>{ing.name}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSelectNewItem}
                  disabled={!selectedIngredientId || availableIngredients.length === 0}
                  className="h-9"
                >
                  Add
                </Button>
              </div>
              <div className="text-right">
                <span className="text-sm text-slate-500 mr-4">Total Cost</span>
                <span className="text-xl font-bold text-[#B01010]">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={loading} onClick={handleSubmit} className="bg-[#B01010] hover:bg-[#8A0C0C]">
              {loading ? 'Creating...' : 'Create PO'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Receive Delivery Dialog ─────────────────────────────────────────
function ReceiveDeliveryDialog({ open, onClose, onSuccess, ingredients, activePOs, currentUser }) {
  const [sourceType, setSourceType] = useState('po') // 'po' or 'direct'
  const [selectedPOId, setSelectedPOId] = useState('')
  const [selectedDirectIngredientId, setSelectedDirectIngredientId] = useState('')
  const [supplier, setSupplier] = useState('')
  const [receivedDate, setReceivedDate] = useState('')
  const [notes, setNotes] = useState('')
  
  // Array of { ingredientId, name, qtyOrdered, qtyReceived, unitCost }
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const openPurchaseOrders = activePOs.filter((p) => ['pending', 'ordered'].includes(p.status))

  // Auto-fill from PO when selected
  useEffect(() => {
    if (sourceType === 'po' && selectedPOId) {
      const po = activePOs.find(p => p.id === selectedPOId)
      if (po) {
        setSupplier(po.supplier || '')
        const poItems = Array.isArray(po.items) ? po.items : []
        setItems(poItems.map(i => ({
          ingredientId: i.ingredientId,
          name: i.ingredientName,
          qtyOrdered: i.quantityOrdered,
          qtyReceived: i.quantityOrdered, // default to receiving exactly what was ordered
          unitCost: i.unitCost
        })))
      }
    } else if (sourceType === 'direct') {
      setSupplier('')
      setItems([])
      setSelectedDirectIngredientId('')
    }
  }, [sourceType, selectedPOId, activePOs])

  const availableDirectIngredients = ingredients.filter(
    (ing) => !items.find((i) => String(i.ingredientId) === String(ing.id))
  )

  const handleSelectDirectItem = () => {
    if (!selectedDirectIngredientId) return
    const ing = ingredients.find((x) => String(x.id) === String(selectedDirectIngredientId))
    if (!ing) return
    setItems([...items, { ingredientId: ing.id, name: ing.name, qtyOrdered: 0, qtyReceived: 1, unitCost: Number(ing.cost_per_unit) || 0 }])
    setSelectedDirectIngredientId('')
    toast.success(`${ing.name} added`)
  }

  useEffect(() => {
    if (open) {
      setSourceType('po')
      setSelectedPOId('')
      setSelectedDirectIngredientId('')
      setSupplier('')
      setReceivedDate(new Date().toISOString().split('T')[0])
      setNotes('')
      setItems([])
    }
  }, [open])

  const grandTotal = items.reduce((sum, item) => sum + (Number(item.qtyReceived) * Number(item.unitCost)), 0)

  const handleDirectItemChange = (idx, field, value) => {
    const newItems = [...items]
    if (field === 'unitCost') {
      newItems[idx][field] = Math.max(0, Number(value) || 0)
    } else if (field === 'qtyReceived') {
      newItems[idx][field] = Math.max(0, Number(value) || 0)
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
        quantityOrdered: Number(row.qtyOrdered) || 0,
        quantityReceived: Number(row.qtyReceived),
        unitCost: Number(row.unitCost),
        totalCost: Number(row.qtyReceived) * Number(row.unitCost)
      }))

      if (sourceType === 'po') {
        const po = activePOs.find(p => p.id === selectedPOId)
        
        // 1. Mark PO as received (we override api approach to handle partial/custom receive qtys accurately)
        // Wait, the API's `receive` method implicitly takes line item quantity as ordered. 
        // We need to pass the custom quantities from the form instead.
        // Let's manually receive the PO:
        await api.purchaseOrders.update(po.id, {
           status: 'received', 
           received_at: new Date().toISOString(),
           received_by: adminName,
           // Update items array so it reflects exactly what was finally received
           items: po.items.map(poItem => {
             const FormItem = deliveryItems.find(di => di.ingredientId === poItem.ingredientId)
             return { ...poItem, quantityReceived: FormItem ? FormItem.quantityReceived : 0 }
           })
        })

        // 2. Adjust stock for each received item manually to avoid API double-counting
        for (const line of deliveryItems) {
           await api.ingredients.adjust(line.ingredientId, {
             type: 'add',
             qty: line.quantityReceived,
             reason: `PO ${po.po_number} received`,
             loggedBy: adminName
           })
        }

        // 3. Create historical Delivery record
        await api.deliveries.create({
          supplier: po.supplier,
          receivedAt: new Date().toISOString(),
          receivedBy: adminName,
          notes,
          purchaseOrderId: po.po_number,
          totalValue: grandTotal,
          items: deliveryItems
        })

      } else {
        // DIRECT DELIVERY
        // 1. Adjust stock
        for (const line of deliveryItems) {
           await api.ingredients.adjust(line.ingredientId, {
             type: 'add',
             qty: line.quantityReceived,
             reason: `Direct Delivery (${supplier})`,
             loggedBy: adminName
           })
        }
        // 2. Create Delivery record
        const dId = Date.now().toString(36).toUpperCase()
        await api.deliveries.create({
          ref: `DIR-${dId}`,
          supplier,
          receivedAt: new Date().toISOString(),
          receivedBy: adminName,
          notes,
          purchaseOrderId: 'Direct',
          totalValue: grandTotal,
          items: deliveryItems
        })
      }

      toast.success('✅ Delivery recorded — stock updated')
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Failed to record delivery')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader><DialogTitle>Receive Delivery</DialogTitle></DialogHeader>
        
        <div className="space-y-6 mt-2">
          {/* Source Toggle */}
          <div className="flex gap-4 p-1 bg-slate-100 rounded-lg">
            <button 
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${sourceType === 'po' ? 'bg-white shadow text-[#B01010]' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSourceType('po')}
            >
              Against Purchase Order
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${sourceType === 'direct' ? 'bg-white shadow text-[#B01010]' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSourceType('direct')}
            >
              Direct (No PO)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {sourceType === 'po' && (
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
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} disabled={sourceType === 'po'} className="mt-1" />
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
                    {sourceType === 'po' && <th className="px-3 py-2 font-medium w-28 text-right">Qty Ordered</th>}
                    <th className="px-3 py-2 font-medium w-36 border-l-2 border-l-green-200 bg-green-50/50">Qty Received</th>
                    <th className="px-3 py-2 font-medium w-36 text-right">Unit Cost</th>
                    <th className="px-3 py-2 font-medium w-36 text-right">Line Total</th>
                    {sourceType === 'direct' && <th className="w-12 text-center"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.length === 0 && (
                    <tr><td colSpan={6} className="p-4 text-center text-slate-500">No items to receive.</td></tr>
                  )}
                  {items.map((item, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                        {item.name}
                      </td>
                      
                      {sourceType === 'po' && (
                        <td className="px-3 py-2 text-right font-medium text-slate-500">{item.qtyOrdered}</td>
                      )}
                      
                      <td className="px-3 py-2 border-l-2 border-l-green-200 bg-green-50/20">
                        <Input 
                          type="number" min="0" 
                          value={item.qtyReceived} 
                          onChange={(e) => {
                            const newItems = [...items]
                            newItems[idx].qtyReceived = Math.max(0, Number(e.target.value) || 0)
                            setItems(newItems)
                          }} 
                          className={`h-9 min-w-[80px] font-bold ${Number(item.qtyReceived) !== Number(item.qtyOrdered) && sourceType === 'po' ? 'text-amber-600 border-amber-300' : 'text-green-700 border-green-300'}`} 
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        {sourceType === 'po' ? formatCurrency(item.unitCost) : (
                          <Input type="number" min="0" value={item.unitCost} onChange={(e) => handleDirectItemChange(idx, 'unitCost', e.target.value)} className="h-9 min-w-[100px]" />
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
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Delivery Details</DialogTitle></DialogHeader>
        <div className="space-y-4">
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
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Cost/Unit</th>
                  <th className="px-3 py-2 text-right font-medium">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {delivery.items?.map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{item.ingredientName}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-700">+{item.quantityReceived}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{formatCurrency(item.unitCost)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-slate-500">Total Value</td>
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

// ─── Main Page ───────────────────────────────────────────────────────
export default function SupplyChain() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('po')
  const [loading, setLoading] = useState(true)

  const [ingredients, setIngredients] = useState([])
  const [pos, setPos] = useState([])
  const [deliveries, setDeliveries] = useState([])
  
  const [poFilter, setPoFilter] = useState('all') // all, pending, ordered, received

  const [createPoOpen, setCreatePoOpen] = useState(false)
  const [receiveDelOpen, setReceiveDelOpen] = useState(false)
  const [viewDelivery, setViewDelivery] = useState(null)

  const loadData = async () => {
    setLoading(true)
    const [ings, p, d] = await Promise.all([
      api.ingredients.list(),
      api.purchaseOrders.list(),
      api.deliveries.list(),
    ])
    setIngredients(ings)
    setPos(p)
    setDeliveries(d)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

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
      <div className="flex justify-between items-end">
        <PageHeader title="Supply Chain" subtitle="Manage purchase orders and incoming supplier deliveries" />
        <div className="flex gap-3 relative top-[-4px]">
          <Button variant="outline" className="gap-2 font-semibold shadow-sm text-[#B01010] border-[#B01010]/20 hover:bg-[#B01010]/5" onClick={() => setCreatePoOpen(true)}>
            <ShoppingBag className="w-4 h-4" /> Create Purchase Order
          </Button>
          <Button className="gap-2 font-semibold bg-green-600 hover:bg-green-700 shadow-sm" onClick={() => setReceiveDelOpen(true)}>
            <PackageCheck className="w-4 h-4" /> Receive Delivery
          </Button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-4 mb-2">
        <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Pending Orders</p>
            <p className="text-2xl font-bold flex items-center gap-2">
              {stats.pending > 0 && <AlertCircle className="w-5 h-5 text-amber-500" />}
              {stats.pending}
            </p>
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Ordered (In Transit)</p>
            <p className="text-2xl font-bold text-blue-600">{stats.ordered}</p>
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Received This Month</p>
            <p className="text-2xl font-bold text-green-600 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              {stats.receivedMonth}
            </p>
          </div>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 mb-4 space-x-6">
          <TabsTrigger value="po" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#B01010] data-[state=active]:text-[#B01010] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2 font-semibold text-base">
            Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#B01010] data-[state=active]:text-[#B01010] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2 font-semibold text-base">
            Incoming Deliveries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="po" className="m-0 flex-1 flex flex-col outline-none">
          <div className="flex gap-2 mb-4">
            {['all', 'pending', 'ordered', 'received'].map(opt => (
              <button 
                key={opt}
                onClick={() => setPoFilter(opt)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all capitalize border ${poFilter === opt ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {opt}
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
                    <td className="px-5 py-3 font-bold text-slate-700">{po.po_number}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(po.created_at)}</td>
                    <td className="px-5 py-3 font-medium">{po.supplier}</td>
                    <td className="px-5 py-3 text-slate-500">{po.items?.length || 0} items</td>
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
                            setReceiveDelOpen(true); 
                            // Could pre-select PO here if we lifted state, but spec says dropdown in dialog is fine.
                          }} className="h-7 text-xs font-semibold text-green-600 border-green-200 hover:bg-green-50">Receive</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOrderStatusUpdate(po.id, 'cancelled')} className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-700">Cancel</Button>
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
                    <td className="px-5 py-3 font-bold text-slate-700">{del.id}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(del.receivedAt)}</td>
                    <td className="px-5 py-3 font-medium">{del.supplier}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${del.purchaseOrderId && del.purchaseOrderId !== 'Direct' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{del.purchaseOrderId || 'Direct'}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{del.items?.length || 0} items</td>
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
      />
      
      <ReceiveDeliveryDialog
        open={receiveDelOpen}
        onClose={() => setReceiveDelOpen(false)}
        onSuccess={loadData}
        ingredients={ingredients}
        activePOs={pos}
        currentUser={user}
      />

      <DeliveryDetailModal
        delivery={viewDelivery}
        onClose={() => setViewDelivery(null)}
      />
    </div>
  )
}
