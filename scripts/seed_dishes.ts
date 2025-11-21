import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function parseBoolean(category: string) {
  const meatTags = new Set(['荤菜', '半荤'])
  return meatTags.has(category)
}

async function main() {
  const csvPath = path.resolve(process.cwd(), 'public', 'recipes.csv')
  const csv = fs.readFileSync(csvPath, 'utf-8')
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })

  const rows = (parsed.data as any[]).map((row) => ({
    name: row['菜名'],
    category: row['分类'],
    image_url: row['图片路径'] ? `/${row['图片路径']}` : '',
    cooking_steps: row['烹饪方法'] ?? '',
    ingredients: row['食材'] ?? '',
    calories: Number.parseInt(row['卡路里/100g']) || 0,
    protein: Number.parseFloat(row['蛋白质/100g']) || 0,
    carbs: Number.parseFloat(row['碳水化合物/100g']) || 0,
    fat: Number.parseFloat(row['脂肪/100g']) || 0,
    is_meat: parseBoolean(row['分类'] || ''),
  }))

  // Fetch existing to avoid duplicates by name
  const { data: existing, error: selError } = await supabase
    .from('dishes')
    .select('id,name')

  if (selError) {
    console.error('Failed to select existing dishes:', selError)
    process.exit(1)
  }

  const existingNames = new Set((existing || []).map((d: any) => d.name))
  const toInsert = rows.filter((r) => !!r.name && !existingNames.has(r.name))

  console.log(`Prepared ${toInsert.length} new dishes to insert`)

  // Insert in batches to avoid payload limits
  const batchSize = 100
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize)
    const { error } = await supabase
      .from('dishes')
      .insert(batch)
    if (error) {
      console.error('Insert batch failed:', error)
      process.exit(1)
    }
    console.log(`Inserted batch ${i / batchSize + 1}: ${batch.length} rows`)
  }

  console.log('Seeding completed successfully')
}

main().catch((e) => {
  console.error('Seed script failed:', e)
  process.exit(1)
})