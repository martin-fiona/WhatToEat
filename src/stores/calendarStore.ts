import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface MealHistory {
  id: string
  user_id: string
  meal_date: string
  dishes: any[]
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  created_at: string
}

interface CalendarState {
  mealHistory: MealHistory[]
  loading: boolean
  loadMealHistory: (userId: string) => Promise<void>
  addMealHistory: (meal: Omit<MealHistory, 'id' | 'created_at'>) => Promise<void>
  deleteMealHistory: (mealId: string) => Promise<void>
  syncLocalToCloud: (userId: string) => Promise<void>
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  mealHistory: [],
  loading: false,

  loadMealHistory: async (userId: string) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('meal_history')
        .select('*')
        .eq('user_id', userId)
        .order('meal_date', { ascending: false })

      if (error) throw error
      
      set({ mealHistory: data || [] })
    } catch (error) {
      console.error('加载用餐历史失败:', error)
    } finally {
      set({ loading: false })
    }
  },

  addMealHistory: async (meal: Omit<MealHistory, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('meal_history')
        .insert([meal])
        .select()
        .single()

      if (error) throw error
      
      const { mealHistory } = get()
      set({ mealHistory: [data, ...mealHistory] })
    } catch (error) {
      console.error('添加用餐历史失败:', error)
      throw error
    }
  },

  deleteMealHistory: async (mealId: string) => {
    try {
      const { error } = await supabase
        .from('meal_history')
        .delete()
        .eq('id', mealId)

      if (error) throw error
      
      const { mealHistory } = get()
      set({ mealHistory: mealHistory.filter(meal => meal.id !== mealId) })
    } catch (error) {
      console.error('删除用餐历史失败:', error)
      throw error
    }
  },

  syncLocalToCloud: async (userId: string) => {
    try {
      const key = `meal_history_${userId}`
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      if (!Array.isArray(arr) || arr.length === 0) return
      const items = arr.map((m: any) => ({
        user_id: userId,
        dish_ids: m.dish_ids,
        meal_date: m.meal_date,
        dishes: m.dishes,
        total_calories: m.total_calories || 0,
        total_protein: m.total_protein || 0,
        total_carbs: m.total_carbs || 0,
        total_fat: m.total_fat || 0,
      }))
      const { error } = await supabase
        .from('meal_history')
        .insert(items)
      if (!error) {
        localStorage.removeItem(key)
        const { mealHistory } = get()
        set({ mealHistory: [...items.map((m, idx) => ({
          id: `synced-${Date.now()}-${idx}`,
          user_id: m.user_id,
          meal_date: m.meal_date,
          dishes: m.dishes,
          total_calories: m.total_calories,
          total_protein: m.total_protein,
          total_carbs: m.total_carbs,
          total_fat: m.total_fat,
          created_at: new Date().toISOString(),
        })), ...mealHistory] })
      }
    } catch {}
  },
}))
