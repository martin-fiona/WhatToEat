import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { loadDishesFromCSV } from '@/utils/dishImporter'
import { Database } from '@/lib/supabase'

type Dish = Database['public']['Tables']['dishes']['Row']

interface DishState {
  dishes: Dish[]
  selectedDishes: string[]
  loading: boolean
  loadDishes: () => Promise<void>
  toggleDish: (dishId: string) => void
  clearSelected: () => void
  generateRandomMenu: (diningCount: number) => void
}

export const useDishStore = create<DishState>((set, get) => ({
  dishes: [],
  selectedDishes: [],
  loading: false,

  loadDishes: async () => {
    set({ loading: true })
    try {
      // 强制清理本地模拟数据库缓存，避免旧分类残留
      try {
        localStorage.removeItem('mock-supabase-db')
        console.log('[DishStore] 清理本地mock数据库缓存完成')
      } catch (e) {
        console.warn('[DishStore] 清理缓存失败或不可用', e)
      }

      const { data, error } = await supabase
        .from('dishes')
        .select('*')
        .order('name')

      if (error) throw error
      // 每次加载都执行一次CSV增量导入，以便用户追加新菜品后自动合并
      await loadDishesFromCSV()
      const { data: reloaded } = await supabase
        .from('dishes')
        .select('*')
        .order('name')
      set({ dishes: reloaded || data || [] })
    } catch (error) {
      console.error('加载菜品失败:', error)
    } finally {
      set({ loading: false })
    }
  },

  toggleDish: (dishId: string) => {
    const { selectedDishes } = get()
    const newSelected = selectedDishes.includes(dishId)
      ? selectedDishes.filter(id => id !== dishId)
      : [...selectedDishes, dishId]
    set({ selectedDishes: newSelected })
  },

  clearSelectedDishes: () => {
    set({ selectedDishes: [] })
  },

  clearSelected: () => {
    set({ selectedDishes: [] })
  },

  generateRandomMenu: (diningCount: number) => {
    const { dishes } = get()
    const menuSize = diningCount + 1
    
    // 分离荤素菜品
    const meatDishes = dishes.filter(dish => dish.is_meat)
    const vegDishes = dishes.filter(dish => !dish.is_meat)
    
    const selected: string[] = []
    
    // 确保荤素搭配
    const meatCount = Math.ceil(menuSize * 0.4) // 40% 荤菜
    const vegCount = menuSize - meatCount
    
    // 随机选择荤菜
    for (let i = 0; i < meatCount && meatDishes.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * meatDishes.length)
      selected.push(meatDishes[randomIndex].id)
      meatDishes.splice(randomIndex, 1)
    }
    
    // 随机选择素菜
    for (let i = 0; i < vegCount && vegDishes.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * vegDishes.length)
      selected.push(vegDishes[randomIndex].id)
      vegDishes.splice(randomIndex, 1)
    }
    
    set({ selectedDishes: selected })
  },
}))