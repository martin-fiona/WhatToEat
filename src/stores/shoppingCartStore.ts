import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface Ingredient {
  name: string
  quantity: string
  unit: string
}

interface ShoppingCartState {
  ingredients: Ingredient[]
  loading: boolean
  loadCart: (userId: string) => Promise<void>
  addIngredient: (ingredient: Ingredient) => void
  removeIngredient: (index: number) => void
  updateIngredient: (index: number, ingredient: Ingredient) => void
  clearCart: (userId?: string) => Promise<void>
  saveCart: (userId: string) => Promise<void>
  addIngredientsFromDishes: (dishes: any[]) => void
}

export const useShoppingCartStore = create<ShoppingCartState>((set, get) => ({
  ingredients: [],
  loading: false,

  loadCart: async (userId: string) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('shopping_cart')
        .select('ingredients_json')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      
      if (data?.ingredients_json) {
        const ingredients = JSON.parse(data.ingredients_json)
        set({ ingredients })
      }
    } catch (error) {
      console.error('加载购物车失败:', error)
    } finally {
      set({ loading: false })
    }
  },

  addIngredient: (ingredient: Ingredient) => {
    const { ingredients } = get()
    set({ ingredients: [...ingredients, ingredient] })
  },

  removeIngredient: (index: number) => {
    const { ingredients } = get()
    set({ ingredients: ingredients.filter((_, i) => i !== index) })
  },

  updateIngredient: (index: number, ingredient: Ingredient) => {
    const { ingredients } = get()
    const newIngredients = [...ingredients]
    newIngredients[index] = ingredient
    set({ ingredients: newIngredients })
  },

  clearCart: async (userId?: string) => {
    // 先清空本地状态，确保界面立即更新
    set({ ingredients: [] })

    // 如果有用户ID，则同时清空数据库中的购物车记录
    if (userId) {
      try {
        const { error } = await supabase
          .from('shopping_cart')
          .delete()
          .eq('user_id', userId)

        if (error) throw error
      } catch (error) {
        console.error('清空购物车（数据库）失败:', error)
      }
    }
  },

  saveCart: async (userId: string) => {
    const { ingredients } = get()
    try {
      const ingredientsJson = JSON.stringify(ingredients)
      
      const { error, data } = await supabase
        .from('shopping_cart')
        .upsert({
          user_id: userId,
          ingredients_json: ingredientsJson,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select('user_id, updated_at')
        .single()

      if (error) throw error
      if (!data || data.user_id !== userId) {
        throw new Error('保存返回异常')
      }
    } catch (error) {
      console.error('保存购物车失败:', error)
      throw error
    }
  },

  addIngredientsFromDishes: (dishes: any[]) => {
    const { ingredients } = get()
    const newIngredients: Ingredient[] = []
    console.log('[CartStore] addIngredientsFromDishes: input dishes', dishes.map(d => ({ id: d.id, name: d.name, category: d.category, rawIngredients: d.ingredients })))

    // 常见调味料/辅料过滤清单（不加入购物车）
    const seasoningList = [
      '盐','白糖','糖','生抽','老抽','料酒','淀粉','食用油','油','水','醋','香醋','蒸鱼豉油','黑胡椒','白胡椒粉','胡椒粉','蚝油','香油',
      '黄油','橄榄油','花椒','八角','桂皮','香叶','泡椒','酱','黄豆酱',
      '葱','葱段','葱白','葱花','姜','姜片','生姜','蒜','蒜末','蒜泥','大蒜'
    ]
    const seasoningSet = new Set(seasoningList)
    const normalizeName = (name: string) => {
      // 去除括号内注释，如：香醋（可选）、食用油（大量）
      let n = name.replace(/[（(].*?[)）]/g, '').trim()
      // 处理“或”选择，如：新鲜河虾或对虾 -> 取第一个
      if (n.includes('或')) n = n.split('或')[0].trim()
      return n
    }

    // 基于菜品的食材名称（逗号分隔），不解析数量/单位
    dishes.forEach(dish => {
      const raw = (dish.ingredients || '') as string
      // 兼容半角逗号、全角逗号、顿号、分号等常见中文分隔符
      const names = raw
        .split(/[，,、;；]/)
        .map((s: string) => s.trim())
        .filter(Boolean)
      const normalized = names.map(normalizeName)
      // 过滤调味料/辅料，仅保留主要食材
      const filtered = normalized.filter(n => !seasoningSet.has(n))
      console.log('[CartStore] parsed ingredient names for dish', dish.name, { raw: names, normalized, filtered })
      filtered.forEach(name => {
        newIngredients.push({
          name,
          quantity: '适量',
          unit: '份',
        })
      })
    })

    // 去重并合并相同食材：将“适量”视为 1 份进行累加
    console.log('[CartStore] cart before combine', ingredients)
    const combinedIngredients = [...ingredients]
    newIngredients.forEach(newIng => {
      const existing = combinedIngredients.find(ing => ing.name === newIng.name)
      if (existing) {
        const existingQtyNum = Number.parseInt(existing.quantity, 10)
        const newQtyNum = Number.parseInt(newIng.quantity, 10)
        const existingVal = Number.isNaN(existingQtyNum) ? 1 : existingQtyNum
        const addVal = Number.isNaN(newQtyNum) ? 1 : newQtyNum
        const sum = existingVal + addVal
        existing.quantity = `${sum}`
        existing.unit = existing.unit || '份'
      } else {
        combinedIngredients.push(newIng)
      }
    })
    console.log('[CartStore] cart after combine', combinedIngredients)
    set({ ingredients: combinedIngredients })
  },
}))