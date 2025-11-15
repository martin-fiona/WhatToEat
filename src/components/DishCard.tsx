import { useEffect, useState } from 'react'
import { Database } from '@/lib/supabase'
import { Check, Clock, Users, X } from 'lucide-react'

interface DishCardProps {
  dish: Database['public']['Tables']['dishes']['Row']
  isSelected: boolean
  onToggle: () => void
}

export function DishCard({ dish, isSelected, onToggle }: DishCardProps) {
  const [open, setOpen] = useState(false)
  const withBase = (path: string) => {
    if (!path) return ''
    const base = import.meta.env.BASE_URL || '/'
    return path.startsWith('/') ? `${base}${path.slice(1)}` : path
  }
  const [imgSrc, setImgSrc] = useState<string>(withBase(dish.image_url || '/favicon.svg'))
  const [attempt, setAttempt] = useState<number>(0)
  const extOrder = ['jpeg', 'png', 'webp', 'jpg']

  const openModal = () => setOpen(true)
  const closeModal = () => setOpen(false)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    if (open) {
      document.addEventListener('keydown', handler)
    }
    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [open])

  useEffect(() => {
    // 当菜品变化时重置图片尝试
    setImgSrc(withBase(dish.image_url || `/images/${dish.name}.jpg`))
    setAttempt(0)
  }, [dish.image_url, dish.name])

  const nextImageSrc = () => {
    const hasDot = (dish.image_url || '').lastIndexOf('.') > -1
    const base = hasDot
      ? (dish.image_url || '').slice(0, (dish.image_url || '').lastIndexOf('.'))
      : `/images/${dish.name}`
    if (attempt < extOrder.length) {
      return withBase(`${base}.${extOrder[attempt]}`)
    }
    return withBase('/favicon.svg')
  }

  const handleImgError = () => {
    const next = nextImageSrc()
    setImgSrc(next)
    setAttempt((prev) => prev + 1)
  }
  const getDifficultyColor = (category: string) => {
    switch (category) {
      case '荤菜': return 'bg-red-100 text-red-800'
      case '素菜': return 'bg-green-100 text-green-800'
      case '半荤': return 'bg-yellow-100 text-yellow-800'
      case '汤品': return 'bg-blue-100 text-blue-800'
      case '主食': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const ingredients = dish.ingredients.split(',').slice(0, 5)
  const hasMoreIngredients = dish.ingredients.split(',').length > 5
  const rawSteps = dish.cooking_steps || ''
  const isNumbered = /\d+\s*[、\.．。]/.test(rawSteps)
  const cookingSteps = (
    isNumbered
      ? rawSteps.split(/(?=\d+\s*[、\.．。])/)
      : rawSteps.includes('\n')
        ? rawSteps.split(/\r?\n/)
        : rawSteps.split(/；|;/)
  ).map(s => s.trim()).filter(Boolean)

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow" onClick={openModal}>
      <div className="flex items-start p-4">
        <div className="relative shrink-0">
          <img
            src={imgSrc}
            onError={handleImgError}
            alt={dish.name}
            className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded"
          />
          {isSelected && (
            <div className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full p-1 shadow">
              <Check className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="flex-1 pl-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 cursor-pointer" onClick={(e) => { e.stopPropagation(); openModal() }}>{dish.name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(dish.category)}`}>
              {dish.category}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600 mb-2">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{dish.calories || 0} 卡</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{dish.protein || 0}g 蛋白质</span>
            </div>
          </div>
          <div className="mb-3">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">主要食材：</p>
            <div className="flex flex-wrap gap-1">
              {ingredients.map((ingredient, index) => (
                <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  {ingredient.trim()}
                </span>
              ))}
              {hasMoreIngredients && (
                <span className="text-xs text-gray-500">...</span>
              )}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
              isSelected
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isSelected ? '取消选择' : '选择菜品'}
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-center justify-center p-4" onClick={closeModal}>
            <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-lg font-semibold text-gray-900">{dish.name}</h3>
                <button onClick={closeModal} className="p-2 rounded hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="p-4 max-h-[70vh] overflow-y-auto">
                <img src={imgSrc} onError={handleImgError} alt={dish.name} className="w-full h-52 sm:h-56 object-cover rounded" />
                <div className="mt-4 flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(dish.category)}`}>{dish.category}</span>
                  <span className="text-xs text-gray-500">热量：{dish.calories || 0} 卡</span>
                  <span className="text-xs text-gray-500">蛋白质：{dish.protein || 0} g</span>
                  <span className="text-xs text-gray-500">碳水：{dish.carbs || 0} g</span>
                  <span className="text-xs text-gray-500">脂肪：{dish.fat || 0} g</span>
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">食材</h4>
                  <div className="flex flex-wrap gap-2">
                    {dish.ingredients.split(',').map((ing, idx) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {ing.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                {cookingSteps.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">制作方法</h4>
                    <div className="space-y-2">
                      {cookingSteps.map((step, idx) => (
                        <p key={idx} className="text-sm leading-6 text-gray-700">
                          {step}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t flex justify-end gap-2">
                <button className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={closeModal}>
                  关闭
                </button>
                <button
                  className={`px-4 py-2 rounded ${isSelected ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                  onClick={() => { onToggle(); closeModal() }}
                >
                  {isSelected ? '取消选择' : '选择此菜'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}