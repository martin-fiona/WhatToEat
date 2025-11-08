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
}))