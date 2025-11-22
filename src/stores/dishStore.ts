import { create } from 'zustand'
import { supabase, isMockSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { loadDishesFromCSV, parseDishesFromCSV } from '@/utils/dishImporter'
import { Database } from '@/lib/supabase'

type Dish = Database['public']['Tables']['dishes']['Row']

interface DishState {
  dishes: Dish[]
  selectedDishes: string[]
  loading: boolean
  syncing: boolean
  syncSource: 'cloud' | 'local' | 'none' | 'error'
  loadDishes: () => Promise<void>
  toggleDish: (dishId: string) => void
  clearSelectedDishes: () => void
  clearSelected: () => void
  generateRandomMenu: (diningCount: number) => void
  restoreSelected: (userId?: string) => void
}

export const useDishStore = create<DishState>((set, get) => ({
  dishes: [],
  selectedDishes: [],
  loading: false,
  syncing: false,
  syncSource: 'none',

  restoreSelected: async (userId?: string) => {
    try {
      if (!userId) return
      set({ syncing: true })
      // 优先从云端读取
      const { data, error } = await supabase
        .from('user_selections')
        .select('dish_ids')
        .eq('user_id', userId)
        .single()

      // 读取本地缓存，作为可能的上云来源
      const key = `selected_dishes_${userId}`
      const raw = localStorage.getItem(key)
      const localParsed = raw ? JSON.parse(raw) : null

      // 情况1：云端有数据
      if (!error && data && Array.isArray(data.dish_ids)) {
        const cloudIds = (data.dish_ids as string[]) || []
        // 如果云端为空但本地有非空数据，则将本地数据上云，避免一直显示“本地缓存”
        if (cloudIds.length === 0 && Array.isArray(localParsed) && localParsed.length > 0) {
          try {
            const { error: upErr } = await supabase
              .from('user_selections')
              .upsert({ user_id: userId, dish_ids: localParsed, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
            if (!upErr) {
              set({ selectedDishes: localParsed, syncSource: 'cloud' })
              localStorage.setItem(key, JSON.stringify(localParsed))
              set({ syncing: false })
              return
            }
          } catch {}
        }
        // 正常使用云端数据
        set({ selectedDishes: cloudIds, syncSource: 'cloud' })
        localStorage.setItem(key, JSON.stringify(cloudIds))
        set({ syncing: false })
        return
      }

      // 情况2：云端没有或查询出错，回退到本地缓存；若本地有数据则自动上云
      if (Array.isArray(localParsed)) {
        set({ selectedDishes: localParsed, syncSource: 'local' })
        try {
          const { error: upErr } = await supabase
            .from('user_selections')
            .upsert({ user_id: userId, dish_ids: localParsed, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          if (!upErr) {
            set({ syncSource: 'cloud' })
          }
        } catch {}
      } else {
        // 没有任何数据，初始化为空到云端，避免后续 upsert 冲突
        try {
          await supabase
            .from('user_selections')
            .upsert({ user_id: userId, dish_ids: [], updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        } catch {}
        set({ selectedDishes: [], syncSource: 'none' })
      }
    } catch (e) {
      console.warn('恢复选择失败:', e)
      set({ syncSource: 'error' })
    } finally {
      set({ syncing: false })
    }
  },

  loadDishes: async () => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('dishes')
        .select('*')
        .order('name')

      // 如果云端读取报错，直接走 CSV 回退（仅展示，不写入云端）
      if (error) {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}recipes.csv`)
          const csvContent = await response.text()
          const parsed = await parseDishesFromCSV(csvContent)
          const fallbackRows = parsed.map((d: any) => ({
            id: `csv-${encodeURIComponent(d.name)}`,
            name: d.name,
            category: d.category,
            image_url: d.image_url,
            ingredients: d.ingredients,
            cooking_steps: d.cooking_steps,
            calories: d.calories,
            protein: d.protein,
            carbs: d.carbs,
            fat: d.fat,
            is_meat: d.is_meat,
            created_at: new Date().toISOString(),
          }))
          set({ dishes: fallbackRows })
        } catch (e) {
          console.warn('CSV 回退加载失败:', e)
          set({ dishes: [] })
        }
        return
      }

      // 本地模拟环境：允许增量导入并再次读取
      if (isMockSupabase) {
        await loadDishesFromCSV()
        const { data: reloaded } = await supabase
          .from('dishes')
          .select('*')
          .order('name')
        set({ dishes: reloaded || data || [] })
        return
      }

      // 云端环境：若数据库为空，回退到 CSV 数据（仅用于展示，不写入云端）
      if (!data || data.length === 0) {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}recipes.csv`)
          const csvContent = await response.text()
          const parsed = await parseDishesFromCSV(csvContent)
          const fallbackRows = parsed.map((d: any) => ({
            id: `csv-${encodeURIComponent(d.name)}`,
            name: d.name,
            category: d.category,
            image_url: d.image_url,
            ingredients: d.ingredients,
            cooking_steps: d.cooking_steps,
            calories: d.calories,
            protein: d.protein,
            carbs: d.carbs,
            fat: d.fat,
            is_meat: d.is_meat,
            created_at: new Date().toISOString(),
          }))
          set({ dishes: fallbackRows })
        } catch (e) {
          console.warn('CSV 回退加载失败:', e)
          set({ dishes: [] })
        }
        return
      }

      // 云端环境：正常读取数据 + 合并用户自定义菜品（云端 + 本地回退）
      let merged = data || []
      try {
        const userId = useAuthStore.getState().user?.id
        if (userId) {
          const { data: userDishes, error: userErr } = await supabase
            .from('user_dishes')
            .select('*')
            .eq('user_id', userId)
            .order('name')
          const cloudNormalized = Array.isArray(userDishes) ? userDishes.map((d: any) => ({
            id: d.id,
            name: d.name,
            category: d.category,
            image_url: d.image_url,
            ingredients: d.ingredients || '',
            cooking_steps: d.cooking_steps || null,
            calories: d.calories ?? null,
            protein: d.protein ?? null,
            carbs: d.carbs ?? null,
            fat: d.fat ?? null,
            is_meat: d.category === '荤菜' || d.category === '半荤',
            created_at: d.created_at,
          })) : []

          // 读取本地回退数据
          const localKey = `user_dishes_${userId}`
          let localNormalized: any[] = []
          try {
            const raw = localStorage.getItem(localKey)
            const arr = raw ? JSON.parse(raw) : []
            if (Array.isArray(arr)) {
              localNormalized = arr.map((d: any) => ({
                id: d.id,
                name: d.name,
                category: d.category,
                image_url: d.image_url,
                ingredients: d.ingredients || '',
                cooking_steps: d.cooking_steps || null,
                calories: d.calories ?? null,
                protein: d.protein ?? null,
                carbs: d.carbs ?? null,
                fat: d.fat ?? null,
                is_meat: d.category === '荤菜' || d.category === '半荤',
                created_at: d.created_at,
              }))
            }
          } catch {}

          // 合并顺序：本地优先显示，再云端，再系统菜品
          merged = [...localNormalized, ...cloudNormalized, ...merged]
        }
      } catch {}

      // 预览环境：在云端已有菜品的情况下，额外合并 CSV 中新增的菜品用于展示（不写入云端）
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}recipes.csv`)
        const csvContent = await response.text()
        const parsed = await parseDishesFromCSV(csvContent)
        const existingNames = new Set(merged.map((d: any) => d.name))
        const extraRows = parsed
          .filter((d: any) => d && d.name && !existingNames.has(d.name))
          .map((d: any) => ({
            id: `csv-${encodeURIComponent(d.name)}`,
            name: d.name,
            category: d.category,
            image_url: d.image_url,
            ingredients: d.ingredients || '',
            cooking_steps: d.cooking_steps || null,
            calories: d.calories ?? null,
            protein: d.protein ?? null,
            carbs: d.carbs ?? null,
            fat: d.fat ?? null,
            is_meat: d.category === '荤菜' || d.category === '半荤',
            created_at: new Date().toISOString(),
          }))
        if (extraRows.length > 0) {
          merged = [...extraRows, ...merged]
        }
      } catch {}
      set({ dishes: merged })
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
    try {
      const userId = useAuthStore.getState().user?.id
      if (userId) {
        const key = `selected_dishes_${userId}`
        localStorage.setItem(key, JSON.stringify(newSelected))
        // 同步到云端
        set({ syncing: true })
        supabase
          .from('user_selections')
          .upsert({
            user_id: userId,
            dish_ids: newSelected,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
          .select('user_id, updated_at')
          .single()
          .then(({ data, error }: any) => {
            if (error) {
              console.warn('云端同步失败:', error)
              set({ syncSource: 'local' })
              return
            }
            if (data && data.user_id === userId) {
              set({ syncSource: 'cloud' })
              localStorage.setItem(key, JSON.stringify(newSelected))
            } else {
              set({ syncSource: 'local' })
            }
          })
          .finally(() => set({ syncing: false }))
      }
    } catch {}
  },

  clearSelectedDishes: () => {
    set({ selectedDishes: [] })
    try {
      const userId = useAuthStore.getState().user?.id
      if (userId) {
        const key = `selected_dishes_${userId}`
        localStorage.setItem(key, JSON.stringify([]))
      }
    } catch {}
  },

  clearSelected: () => {
    set({ selectedDishes: [] })
    try {
      const userId = useAuthStore.getState().user?.id
      if (userId) {
        const key = `selected_dishes_${userId}`
        localStorage.setItem(key, JSON.stringify([]))
      }
    } catch {}
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
