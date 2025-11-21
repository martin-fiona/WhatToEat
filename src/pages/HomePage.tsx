import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDishStore } from '@/stores/dishStore'
import { useShoppingCartStore } from '@/stores/shoppingCartStore'
import { DishCard } from '@/components/DishCard'
import CustomDishModal from '@/components/CustomDishModal'
import { ShoppingCart, Users, Calendar, BarChart3, LogOut, ChevronLeft, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase, isMockSupabase } from '@/lib/supabase'

export function HomePage() {
  const { user, logout } = useAuthStore()
  const { dishes, loading, loadDishes, selectedDishes, toggleDish, generateRandomMenu, clearSelectedDishes, syncing, syncSource } = useDishStore()
  const { addIngredientsFromDishes } = useShoppingCartStore()
  const cartCount = useShoppingCartStore((s) => s.ingredients.length)
  const [diningCount, setDiningCount] = useState(2)
  const [generating, setGenerating] = useState(false)
  const [openCustom, setOpenCustom] = useState(false)
  const [defaultCategoryForModal, setDefaultCategoryForModal] = useState<string | undefined>(undefined)
  const [openLibrary, setOpenLibrary] = useState(false)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryItems, setLibraryItems] = useState<any[]>([])
  // 分类浏览：为移动端提供先选择类别再浏览菜品的模式
  const categoryOrder = ['荤菜', '半荤', '素菜', '汤品', '主食', '西餐', '糕点']
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const categoryMap = useMemo(() => {
    const map = new Map<string, any[]>()
    dishes.forEach(d => {
      const key = d.category || '其他'
      const arr = map.get(key) || []
      arr.push(d)
      map.set(key, arr)
    })
    return map
  }, [dishes])
  const navigate = useNavigate()

  useEffect(() => {
    loadDishes()
  }, [])

  // 恢复用户选择的菜品（刷新后仍保留）
  useEffect(() => {
    if (user?.id) {
      useDishStore.getState().restoreSelected(user.id)
    }
  }, [user?.id])

  const handleRandomGenerate = async () => {
    setGenerating(true)
    try {
      generateRandomMenu(diningCount)
      toast.success(`已为您生成 ${diningCount + 1} 道菜的菜单`)
    } catch (error) {
      toast.error('生成菜单失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleAddToCart = () => {
    if (selectedDishes.length === 0) {
      toast.error('请先选择菜品')
      return
    }
    // 调试输出：选中菜品及其食材字段
    console.log('[AddToCart] selectedDishes ids:', selectedDishes)
    const picked = dishes.filter(d => selectedDishes.includes(d.id))
    console.log('[AddToCart] picked full:', picked.map(d => ({ id: d.id, name: d.name, category: d.category, ingredients: d.ingredients, calories: d.calories, protein: d.protein, carbs: d.carbs, fat: d.fat })))
    // 调试输出：调用前购物车状态
    console.log('[AddToCart] cart before:', useShoppingCartStore.getState().ingredients)
    addIngredientsFromDishes(picked)
    // 调试输出：调用后购物车状态
    console.log('[AddToCart] cart after:', useShoppingCartStore.getState().ingredients)
    toast.success(`已将 ${picked.length} 道菜的食材添加到购物车`)
  }


  const handleSaveMeal = async () => {
    if (selectedDishes.length === 0) {
      toast.error('请先选择菜品')
      return
    }
    if (!user?.id) {
      toast.error('请先登录以保存到云端账户')
      return
    }
    try {
      // 计算营养合计（基于已加载的菜品数据）
      const picked = dishes.filter(d => selectedDishes.includes(d.id))
      const total_calories = picked.reduce((sum, d) => sum + (d.calories || 0), 0)
      const total_protein = picked.reduce((sum, d) => sum + (d.protein || 0), 0)
      const total_carbs = picked.reduce((sum, d) => sum + (d.carbs || 0), 0)
      const total_fat = picked.reduce((sum, d) => sum + (d.fat || 0), 0)

      const minimalDishes = picked.map(d => ({
        id: d.id,
        name: d.name,
        category: d.category,
        calories: d.calories || 0,
        protein: d.protein || 0,
        carbs: d.carbs || 0,
        fat: d.fat || 0,
        ingredients: d.ingredients || ''
      }))

      const { error } = await supabase
        .from('meal_history')
        .insert([
          { 
            user_id: user.id, 
            dish_ids: selectedDishes, 
            meal_date: new Date().toISOString().split('T')[0],
            dishes: minimalDishes,
            total_calories,
            total_protein,
            total_carbs,
            total_fat,
          }
        ])
      if (error) {
        if (isMockSupabase) {
          const key = `meal_history_${user.id}`
          const raw = localStorage.getItem(key)
          const arr = raw ? JSON.parse(raw) : []
          const localItem = {
            id: `local-${Date.now()}`,
            user_id: user.id,
            dish_ids: selectedDishes,
            meal_date: new Date().toISOString().split('T')[0],
            dishes: minimalDishes,
            total_calories,
            total_protein,
            total_carbs,
            total_fat,
            created_at: new Date().toISOString(),
          }
          localStorage.setItem(key, JSON.stringify([localItem, ...arr]))
          toast.success('当前为本地模式，已临时保存到本地')
        } else {
          toast.error('保存到云端失败，请检查账号登录与环境配置')
          throw error
        }
      } else {
        toast.success('用餐记录已保存到云端')
      }
    } catch (error) {
      toast.error('保存用餐记录失败')
    }
  }

  const buildImgSrc = (path?: string) => {
    const base = (import.meta as any).env.BASE_URL || '/'
    if (!path) return base + 'favicon.svg'
    if (/^https?:\/\//.test(path) || /^data:/.test(path)) return path
    if (path.startsWith('/')) return base + path.slice(1)
    return base + path
  }

  const openLibraryAndLoad = async () => {
    if (!user?.id) {
      toast.error('请先登录')
      return
    }
    setOpenLibrary(true)
    setLibraryLoading(true)
    try {
      const { data: cloud } = await supabase
        .from('user_dishes')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
      const cloudItems = Array.isArray(cloud) ? cloud : []
      const localKey = `user_dishes_${user.id}`
      const raw = localStorage.getItem(localKey)
      const localArr = raw ? JSON.parse(raw) : []
      const localItems = Array.isArray(localArr) ? localArr : []
      setLibraryItems([
        ...localItems.map((d: any) => ({ ...d, _source: 'local' })),
        ...cloudItems.map((d: any) => ({ ...d, _source: 'cloud' })),
      ])
    } catch {}
    finally {
      setLibraryLoading(false)
    }
  }

  const deleteFromLibrary = async (item: any) => {
    try {
      if (item._source === 'local' || String(item.id).startsWith('local-')) {
        const localKey = `user_dishes_${user!.id}`
        const raw = localStorage.getItem(localKey)
        const arr = raw ? JSON.parse(raw) : []
        const next = Array.isArray(arr) ? arr.filter((d: any) => d.id !== item.id) : []
        localStorage.setItem(localKey, JSON.stringify(next))
      } else {
        await supabase
          .from('user_dishes')
          .delete()
          .eq('id', item.id)
          .eq('user_id', user!.id)
      }
      await openLibraryAndLoad()
      await loadDishes()
      toast.success('已删除自定义菜品')
    } catch (e) {
      toast.error('删除失败')
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/auth')
    } catch (error) {
      toast.error('登出失败')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">加载菜品中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-lg sm:text-xl font-bold text-orange-600 whitespace-nowrap">今天吃什么</h1>
            </div>

            <nav className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-sm">
              <Link to="/cart" className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-orange-600">
                <ShoppingCart className="w-5 h-5" />
                <span>购物车</span>
                {cartCount > 0 && (
                  <span className="bg-orange-500 text-white text-xs rounded-full px-2 py-1">
                    {cartCount}
                  </span>
                )}
              </Link>
              <Link to="/calendar" className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-orange-600">
                <Calendar className="w-5 h-5" />
                <span>日历</span>
              </Link>
              <Link to="/nutrition" className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-orange-600">
                <BarChart3 className="w-5 h-5" />
                <span>分析</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-red-600"
              >
                <LogOut className="w-5 h-5" />
                <span>登出</span>
              </button>
          </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">用餐人数：</span>
              <input
                type="number"
                min="1"
                max="10"
                value={diningCount}
                onChange={(e) => setDiningCount(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
            <button
              onClick={handleRandomGenerate}
              disabled={generating}
              className="flex-shrink-0 text-sm bg-orange-500 text-white px-3 py-2 rounded-md hover:bg-orange-600 disabled:opacity-50"
            >
              {generating ? '生成中...' : '随机菜单'}
            </button>

            <button
              onClick={() => { setDefaultCategoryForModal(activeCategory || undefined); setOpenCustom(true) }}
              className="flex-shrink-0 text-sm bg-yellow-500 text-white px-3 py-2 rounded-md hover:bg-yellow-600"
            >
              自定义菜品
            </button>

            <button
              onClick={handleSaveMeal}
              disabled={selectedDishes.length === 0}
              className="flex-shrink-0 text-sm bg-green-500 text-white px-3 py-2 rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              保存菜品记录
            </button>

            <button
              onClick={handleAddToCart}
              disabled={selectedDishes.length === 0}
              className="flex-shrink-0 text-sm bg-blue-500 text-white px-3 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              食材加入购物车
            </button>
          </div>

          {selectedDishes.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => useDishStore.getState().clearSelected()}
                className="text-sm bg-gray-500 text-white px-3 py-2 rounded-md hover:bg-gray-600"
              >
                清空选择
              </button>
            </div>
          )}
          </div>

          <div className="text-sm text-gray-600">已选择 {selectedDishes.length} 道菜，预计 {diningCount} 人用餐</div>

        {/* Selected Dishes Summary */}
        {selectedDishes.length > 0 && (
          <SelectedDishesBar dishes={dishes} selectedIds={selectedDishes} onRemove={(id) => toggleDish(id)} />
        )}

        {/* 分类导航（移动端友好）：先显示分类按钮，点击进入分类列表 */}
        {activeCategory === null ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">按类别浏览</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {categoryOrder.map((cat) => {
                const count = (categoryMap.get(cat) || []).length
                return (
                  <div key={cat} className="contents">
                    <button
                      onClick={() => setActiveCategory(cat)}
                      className="flex items-center justify-between w-full px-4 py-3 rounded-lg border hover:border-orange-500 hover:bg-orange-50 transition-colors"
                    >
                      <span className="text-gray-800 font-medium">{cat}</span>
                      <span className="text-xs text-gray-500">{count} 道</span>
                    </button>
                    {cat === '糕点' && (
                      <button
                        onClick={openLibraryAndLoad}
                        className="flex items-center justify-between w-full px-4 py-3 rounded-lg border bg-white hover:bg-orange-50 hover:border-orange-500 transition-colors"
                      >
                        <span className="text-gray-800 font-medium">自定义菜品库</span>
                        <span className="text-xs text-gray-500">管理</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {/* 其他分类 */}
            {(() => {
              const extras = Array.from(categoryMap.keys()).filter(k => !categoryOrder.includes(k))
              if (extras.length === 0) return null
              return (
                <div className="mt-6">
                  <h3 className="text-sm text-gray-600 mb-2">其他分类</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {extras.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className="flex items-center justify-between w-full px-4 py-3 rounded-lg border hover:border-orange-500 hover:bg-orange-50 transition-colors"
                      >
                        <span className="text-gray-800 font-medium">{cat}</span>
                        <span className="text-xs text-gray-500">{(categoryMap.get(cat) || []).length} 道</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        ) : (
          <div className="">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-800">{activeCategory}</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">共 {(categoryMap.get(activeCategory) || []).length} 道</span>
                <button
                  onClick={() => { setDefaultCategoryForModal(activeCategory || undefined); setOpenCustom(true) }}
                  className="px-3 py-2 rounded-md border bg-white hover:bg-orange-50 hover:border-orange-500 text-gray-700"
                >
                  自定义菜品
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(categoryMap.get(activeCategory) || []).map((dish) => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  isSelected={selectedDishes.includes(dish.id)}
                  onToggle={() => toggleDish(dish.id)}
                />
              ))}
            </div>
            <button
              aria-label="返回"
              onClick={() => setActiveCategory(null)}
              className="fixed bottom-10 right-4 z-50 h-12 w-12 rounded-full shadow-lg bg-orange-500 text-white hover:bg-orange-600 opacity-80 hover:opacity-100 flex items-center justify-center"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
        )}

        {dishes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">暂无菜品数据</p>
          </div>
        )}
      </main>

      {/* 右下角加号按钮移除，根据需求不再显示 */}

      <CustomDishModal
        open={openCustom}
        onClose={() => setOpenCustom(false)}
        onCreated={() => {
          loadDishes()
          setOpenCustom(false)
        }}
        defaultCategory={defaultCategoryForModal}
      />

      {openLibrary && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-center justify-center p-4" onClick={() => setOpenLibrary(false)}>
            <div className="bg-white w-full max-w-3xl rounded-lg shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-lg font-semibold text-gray-900">自定义菜品库</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setOpenLibrary(false); setDefaultCategoryForModal(undefined); setOpenCustom(true) }} className="px-3 py-2 rounded bg-orange-500 text-white hover:bg-orange-600">添加自定义菜品</button>
                  <button onClick={() => setOpenLibrary(false)} className="p-2 rounded hover:bg-gray-100">关闭</button>
                </div>
              </div>
              <div className="p-4 max-h-[70vh] overflow-y-auto">
                {libraryLoading ? (
                  <div className="text-center py-8 text-gray-500">加载中...</div>
                ) : libraryItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">暂无自定义菜品</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {libraryItems.map((item) => (
                      <div key={item.id} className="bg-gray-50 border rounded-md overflow-hidden">
                        <img src={buildImgSrc(item.image_url)} alt={item.name} className="w-full h-24 object-cover" />
                        <div className="p-2">
                          <div className="text-sm font-medium truncate">{item.name}</div>
                          <div className="text-xs text-gray-500 mb-2">{item.category}</div>
                          <button
                            onClick={() => deleteFromLibrary(item)}
                            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 w-full"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CategorizedDishes({ dishes, selectedIds, onToggle }: { dishes: any[]; selectedIds: string[]; onToggle: (id: string) => void }) {
  const categoryOrder = ['荤菜', '半荤', '素菜', '汤品', '主食', '西餐', '糕点']
  const sections = useMemo(() => {
    const map = new Map<string, any[]>()
    dishes.forEach(d => {
      const key = d.category || '其他'
      const arr = map.get(key) || []
      arr.push(d)
      map.set(key, arr)
    })
    const extras = Array.from(map.keys()).filter(k => !categoryOrder.includes(k))
    const ordered = [...categoryOrder, ...extras]
    return ordered.map(k => ({ key: k, items: map.get(k) || [] }))
  }, [dishes])

  return (
    <div>
      {sections.map(section => (
        section.items.length > 0 && (
          <div key={section.key} className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">{section.key}</h2>
              <span className="text-sm text-gray-500">共 {section.items.length} 道</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {section.items.map((dish) => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  isSelected={selectedIds.includes(dish.id)}
                  onToggle={() => onToggle(dish.id)}
                />
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  )
}

function SelectedDishesBar({ dishes, selectedIds, onRemove }: { dishes: any[]; selectedIds: string[]; onRemove: (id: string) => void }) {
  const selected = useMemo(() => dishes.filter(d => selectedIds.includes(d.id)), [dishes, selectedIds])
  const totals = useMemo(() => {
    const total_calories = selected.reduce((sum, d) => sum + (d.calories || 0), 0)
    const total_protein = selected.reduce((sum, d) => sum + (d.protein || 0), 0)
    const total_carbs = selected.reduce((sum, d) => sum + (d.carbs || 0), 0)
    const total_fat = selected.reduce((sum, d) => sum + (d.fat || 0), 0)
    return { total_calories, total_protein, total_carbs, total_fat }
  }, [selected])

  // 详情模态框状态
  const [open, setOpen] = useState(false)
  const [activeDish, setActiveDish] = useState<any | null>(null)
  const openModal = (dish: any) => { setActiveDish(dish); setOpen(true) }
  const closeModal = () => setOpen(false)

  // ESC 关闭模态框，保持与 DishCard 一致
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

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

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">已选择菜品（{selected.length}）</h2>
        <div className="text-sm text-gray-600">
          <span className="mr-3">总热量：{totals.total_calories} 卡</span>
          <span className="mr-3">蛋白质：{totals.total_protein} g</span>
          <span className="mr-3">碳水：{totals.total_carbs} g</span>
          <span>脂肪：{totals.total_fat} g</span>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {selected.map((dish) => (
          <div
            key={dish.id}
            className="w-24 sm:w-28 aspect-square bg-gray-50 border rounded-md overflow-hidden relative flex-shrink-0 cursor-pointer hover:shadow"
            onClick={() => openModal(dish)}
          >
            <img src={buildImgSrc(dish.image_url)} alt={dish.name} className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white px-2 py-1">
              <span className="truncate text-[10px] sm:text-xs">{dish.name}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(dish.id) }}
              className="absolute top-1 right-1 bg-white/30 text-white rounded-full p-1 hover:bg-white/40 ring-1 ring-white/60"
              aria-label="删除"
            >
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
        ))}
      </div>

      {open && activeDish && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-center justify-center p-4" onClick={closeModal}>
            <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-lg font-semibold text-gray-900">{activeDish.name}</h3>
                <button onClick={closeModal} className="p-2 rounded hover:bg-gray-100">
                  {/* 与 DishCard 相同的关闭图标样式 */}
                  <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
              <div className="p-4 max-h-[70vh] overflow-y-auto">
            <img src={buildImgSrc(activeDish.image_url)} alt={activeDish.name} className="w-full h-56 object-cover rounded" />
                <div className="mt-4 flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(activeDish.category)}`}>{activeDish.category}</span>
                  <span className="text-xs text-gray-500">热量：{activeDish.calories || 0} 卡</span>
                  <span className="text-xs text-gray-500">蛋白质：{activeDish.protein || 0} g</span>
                  <span className="text-xs text-gray-500">碳水：{activeDish.carbs || 0} g</span>
                  <span className="text-xs text-gray-500">脂肪：{activeDish.fat || 0} g</span>
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">食材</h4>
                  <div className="flex flex-wrap gap-2">
                    {activeDish.ingredients.split(/[,，]/).map((ing: string, idx: number) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {ing.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                {(() => {
                  const rawSteps = activeDish.cooking_steps || ''
                  const isNumbered = /\d+\s*[、\.．。]/.test(rawSteps)
                  const steps = (
                    isNumbered
                      ? rawSteps.split(/(?=\d+\s*[、\.．。])/) 
                      : rawSteps.includes('\n')
                        ? rawSteps.split(/\r?\n/)
                        : rawSteps.split(/；|;/)
                  ).map(s => s.trim()).filter(Boolean)
                  return steps.length > 0 ? (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-800 mb-2">制作方法</h4>
                      <div className="space-y-2">
                        {steps.map((step: string, idx: number) => (
                          <p key={idx} className="text-sm leading-6 text-gray-700">{step}</p>
                        ))}
                      </div>
                    </div>
                  ) : null
                })()}
              </div>
              <div className="px-4 py-3 border-t flex justify-end gap-2">
                <button className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={closeModal}>
                  关闭
                </button>
                <button
                  className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600"
                  onClick={() => { onRemove(activeDish.id); closeModal() }}
                >
                  删除此菜
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
  const buildImgSrc = (path?: string) => {
    const base = (import.meta as any).env.BASE_URL || '/'
    if (!path) return base + 'favicon.svg'
    if (/^https?:\/\//.test(path) || /^data:/.test(path)) return path
    if (path.startsWith('/')) return base + path.slice(1)
    return base + path
  }
