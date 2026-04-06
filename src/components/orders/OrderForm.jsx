import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Minus, Trash2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { CATEGORY_ICONS, getMenuItemIcon } from '@/utils/menuItemIcons'

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
]

const CATEGORY_LABELS = {
  all: 'All',
  burger: 'Burgers',
  chicken: 'Chicken',
  sides: 'Sides',
  drinks: 'Drinks',
  combo: 'Combos',
  dessert: 'Desserts',
  snacks: 'Snacks',
  other: 'Other',
}

export default function OrderForm({ menuItems = [], onSubmit, loading }) {
  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [activeCategory, setActiveCategory] = useState('all')
  const [gcashReference, setGcashReference] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [amountTendered, setAmountTendered] = useState('')
  const [notes, setNotes] = useState('')
  const gridTopRef = useRef(null)

  const availableItems = useMemo(
    () => menuItems.filter((item) => item.is_available !== false),
    [menuItems]
  )

  const categories = useMemo(() => {
    const preferredOrder = ['burger', 'chicken', 'sides', 'drinks', 'combo', 'dessert', 'snacks', 'other']
    const available = [...new Set(availableItems.map((m) => m.category).filter(Boolean).map((cat) => cat.toLowerCase()))]
    return [
      ...preferredOrder.filter((cat) => available.includes(cat)),
      ...available.filter((cat) => !preferredOrder.includes(cat)),
    ]
  }, [availableItems])

  useEffect(() => {
    if (activeCategory !== 'all' && !categories.includes(activeCategory)) {
      setActiveCategory('all')
    }
  }, [activeCategory, categories])

  useEffect(() => {
    if (gridTopRef.current) {
      gridTopRef.current.scrollIntoView({ behavior: 'auto', block: 'start' })
    }
  }, [activeCategory])

  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return availableItems
    return availableItems.filter((item) => (item.category || '').toLowerCase() === activeCategory)
  }, [activeCategory, availableItems])

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id)
      if (existing) {
        const newQty = existing.quantity + 1
        return prev.map((c) =>
          c.menu_item_id === item.id ? { ...c, quantity: newQty, subtotal: newQty * c.unit_price } : c
        )
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          menu_item_name: item.name,
          quantity: 1,
          unit_price: item.price,
          subtotal: item.price,
          category: item.category,
          emoji: getMenuItemIcon(item),
        },
      ]
    })
  }

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.menu_item_id !== id) return c
        const newQty = Math.max(1, c.quantity + delta)
        return { ...c, quantity: newQty, subtotal: newQty * c.unit_price }
      })
    )
  }

  const setQtyExact = (id, val) => {
    const num = parseInt(val, 10)
    if (isNaN(num) || num < 0) return // Revert on non-number or negative
    if (num > 999) return // Max 999

    if (num === 0) {
      removeItem(id)
      return
    }

    setCart((prev) =>
      prev.map((c) => {
        if (c.menu_item_id !== id) return c
        return { ...c, quantity: num, subtotal: num * c.unit_price }
      })
    )
  }

  const removeItem = (id) => setCart((prev) => prev.filter((c) => c.menu_item_id !== id))

  const total = cart.reduce((sum, c) => sum + c.subtotal, 0)
  const tenderedAmount = Number(amountTendered)
  const changeAmount = Number.isFinite(tenderedAmount) ? tenderedAmount - total : 0

  const handleSubmit = () => {
    if (cart.length === 0) return

    if (paymentMethod === 'gcash' && !gcashReference.trim()) {
      setPaymentError('Please enter the GCash reference number')
      return
    }

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`
    onSubmit({
      order_number: orderNumber,
      items: cart,
      total_amount: total,
      payment_method: paymentMethod,
      gcash_reference: paymentMethod === 'gcash' ? gcashReference.trim() : null,
      amount_tendered: paymentMethod === 'cash' && amountTendered !== '' ? tenderedAmount : null,
      change_amount: paymentMethod === 'cash' && amountTendered !== '' ? changeAmount : null,
      status: 'completed',
      order_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      notes,
    })
    setCart([])
    setNotes('')
    setGcashReference('')
    setPaymentError('')
    setAmountTendered('')
  }

  return (
    <div className="grid grid-cols-3 gap-6 h-full">
      <div className="col-span-2 space-y-4">
        <div className="overflow-x-auto whitespace-nowrap px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex items-center gap-2">
            {['all', ...categories].map((categoryKey) => (
              <button
                key={categoryKey}
                type="button"
                onClick={() => setActiveCategory(categoryKey)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${activeCategory === categoryKey ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                {CATEGORY_LABELS[categoryKey] || categoryKey}
              </button>
            ))}
          </div>
        </div>

        <div ref={gridTopRef} />

        {activeCategory === 'all' ? (
          categories.map((cat) => {
            const categoryItems = filteredItems.filter((item) => (item.category || '').toLowerCase() === cat)
            if (categoryItems.length === 0) return null

            return (
              <div key={cat}>
                <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="text-xl">{CATEGORY_ICONS[cat] || '🍽️'}</span>
                  <span>{CATEGORY_LABELS[cat] || cat}</span>
                </h3>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {categoryItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="relative bg-card border rounded-xl p-4 min-h-[188px] text-center transition-all group flex flex-col items-center justify-center hover:border-primary hover:shadow-md"
                    >
                      <div className="text-4xl leading-none">
                        {getMenuItemIcon(item)}
                      </div>
                      <p className="font-semibold text-sm mt-4 group-hover:text-primary leading-snug">{item.name}</p>
                      <p className="text-primary font-bold text-base mt-1">₱{item.price.toFixed(2)}</p>
                      <div className="absolute right-3 bottom-3 bg-primary/10 text-primary rounded-full p-1">
                        <Plus className="w-3 h-3" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="relative bg-card border rounded-xl p-4 min-h-[188px] text-center transition-all group flex flex-col items-center justify-center hover:border-primary hover:shadow-md"
              >
                <div className="text-4xl leading-none">
                  {getMenuItemIcon(item)}
                </div>
                <p className="font-semibold text-sm mt-4 group-hover:text-primary leading-snug">{item.name}</p>
                <p className="text-primary font-bold text-base mt-1">₱{item.price.toFixed(2)}</p>
                <div className="absolute right-3 bottom-3 bg-primary/10 text-primary rounded-full p-1">
                  <Plus className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>
        )}

        {availableItems.length > 0 && filteredItems.length === 0 && (
          <div className="text-center text-muted-foreground py-12">No available menu items in this category.</div>
        )}
        {availableItems.length === 0 && (
          <div className="text-center text-muted-foreground py-12">No menu items yet. Add them in Menu Items.</div>
        )}
      </div>

      <div className="flex flex-col bg-card border rounded-xl p-4 gap-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <h3 className="font-bold">Current Order</h3>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {cart.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No items added</p>}
          {cart.map((c) => (
            <div key={c.menu_item_id} className="flex items-center gap-2 py-2 border-b">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.menu_item_name}</p>
                <p className="text-xs text-muted-foreground">₱{c.unit_price} each</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => updateQty(c.menu_item_id, -1)} className="p-1 rounded hover:bg-muted">
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={c.quantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    // We only allow typing positive numbers or empty string
                    if (e.target.value === '' || /^[0-9]+$/.test(e.target.value)) {
                      setQtyExact(c.menu_item_id, e.target.value === '' ? 0 : e.target.value) 
                      // if empty string it sets cart quantity to 0 which calls removeItem if they leave it empty, but allows them to clear the box first
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '') setQtyExact(c.menu_item_id, 1) // restore to 1 if left empty and blurred
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.target.blur()
                  }}
                  className="w-8 text-center text-sm font-bold bg-transparent border border-transparent focus:border-border focus:ring-1 focus:ring-ring rounded select-all"
                />
                <button type="button" onClick={() => updateQty(c.menu_item_id, 1)} className="p-1 rounded hover:bg-muted">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="text-sm font-semibold w-16 text-right">₱{c.subtotal.toFixed(2)}</span>
              <button type="button" onClick={() => removeItem(c.menu_item_id)} className="text-destructive hover:opacity-70">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 space-y-3">
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-primary">₱{total.toFixed(2)}</span>
          </div>
          <div>
            <Label className="text-xs">Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => {
                setPaymentMethod(value)
                setPaymentError('')
                if (value === 'cash') {
                  setGcashReference('')
                } else {
                  setAmountTendered('')
                }
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={`overflow-hidden transition-all duration-200 ${paymentMethod === 'gcash' ? 'max-h-28 opacity-100' : 'max-h-0 opacity-0'}`}>
            <Label className="text-xs">GCash Reference #</Label>
            <Input
              type="text"
              value={gcashReference}
              maxLength={20}
              onChange={(e) => {
                setGcashReference(e.target.value)
                if (paymentError) setPaymentError('')
              }}
              placeholder="Enter reference number"
              className="mt-1"
            />
            {paymentMethod === 'gcash' && paymentError && (
              <p className="text-xs text-red-600 mt-1">{paymentError}</p>
            )}
          </div>
          <div className={`overflow-hidden transition-all duration-200 ${paymentMethod === 'cash' ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
            <Label className="text-xs">Amount Tendered</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amountTendered}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setAmountTendered(e.target.value)}
              placeholder="Enter amount tendered"
              className="mt-1"
            />
            <div className="flex justify-between items-center mt-2 text-sm">
              <span className="text-muted-foreground">Change</span>
              <span className={`font-semibold ${changeAmount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                ₱{Number.isFinite(changeAmount) ? changeAmount.toFixed(2) : '0.00'}
              </span>
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 text-sm" />
          </div>
          <Button className="w-full bg-primary hover:bg-primary/90" disabled={cart.length === 0 || loading} onClick={handleSubmit}>
            {loading ? 'Saving...' : 'Place Order'}
          </Button>
        </div>
      </div>
    </div>
  )
}
