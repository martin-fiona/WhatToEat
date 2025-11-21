export type GeneratedDishInfo = {
  ingredients: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  steps: string[]
}

function parseGeminiJSON(text: string): GeneratedDishInfo {
  try {
    const cleaned = text.trim().replace(/^```json\n?|```$/g, '')
    const obj = JSON.parse(cleaned)
    const toNum = (v: any) => {
      if (v === null || v === undefined || v === '') return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    const stepsArr = Array.isArray(obj.steps) ? obj.steps.map((s: any) => String(s)).filter(Boolean) : []
    return {
      ingredients: String(obj.ingredients || ''),
      calories: toNum(obj.calories_per_100g),
      protein: toNum(obj.protein_per_100g),
      carbs: toNum(obj.carbs_per_100g),
      fat: toNum(obj.fat_per_100g),
      steps: stepsArr,
    }
  } catch {
    return { ingredients: '', calories: null, protein: null, carbs: null, fat: null, steps: [] }
  }
}

async function generateViaGemini(name: string, category: string): Promise<GeneratedDishInfo> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (!key) return { ingredients: '', calories: null, protein: null, carbs: null, fat: null, steps: [] }
  const prompt = `请根据菜名生成结构化信息，单位为克/100克，仅输出JSON：{ "ingredients": "逗号分隔", "calories_per_100g": number, "protein_per_100g": number, "carbs_per_100g": number, "fat_per_100g": number, "steps": ["步骤1", "步骤2"...] }。菜名: ${name}，分类: ${category}`
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
    if (viaEndpoint.ingredients || viaEndpoint.calories !== null) return viaEndpoint
  } catch {}
  try {
    const viaGemini = await generateViaGemini(name, category)
    return viaGemini
  } catch {}
  return { ingredients: '', calories: null, protein: null, carbs: null, fat: null, steps: [] }
}

