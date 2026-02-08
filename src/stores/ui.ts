import { create } from 'zustand'

export type ViewType = 'chat' | 'settings'

interface UIState {
  currentView: ViewType
  setView: (view: ViewType) => void
  toggleSettings: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  currentView: 'chat',
  setView: (currentView) => set({ currentView }),
  toggleSettings: () =>
    set((s) => ({
      currentView: s.currentView === 'settings' ? 'chat' : 'settings',
    })),
}))
