import { create } from 'zustand'

export const useCashierStore = create((set) => ({
  cashierName: null,
  setCashierName: (name) => set({ cashierName: name }),
  clearCashierName: () => set({ cashierName: null })
}))
