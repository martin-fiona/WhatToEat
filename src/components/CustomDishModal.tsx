import { useEffect, useMemo, useState } from 'react'
import { supabase, isMockSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { generateDishInfo } from '@/lib/ai'
import { Plus, X, UploadCloud, Trash2, ArrowUpDown, Sparkles } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function sanitize(input: string, maxLen: number) {
  const trimmed = (input || '').slice(0, maxLen)
  return trimmed.replace(/[<>]/g, '')
}

export default function CustomDishModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuthStore()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('荤菜')
  const [ingredients, setIngredients] = useState('')
  const [calories, setCalories] = useState<string>('')
  const [carbs, setCarbs] = useState<string>('')
  const [protein, setProtein] = useState<string>('')
  const [fat, setFat] = useState<string>('')
  const [steps, setSteps] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const categories = useMemo(() => ['荤菜', '半荤', '素菜', '汤品', '主食', '西餐', '糕点'], [])

  const validate = () => {
    if (!user) { setErrorMsg('请先登录'); return false }
    if (!name.trim()) { setErrorMsg('请填写菜品名称'); return false }
    if (!file) { setErrorMsg('请上传菜品图片'); return false }
    const okType = ['image/jpeg', 'image/png']
    if (!okType.includes(file.type)) { setErrorMsg('仅支持JPG/PNG图片'); return false }
    if (file.size > 2 * 1024 * 1024) { setErrorMsg('图片大小不能超过2MB'); return false }
    if (!categories.includes(category)) { setErrorMsg('请选择有效的菜品种类'); return false }
    setErrorMsg('')
    return true
  }

  async function retry<T>(fn: () => Promise<T>, attempts = 2, delay = 600): Promise<T> {
    let lastErr: any
    for (let i = 0; i <= attempts; i++) {
      try { return await fn() } catch (e) { lastErr = e; if (i < attempts) await new Promise(r => setTimeout(r, delay * (i + 1))) }
    }
    throw lastErr
  }

  const nutritionDict: Record<string, { carbs: number; protein: number; fat: number; calories?: number }> = {
    '鸡蛋': { carbs: 1.1, protein: 13, fat: 11 },
    '猪肉': { carbs: 0, protein: 20, fat: 20 },
    '牛肉': { carbs: 0, protein: 26, fat: 15 },
    '虾': { carbs: 0.2, protein: 20, fat: 1.5 },
    '鲈鱼': { carbs: 0, protein: 20, fat: 4 },
    '米饭': { carbs: 28, protein: 3, fat: 0.3 },
    '面条': { carbs: 28, protein: 5, fat: 1 },
    '土豆': { carbs: 17, protein: 2, fat: 0.1 },
    '胡萝卜': { carbs: 10, protein: 0.9, fat: 0.2 },
    '洋葱': { carbs: 10, protein: 1.1, fat: 0.1 },
    '西红柿': { carbs: 3.9, protein: 0.9, fat: 0.2 },
    '黄瓜': { carbs: 3.6, protein: 0.7, fat: 0.1 },
    '青椒': { carbs: 6, protein: 1, fat: 0.3 },
    '菠菜': { carbs: 3.6, protein: 2.9, fat: 0.4 },
    '茄子': { carbs: 6, protein: 1, fat: 0.2 },
    '香菇': { carbs: 7.4, protein: 2.2, fat: 0.2 },
    '豆腐': { carbs: 1.9, protein: 8, fat: 4.8 },
    '海带': { carbs: 9.6, protein: 1.7, fat: 0.5 },
    '紫菜': { carbs: 5, protein: 5.8, fat: 0.7 },
    '玉米': { carbs: 22, protein: 3.4, fat: 1.2 },
    '小米': { carbs: 23, protein: 4.2, fat: 1.3 },
  }

  function guessIngredientsFromName(n: string) {
    const hits: string[] = []
    Object.keys(nutritionDict).forEach((k) => { if (n.includes(k)) hits.push(k) })
    if (n.includes('肉丝')) hits.push('猪肉')
    if (n.includes('鸡')) hits.push('鸡肉')
    if (n.includes('蛋')) hits.push('鸡蛋')
    const unique = Array.from(new Set(hits))
    return unique.join(', ')
  }

  function estimateNutrition(ingText: string) {
    const items = ingText.split(',').map(s => s.trim()).filter(Boolean)
    const matched = items.map(i => nutritionDict[i]).filter(Boolean)
    if (matched.length === 0) return { carbs: '', protein: '', fat: '' }
    const avg = matched.reduce((acc, m) => ({ carbs: acc.carbs + m.carbs, protein: acc.protein + m.protein, fat: acc.fat + m.fat }), { carbs: 0, protein: 0, fat: 0 })
    const n = matched.length
    return { carbs: String(Math.round((avg.carbs / n) * 10) / 10), protein: String(Math.round((avg.protein / n) * 10) / 10), fat: String(Math.round((avg.fat / n) * 10) / 10) }
  }

  const handleAutoGenerate = async () => {
    setGenerating(true)
    try {
      const ai = await generateDishInfo(name, category)
      const ing = (ai.ingredients && ai.ingredients.trim()) ? ai.ingredients : (ingredients.trim() || guessIngredientsFromName(name))
      setIngredients(ing.slice(0,200))
      const est = estimateNutrition(ing)
      const cal = ai.calories ?? null
      if (!calories && cal !== null) setCalories(String(cal))
      if (!carbs) setCarbs(String(ai.carbs ?? est.carbs))
      if (!protein) setProtein(String(ai.protein ?? est.protein))
      if (!fat) setFat(String(ai.fat ?? est.fat))
      if (ai.steps && ai.steps.length > 0 && steps.length === 0) setSteps(ai.steps.map(s => s.slice(0,300)))
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setProgress(10)
    try {
      const safeName = sanitize(name, 50)
      const safeIngredients = sanitize(ingredients, 200)
      const cooking_steps = steps.map(s => sanitize(s, 300)).join('\n')
      const num = (v: string) => v ? Math.max(0, Number(v)) : null

      let publicUrl: string | null = null

      if (!isMockSupabase) {
        const path = `${user!.id}/${Date.now()}-${encodeURIComponent(file!.name)}`
        setProgress(30)
        await retry(async () => {
          const { error } = await supabase.storage.from('dish-images').upload(path, file!, {
            contentType: file!.type,
            upsert: false,
          })
          if (error) throw error
        })
        setProgress(70)
        const { data } = await supabase.storage.from('dish-images').getPublicUrl(path)
        publicUrl = data.publicUrl
      } else {
        publicUrl = URL.createObjectURL(file!)
      }

      setProgress(80)
      await retry(async () => {
        const { error } = await supabase
          .from('user_dishes')
          .insert([{ 
            user_id: user!.id,
            name: safeName,
            category,
            image_url: publicUrl,
            ingredients: safeIngredients,
            cooking_steps,
            calories: num(calories),
            protein: num(protein),
            carbs: num(carbs),
            fat: num(fat),
            is_meat: category === '荤菜' ? true : category === '半荤' ? true : false,
          }])
        if (error) throw error
      })

      setProgress(100)
      onClose()
      onCreated()
    } catch (e: any) {
      setErrorMsg(e?.message || '提交失败，请重试')
    } finally {
      setSubmitting(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-lg font-semibold text-gray-900">添加自定义菜品</h3>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-600" /></button>
          </div>
          <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
            {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">菜品名称（必填）</label>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0,50))} className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-orange-500" placeholder="最多50字符" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">菜品图片（必填，JPG/PNG，≤2MB）</label>
              <input type="file" accept="image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && <div className="mt-2 text-xs text-gray-600">{file.name} · {(file.size/1024/1024).toFixed(2)}MB</div>}
              {submitting && (
                <div className="mt-2 w-full h-2 bg-gray-200 rounded">
                  <div className="h-2 bg-orange-500 rounded" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">菜品种类（必填）</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border rounded">
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">主要食材（选填，≤200）</label>
                <div className="flex gap-2">
                  <input value={ingredients} onChange={(e) => setIngredients(e.target.value.slice(0,200))} className="flex-1 px-3 py-2 border rounded" placeholder="逗号分隔，如：鸡胸肉, 青椒" />
                  <button type="button" onClick={handleAutoGenerate} className="px-3 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1" disabled={generating}>
                    <Sparkles className="w-4 h-4" /> AI生成
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">营养成分（克/100克，选填）</label>
              <div className="grid grid-cols-4 gap-3">
                <input value={calories} onChange={(e) => setCalories(e.target.value.replace(/[^\d.]/g,''))} placeholder="热量(卡/100g)" className="px-3 py-2 border rounded" />
                <input value={carbs} onChange={(e) => setCarbs(e.target.value.replace(/[^\d.]/g,''))} placeholder="碳水" className="px-3 py-2 border rounded" />
                <input value={protein} onChange={(e) => setProtein(e.target.value.replace(/[^\d.]/g,''))} placeholder="蛋白质" className="px-3 py-2 border rounded" />
                <input value={fat} onChange={(e) => setFat(e.target.value.replace(/[^\d.]/g,''))} placeholder="脂肪" className="px-3 py-2 border rounded" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">制作方式（选填）</label>
                <button type="button" onClick={() => setSteps([...steps, ''])} className="text-xs px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 flex items-center gap-1"><Plus className="w-3 h-3" />添加步骤</button>
              </div>
              <div className="space-y-2">
                {steps.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input value={s} onChange={(e) => {
                      const v = e.target.value.slice(0,300)
                      setSteps(steps.map((x,i)=> i===idx ? v : x))
                    }} className="flex-1 px-3 py-2 border rounded" placeholder={`步骤${idx+1}（≤300字）`} />
                    <button type="button" onClick={() => setSteps(steps.filter((_,i)=>i!==idx))} className="p-2 rounded bg-red-50 text-red-600 hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
                    {idx>0 && (
                      <button type="button" onClick={() => {
                        const arr = [...steps]
                        const t = arr[idx-1]; arr[idx-1] = arr[idx]; arr[idx] = t
                        setSteps(arr)
                      }} className="p-2 rounded bg-gray-50 text-gray-600 hover:bg-gray-100"><ArrowUpDown className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-t flex justify-end gap-2">
            <button className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={onClose}>取消</button>
            <button disabled={submitting} className="px-4 py-2 rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2" onClick={handleSubmit}>
              <UploadCloud className="w-4 h-4" /> 提交
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
