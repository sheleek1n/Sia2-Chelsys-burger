import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const DEFAULT_UNCATEGORIZED_ID = 7
const emptyForm = { name: '', unit: '', pieces_per_pack: null, current_stock: 0, open_pieces: 0, warning_level: 0, cost_per_unit: 0, supplier: '', expiry_date: '', categoryId: DEFAULT_UNCATEGORIZED_ID }

export default function IngredientForm({ open, onClose, onSave, initial, categories = [] }) {
  const [form, setForm] = useState(emptyForm)
  const categoriesForSelect = categories.length > 0 ? categories : [{ id: DEFAULT_UNCATEGORIZED_ID, name: 'Uncategorized', emoji: '📦' }]

  useEffect(() => {
    if (initial) setForm({ ...emptyForm, ...initial, expiry_date: initial.expiry_date || '', pieces_per_pack: initial.pieces_per_pack ?? null, categoryId: Number(initial.categoryId ?? DEFAULT_UNCATEGORIZED_ID) })
    else setForm(emptyForm)
  }, [initial, open])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    // open_pieces is managed by POS / Production Log — never editable here.
    // Preserve whatever the system has recorded.
    onSave({
      ...form,
      expiry_date: form.expiry_date || null,
      pieces_per_pack: form.pieces_per_pack || null,
      open_pieces: Number(form.open_pieces || 0),
      categoryId: Number(form.categoryId || DEFAULT_UNCATEGORIZED_ID),
    })
    onClose()
  }

  const ppp = Number(form.pieces_per_pack) || 0
  const isPieceTracked = ppp > 1
  const totalPieces = isPieceTracked
    ? Number(form.current_stock || 0) * ppp + Number(form.open_pieces || 0)
    : null

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
          <div>
            <Label>Category</Label>
            <Select value={String(form.categoryId || DEFAULT_UNCATEGORIZED_ID)} onValueChange={(v) => set('categoryId', Number(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categoriesForSelect.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.emoji} {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="e.g. kg, pack of 10" className="mt-1" />
            </div>
            <div>
              <Label>Pieces per Pack</Label>
              <Input
                type="number"
                value={form.pieces_per_pack || ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => set('pieces_per_pack', e.target.value ? Number(e.target.value) : null)}
                placeholder="Leave blank for non-piece items"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Only for items sold individually (e.g. buns, cheese slices)</p>
            </div>
            <div>
              <Label>Unopened Packs in Storage</Label>
              <Input
                type="number"
                value={form.current_stock}
                onFocus={(e) => e.target.select()}
                onChange={(e) => set('current_stock', Number(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Warn me when packs drop below…</Label>
              <Input
                type="number"
                value={form.warning_level}
                onFocus={(e) => e.target.select()}
                onChange={(e) => set('warning_level', Number(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Cost per Unit (₱)</Label>
              <Input type="number" value={form.cost_per_unit} onFocus={(e) => e.target.select()} onChange={(e) => set('cost_per_unit', Number(e.target.value) || 0)} className="mt-1" />
            </div>
          </div>

          {/* Read-only: open pieces managed by POS / Production Log */}
          {isPieceTracked && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-slate-700">Ready to Use (from opened pack)</span>
                <span className="font-semibold text-slate-900">{form.open_pieces || 0} pcs</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total available</span>
                <span>{totalPieces} pcs ({form.current_stock} unopened × {ppp} + {form.open_pieces || 0} ready)</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Updated automatically every time an order is placed. To change it manually, use <strong>Stock Adjustment</strong>.
              </p>
            </div>
          )}

          <div>
            <Label>Supplier</Label>
            <Input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Expiry Date (optional)</Label>
            <Input type="date" value={form.expiry_date || ''} onChange={(e) => set('expiry_date', e.target.value)} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Leave empty if this item has no expiry date</p>
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
