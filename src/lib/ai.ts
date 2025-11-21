export type GeneratedDishInfo = {
  ingredients: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  steps: string[]
}

function normalizeIngredients(raw: string): string {
  const trivial = new Set(['盐', '食用油', '油', '水', '胡椒粉', '酱油', '生抽', '老抽', '糖', '醋', '味精'])
  const parts = String(raw || '')
    .replace(/，/g, ',')
    .replace(/；/g, ',')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const unique: string[] = []
  for (const p of parts) {
    const isTrivial = trivial.has(p)
    if (!unique.includes(p)) unique.push(p)
  }
  const hasNonTrivial = unique.some(p => !trivial.has(p))
  const filtered = hasNonTrivial ? unique.filter(p => !trivial.has(p)) : unique
  return filtered.join(', ')
}

function n(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const num = Number(v)
  return Number.isFinite(num) ? num : null
}

function parseGeminiJSON(text: string): GeneratedDishInfo {
  try {
    const cleaned = text.trim().replace(/^```json\n?|```$/g, '')
    const obj = JSON.parse(cleaned)
    const stepsArr = Array.isArray(obj.steps) ? obj.steps.map((s: any) => String(s)).filter(Boolean) : Array.isArray(obj.制作步骤) ? obj.制作步骤.map((s: any) => String(s)).filter(Boolean) : []
    const ingRaw = obj.ingredients || obj.主要食材 || obj.ingredientsText || ''
    return {
      ingredients: normalizeIngredients(ingRaw),
      calories: n(obj.calories_per_100g ?? obj.calories ?? obj.kcal ?? obj.热量),
      protein: n(obj.protein_per_100g ?? obj.protein ?? obj.蛋白质),
      carbs: n(obj.carbs_per_100g ?? obj.carbs ?? obj.碳水化合物),
      fat: n(obj.fat_per_100g ?? obj.fat ?? obj.脂肪),
      steps: stepsArr,
    }
  } catch {
    return { ingredients: '', calories: null, protein: null, carbs: null, fat: null, steps: [] }
  }
}

async function generateViaGemini(name: string, category: string): Promise<GeneratedDishInfo> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (!key) return { ingredients: '', calories: null, protein: null, carbs: null, fat: null, steps: [] }
  const prompt = `只输出JSON，无任何解释。字段: {
    "ingredients": "中文逗号分隔主要食材，不含水/盐/油等调料",
    "calories_per_100g": 数字,
    "protein_per_100g": 数字,
    "carbs_per_100g": 数字,
    "fat_per_100g": 数字,
    "steps": ["步骤1", "步骤2"...]
  }
  菜名: ${name}，分类: ${category}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7 },
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { ingredients: '', calories: null, protein: null, carbs: null, fat: null, steps: [] }
  const data = await res.json()
  const candidates = data.candidates || []
  const text = candidates[0]?.content?.parts?.[0]?.text || ''
  return parseGeminiJSON(text)
}

async function generateViaEndpoint(name: string, category: string): Promise<GeneratedDishInfo> {
  const endpoint = import.meta.env.VITE_GEMINI_ENDPOINT as string | undefined
  if (!endpoint) return { ingredients: '', calories: null, protein: null, carbs: null, fat: null, steps: [] }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category }),
  })
  if (!res.ok) return { ingredients: '', calories: null, protein: null, carbs: null, fat: null, steps: [] }
  const obj = await res.json()
  return {
    ingredients: String(obj.ingredients || ''),
    calories: obj.calories ?? null,
    protein: obj.protein ?? null,
    carbs: obj.carbs ?? null,
    fat: obj.fat ?? null,
    steps: Array.isArray(obj.steps) ? obj.steps.map((s: any) => String(s)).filter(Boolean) : [],
  }
}

export async function generateDishInfo(name: string, category: string): Promise<GeneratedDishInfo> {
  try {
    const viaEndpoint = await generateViaEndpoint(name, category)
    if ((viaEndpoint.ingredients && viaEndpoint.ingredients.trim() !== '') || viaEndpoint.calories !== null) {
      viaEndpoint.ingredients = normalizeIngredients(viaEndpoint.ingredients)
      return viaEndpoint
    }
  } catch {}
  try {
    const viaGemini = await generateViaGemini(name, category)
    return viaGemini
  } catch {}
  return { ingredients: '', calories: null, protein: null, carbs: null, fat: null, steps: [] }
}
