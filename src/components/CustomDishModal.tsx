import { useEffect, useMemo, useState } from 'react'
import { supabase, isMockSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Plus, X, UploadCloud, Trash2, ArrowUpDown } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  defaultCategory?: string
}

function sanitize(input: string, maxLen: number) {
  const trimmed = (input || '').slice(0, maxLen)
  return trimmed.replace(/[<>]/g, '')
}

export default function CustomDishModal({ open, onClose, onCreated, defaultCategory }: Props) {
  const { user } = useAuthStore()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('荤菜')
  const [ingredients, setIngredients] = useState('')
  const [ingredientsList, setIngredientsList] = useState<string[]>([])
  const [calories, setCalories] = useState<string>('')
  const [carbs, setCarbs] = useState<string>('')
  const [protein, setProtein] = useState<string>('')
  const [fat, setFat] = useState<string>('')
  const [steps, setSteps] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string>('')
  

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open && defaultCategory) {
      const list = ['荤菜', '半荤', '素菜', '汤品', '主食', '西餐', '糕点']
      if (list.includes(defaultCategory)) {
        setCategory(defaultCategory)
      }
    }
  }, [open, defaultCategory])

  useEffect(() => {
    const joined = ingredientsList.map(i => i.replace(/，/g, ',').trim()).filter(Boolean).join(',')
    setIngredients(joined.slice(0,200))
  }, [ingredientsList])

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

  

  async function fileToDataUrl(f: File): Promise<string> {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = (e) => reject(e)
      reader.readAsDataURL(f)
    })
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
        const bucket = import.meta.env.VITE_SUPABASE_BUCKET || 'dish-images'
        const path = `${user!.id}/${Date.now()}-${encodeURIComponent(file!.name)}`
        setProgress(30)
        try {
          await retry(async () => {
            const { error } = await supabase.storage.from(bucket).upload(path, file!, {
              contentType: file!.type,
              upsert: false,
            })
            if (error) throw error
          })
          setProgress(70)
          const { data } = await supabase.storage.from(bucket).getPublicUrl(path)
          publicUrl = data.publicUrl
        } catch (err: any) {
          const msg = String(err?.message || '')
          if (msg.includes('Bucket not found')) {
            publicUrl = await fileToDataUrl(file!)
          } else {
            throw err
          }
        }
      } else {
        publicUrl = URL.createObjectURL(file!)
      }

      setProgress(80)
      try {
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
      } catch (err: any) {
        const msg = String(err?.message || '')
        if (msg.includes("Could not find the table 'public.user_dishes'") || msg.includes('relation "public.user_dishes" does not exist')) {
          const localKey = `user_dishes_${user!.id}`
          const raw = localStorage.getItem(localKey)
          const arr = raw ? JSON.parse(raw) : []
          const localDish = {
            id: `local-${Date.now()}`,
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
            created_at: new Date().toISOString(),
          }
          localStorage.setItem(localKey, JSON.stringify([localDish, ...arr]))
        } else {
          throw err
        }
      }

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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">主要食材（选填）</label>
                  <button type="button" onClick={() => setIngredientsList([...ingredientsList, ''])} className="text-xs px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 flex items-center gap-1"><Plus className="w-3 h-3" />添加食材</button>
                </div>
                <div className="space-y-2">
                  {ingredientsList.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={ing} onChange={(e) => {
                        const v = e.target.value.slice(0,40)
                        setIngredientsList(ingredientsList.map((x,i)=> i===idx ? v : x))
                      }} className="flex-1 px-3 py-2 border rounded" placeholder={`食材${idx+1}`} />
                      <button type="button" onClick={() => setIngredientsList(ingredientsList.filter((_,i)=>i!==idx))} className="p-2 rounded bg-red-50 text-red-600 hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {ingredientsList.length === 0 && (
                    <input value={ingredients} onChange={(e) => setIngredientsList(e.target.value.split(/[,，]/).map(s=>s.trim()).filter(Boolean))} className="w-full px-3 py-2 border rounded" placeholder="可直接输入：鸡胸肉, 青椒（支持中英文逗号）" />
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">营养成分（选填）</label>
              <div className="grid grid-cols-4 gap-3">
                <input value={calories} onChange={(e) => setCalories(e.target.value.replace(/[^\d.]/g,''))} placeholder="热量(卡)" className="px-3 py-2 border rounded" />
                <input value={carbs} onChange={(e) => setCarbs(e.target.value.replace(/[^\d.]/g,''))} placeholder="碳水（克）" className="px-3 py-2 border rounded" />
                <input value={protein} onChange={(e) => setProtein(e.target.value.replace(/[^\d.]/g,''))} placeholder="蛋白质（克）" className="px-3 py-2 border rounded" />
                <input value={fat} onChange={(e) => setFat(e.target.value.replace(/[^\d.]/g,''))} placeholder="脂肪（克）" className="px-3 py-2 border rounded" />
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
