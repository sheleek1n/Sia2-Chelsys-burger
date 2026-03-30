import { create } from 'zustand'

export const useCashierStore = create((set, get) => ({
  username: null,
  displayName: null,
  role: null,
  
  setCashierSession: (username, displayName) => 
    set({ username, displayName, role: 'cashier' }),
  
  setCashierName: (name) => set({ displayName: name }),
  
  // Backward compatibility: return displayName when cashierName is accessed
  get cashierName() {
    return get().displayName
  },
  
  clearCashierSession: () => set({ username: null, displayName: null, role: null }),
  clearCashierName: () => set({ displayName: null })
}))
