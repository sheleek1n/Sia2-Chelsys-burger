import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const UNITS = ['kg', 'g', 'liter', 'ml', 'pcs', 'pack']

const emptyForm = { name: '', unit: '', current_stock: 0, warning_level: 0, cost_per_unit: 0, supplier: '' }

export default function IngredientForm({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (initial) setForm({ ...emptyForm, ...initial })
    else setForm(emptyForm)
  }, [initial, open])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    onSave(form)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="e.g. kg, pack of 10" className="mt-1" />
            </div>
            <div>
              <Label>Current Stock</Label>
              <Input type="number" value={form.current_stock} onChange={(e) => set('current_stock', Number(e.target.value) || 0)} className="mt-1" />
            </div>
            <div>
              <Label>Warning Level</Label>
              <Input type="number" value={form.warning_level} onChange={(e) => set('warning_level', Number(e.target.value) || 0)} className="mt-1" />
            </div>
            <div>
              <Label>Cost per Unit (₱)</Label>
              <Input type="number" value={form.cost_per_unit} onChange={(e) => set('cost_per_unit', Number(e.target.value) || 0)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Supplier</Label>
            <Input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} className="mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
