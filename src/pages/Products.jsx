import { useState, useEffect } from 'react'
import { api } from '@/api'
import { Plus, Pencil, Trash2, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import PageHeader from '@/components/shared/PageHeader'
import IngredientForm from '@/components/inventory/IngredientForm'

const CATEGORIES = ['burger', 'sides', 'drinks', 'combo', 'dessert']
const CATEGORY_COLORS = {
  burger: 'bg-orange-100 text-orange-700',
  sides: 'bg-yellow-100 text-yellow-700',
  drinks: 'bg-blue-100 text-blue-700',
  combo: 'bg-purple-100 text-purple-700',
  dessert: 'bg-pink-100 text-pink-700',
}

export default function Products() {
  const [activeTab, setActiveTab] = useState('menu')

  // Menu State
  const [menuItems, setMenuItems] = useState([])
  const [menuFormOpen, setMenuFormOpen] = useState(false)
  const [menuEditing, setMenuEditing] = useState(null)
  const [menuForm, setMenuForm] = useState({ name: '', category: 'burger', price: 0, is_available: true })
  const [menuLoading, setMenuLoading] = useState(true)

  // Inventory State
  const [ingredients, setIngredients] = useState([])
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientFormOpen, setIngredientFormOpen] = useState(false)
  const [ingredientEditing, setIngredientEditing] = useState(null)
  const [ingredientLoading, setIngredientLoading] = useState(true)

  const loadMenu = () => api.menuItems.list().then((i) => { setMenuItems(i); setMenuLoading(false) })
  const loadIngredients = () => api.ingredients.list().then((i) => { setIngredients(i); setIngredientLoading(false) })

  useEffect(() => {
    loadMenu()
    loadIngredients()
  }, [])

  // Menu Handlers
  const openMenuForm = (item = null) => {
    setMenuEditing(item)
    setMenuForm(item ? { ...item } : { name: '', category: 'burger', price: 0, is_available: true })
    setMenuFormOpen(true)
  }

  const handleMenuSave = async () => {
    if (menuEditing) {
      await api.menuItems.update(menuEditing.id, menuForm)
      toast.success('Menu item updated!')
    } else {
      await api.menuItems.create(menuForm)
      toast.success('Menu item added!')
    }
    setMenuFormOpen(false)
    loadMenu()
  }

  const handleMenuDelete = async (id) => {
    await api.menuItems.delete(id)
    toast.success('Deleted!')
    loadMenu()
  }

  const toggleAvailability = async (item) => {
    await api.menuItems.update(item.id, { is_available: !item.is_available })
    loadMenu()
  }

  // Inventory Handlers
  const handleIngredientSave = async (data) => {
    if (ingredientEditing) {
      await api.ingredients.update(ingredientEditing.id, data)
      toast.success('Ingredient updated!')
    } else {
      await api.ingredients.create(data)
      toast.success('Ingredient added!')
    }
    setIngredientEditing(null)
    setIngredientFormOpen(false)
    loadIngredients()
  }

  const handleIngredientDelete = async (id) => {
    await api.ingredients.delete(id)
    toast.success('Deleted!')
    loadIngredients()
  }

  const filteredIngredients = ingredients.filter((i) => i.name?.toLowerCase().includes(ingredientSearch.toLowerCase()))

  const groupedMenu = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = menuItems.filter((i) => i.category === cat)
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader 
        title="Products & Inventory" 
        subtitle="Manage your menu items and inventory stock" 
        action={
          activeTab === 'menu' ? (
            <Button onClick={() => openMenuForm()}> <Plus className="w-4 h-4 mr-2" /> Add Menu Item</Button>
          ) : (
            <Button onClick={() => { setIngredientEditing(null); setIngredientFormOpen(true) }}>
              <Plus className="w-4 h-4 mr-2" /> Add Inventory Item
            </Button>
          )
        }
      />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 mb-4 space-x-6">
          <TabsTrigger 
            value="menu" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
          >
            Menu Items
          </TabsTrigger>
          <TabsTrigger 
            value="inventory" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
          >
            Inventory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="m-0 flex-1 overflow-y-auto outline-none">
          <div className="space-y-6">
            {CATEGORIES.map((cat) => {
              const catItems = groupedMenu[cat] || []
              if (catItems.length === 0) return null
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${CATEGORY_COLORS[cat]}`}>{cat}</span>
                  </div>
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    {catItems.map((item) => (
                      <div key={item.id} className={`bg-card border rounded-xl p-4 shadow-sm ${!item.is_available ? 'opacity-60' : ''}`}>
                        <div className="flex justify-between items-start">
                          <p className="font-semibold">{item.name}</p>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => openMenuForm(item)} className="text-muted-foreground hover:text-primary p-1"><Pencil className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => handleMenuDelete(item.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <p className="text-primary font-bold text-lg mt-1">₱{(item.price || 0).toFixed(2)}</p>
                        <button type="button" onClick={() => toggleAvailability(item)} className={`mt-2 flex items-center gap-1 text-xs ${item.is_available ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {item.is_available ? <><ToggleRight className="w-4 h-4" /> Available</> : <><ToggleLeft className="w-4 h-4" /> Unavailable</>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {!menuLoading && menuItems.length === 0 && <div className="text-center py-16 text-muted-foreground">No menu items yet. Click Add Menu Item to get started.</div>}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="m-0 flex-1 flex flex-col outline-none">
          <div className="mb-4">
            <Input 
              placeholder="Search inventory..." 
              value={ingredientSearch} 
              onChange={(e) => setIngredientSearch(e.target.value)} 
              className="max-w-sm"
            />
          </div>
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Inventory Item</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Unit</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Stock</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Warning Level</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Cost/Unit</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Supplier</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {ingredientLoading && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading...</td></tr>}
                {!ingredientLoading && filteredIngredients.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No inventory items found.</td></tr>}
                {filteredIngredients.map((item) => {
                  const isLow = item.current_stock <= item.warning_level
                  return (
                    <tr key={item.id} className={`border-b last:border-0 hover:bg-muted/10 ${isLow ? 'bg-red-50/50' : ''}`}>
                      <td className="px-5 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          {item.name}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{item.unit}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${isLow ? 'text-red-600' : ''}`}>{item.current_stock}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{item.warning_level}</td>
                      <td className="px-5 py-3 text-right">₱{(item.cost_per_unit || 0).toFixed(2)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{item.supplier || '-'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {isLow ? 'Low Stock' : 'OK'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setIngredientEditing(item); setIngredientFormOpen(true) }} className="text-muted-foreground hover:text-primary">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleIngredientDelete(item.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Menu Dialog */}
      <Dialog open={menuFormOpen} onOpenChange={setMenuFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{menuEditing ? 'Edit Item' : 'Add Menu Item'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={menuForm.name} onChange={(e) => setMenuForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={menuForm.category} onValueChange={(v) => setMenuForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price (₱)</Label>
                <Input type="number" value={menuForm.price} onChange={(e) => setMenuForm((f) => ({ ...f, price: +e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMenuFormOpen(false)}>Cancel</Button>
              <Button onClick={handleMenuSave}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ingredient Dialog */}
      <IngredientForm open={ingredientFormOpen} onClose={() => { setIngredientFormOpen(false); setIngredientEditing(null) }} onSave={handleIngredientSave} initial={ingredientEditing} />
    </div>
  )
}
