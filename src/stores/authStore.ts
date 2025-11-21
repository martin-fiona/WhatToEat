import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw error
    set({ user: data.user })
    // 登录后恢复云端/本地选择
    try {
      const userId = data.user?.id
      if (userId) {
        await import('@/stores/dishStore').then(m => m.useDishStore.getState().restoreSelected(userId))
        await import('@/stores/shoppingCartStore').then(m => m.useShoppingCartStore.getState().loadCart(userId))
        await import('@/stores/calendarStore').then(m => m.useCalendarStore.getState().loadMealHistory(userId))
        await import('@/stores/calendarStore').then(m => m.useCalendarStore.getState().syncLocalToCloud(userId))
      }
    } catch (e) {
      console.warn('登录后恢复数据失败:', e)
    }
  },
  
  register: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) throw error
    set({ user: data.user })
    // 注册后立即初始化用户选择和购物车为空，避免RLS阻塞首次写入
    try {
      const userId = data.user?.id
      if (userId) {
        await supabase.from('user_selections').upsert({ user_id: userId, dish_ids: [] }, { onConflict: 'user_id' })
        await supabase.from('shopping_cart').upsert({ user_id: userId, ingredients_json: JSON.stringify([]), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      }
    } catch {}
  },
  
  logout: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    set({ user: null })
  },
  
  checkAuth: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    set({ user, loading: false })
    try {
      const userId = user?.id
      if (userId) {
        await import('@/stores/dishStore').then(m => m.useDishStore.getState().restoreSelected(userId))
        await import('@/stores/shoppingCartStore').then(m => m.useShoppingCartStore.getState().loadCart(userId))
        await import('@/stores/calendarStore').then(m => m.useCalendarStore.getState().loadMealHistory(userId))
        await import('@/stores/calendarStore').then(m => m.useCalendarStore.getState().syncLocalToCloud(userId))
      }
    } catch {}
  },
}))
