import Papa from 'papaparse'
import { supabase, isMockSupabase } from '@/lib/supabase'

export interface Dish {
  name: string
  category: string
  image_url: string
  cooking_steps: string
  ingredients: string
  calories: number
  protein: number
  carbs: number
  fat: number
  is_meat: boolean
}

export const parseDishesFromCSV = async (csvContent: string): Promise<Dish[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const dishes: Dish[] = results.data.map((row: any) => ({
          name: row['菜名'],
          category: row['分类'],
          image_url: row['图片路径'] ? `/${row['图片路径']}` : '',
          cooking_steps: row['烹饪方法'],
          ingredients: row['食材'],
          calories: parseInt(row['卡路里/100g']) || 0,
          protein: parseFloat(row['蛋白质/100g']) || 0,
          carbs: parseFloat(row['碳水化合物/100g']) || 0,
          fat: parseFloat(row['脂肪/100g']) || 0,
          is_meat: row['分类'] === '荤菜' || row['分类'] === '半荤'
        }))
        resolve(dishes)
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}

export const importDishesToSupabase = async (dishes: Dish[]) => {
  const { data, error } = await supabase
    .from('dishes')
    .insert(dishes)
    .select()

  if (error) {
    console.error('导入菜品数据失败:', error)
    throw error
  }

  return data
}

export const loadDishesFromCSV = async () => {
  try {
    // 仅在本地模拟数据库时执行导入与字段同步，云端环境不允许前端写入以避免触发RLS
    if (!isMockSupabase) {
      return
    }
    const response = await fetch(`${import.meta.env.BASE_URL}recipes.csv`)
    const csvContent = await response.text()
    const dishes = await parseDishesFromCSV(csvContent)
    
    // 读取数据库中已有的菜品（用于增量插入和字段同步）
    const { data: existing } = await supabase
      .from('dishes')
      .select('id,name,category,image_url,ingredients,cooking_steps,calories,protein,carbs,fat,is_meat')

    const existingByName = new Map<string, any>((existing || []).map((d: any) => [d.name, d]))

    // 1) 仅插入数据库中不存在的菜品（按菜名去重）
    const toInsert = dishes.filter(d => !existingByName.has(d.name))
    if (toInsert.length > 0) {
      await importDishesToSupabase(toInsert)
      console.log(`增量导入完成：新增 ${toInsert.length} 道菜品`)
    }

    // 2) 同步已存在菜品的图片路径等关键信息（依据CSV内容更新）
    const toUpdate = dishes
      .map(d => ({ csv: d, db: existingByName.get(d.name) }))
      .filter(pair => pair.db && (
        (pair.db.category || '') !== (pair.csv.category || '') ||
        (pair.db.image_url || '') !== (pair.csv.image_url || '') ||
        (pair.db.ingredients || '') !== (pair.csv.ingredients || '') ||
        (pair.db.cooking_steps || '') !== (pair.csv.cooking_steps || '') ||
        (pair.db.calories || 0) !== (pair.csv.calories || 0) ||
        (pair.db.protein || 0) !== (pair.csv.protein || 0) ||
        (pair.db.carbs || 0) !== (pair.csv.carbs || 0) ||
        (pair.db.fat || 0) !== (pair.csv.fat || 0) ||
        (pair.db.is_meat || false) !== (pair.csv.is_meat || false)
      ))

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(async ({ csv, db }) => {
          await supabase
            .from('dishes')
            .update({
              category: csv.category,
              image_url: csv.image_url,
              ingredients: csv.ingredients,
              cooking_steps: csv.cooking_steps,
              calories: csv.calories,
              protein: csv.protein,
              carbs: csv.carbs,
              fat: csv.fat,
              is_meat: csv.is_meat,
            })
            .eq('id', db.id)
        })
      )
      console.log(`字段同步完成：更新 ${toUpdate.length} 道菜品`)
    }
  } catch (error) {
    console.error('导入菜品数据失败:', error)
  }
}