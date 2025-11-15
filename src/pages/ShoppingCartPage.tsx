import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useShoppingCartStore, Ingredient } from '@/stores/shoppingCartStore'
import { ShoppingCart, Plus, Edit, Minus, Trash2, Save, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

export function ShoppingCartPage() {
  const { user } = useAuthStore()
  const { 
    ingredients, 
    loading, 
    loadCart, 
    addIngredient, 
    removeIngredient, 
    updateIngredient,
    clearCart, 
    saveCart 
  } = useShoppingCartStore()
  
  const [newIngredient, setNewIngredient] = useState({ name: '', quantity: '', unit: '' })
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editIngredient, setEditIngredient] = useState<Ingredient>({ name: '', quantity: '', unit: '' })

  useEffect(() => {
    if (user) {
      loadCart(user.id)
    }
  }, [user, loadCart])

  const handleAddIngredient = () => {
    if (newIngredient.name.trim() && newIngredient.quantity.trim()) {
      addIngredient(newIngredient)
      setNewIngredient({ name: '', quantity: '', unit: '' })
      toast.success('食材已添加到购物车')
    }
  }

  const handleRemoveIngredient = (index: number) => {
    removeIngredient(index)
    toast.success('食材已移除')
  }

  const handleEditIngredient = (index: number) => {
    setEditingIndex(index)
    setEditIngredient(ingredients[index])
  }

  const handleSaveEdit = () => {
    if (editingIndex !== null && editIngredient.name.trim() && editIngredient.quantity.trim()) {
      updateIngredient(editingIndex, editIngredient)
      setEditingIndex(null)
      toast.success('食材已更新')
    }
  }

  const handleSaveCart = async () => {
    if (!user) {
      toast.error('请先登录')
      return
    }
    
    try {
      await saveCart(user.id)
      toast.success('购物车已保存')
    } catch (error) {
      toast.error('保存失败，请重试')
    }
  }

  const handleExportList = () => {
    const listText = ingredients
      .map(ing => `${ing.name} - ${ing.quantity}${ing.unit}`)
      .join('\n')
    
    const blob = new Blob([`购物清单\n\n${listText}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '购物清单.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('购物清单已导出')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">请先登录</h2>
          <Link to="/auth" className="text-orange-600 hover:text-orange-700 font-medium">
            前往登录
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold text-orange-600">今天吃什么</Link>
              <div className="flex gap-3 sm:gap-4 overflow-x-auto whitespace-nowrap">
                <Link to="/" className="text-gray-600 hover:text-gray-900">菜单</Link>
                <Link to="/calendar" className="text-gray-600 hover:text-gray-900">日历</Link>
                <Link to="/nutrition" className="text-gray-600 hover:text-gray-900">营养分析</Link>
                {/** 设置入口已移除 */}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-gray-600 hover:text-gray-900">返回菜单</Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <ShoppingCart className="w-8 h-8 text-orange-600" />
              <h1 className="text-2xl font-bold text-gray-900">购物清单</h1>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleExportList}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>导出清单</span>
              </button>
              <button
                onClick={handleSaveCart}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>保存</span>
              </button>
              <button
                onClick={() => clearCart(user.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                清空
              </button>
            </div>
          </div>

          {/* 添加新食材 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">添加食材</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="食材名称"
                value={newIngredient.name}
                onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="数量"
                value={newIngredient.quantity}
                onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="单位（如：克、个、斤）"
                value={newIngredient.unit}
                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                onClick={handleAddIngredient}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>添加</span>
              </button>
            </div>
          </div>

          {/* 食材列表 */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">加载中...</p>
            </div>
          ) : ingredients.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">购物车为空</p>
              <p className="text-gray-500 text-sm mt-2">从菜单中选择菜品或手动添加食材</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ingredients.map((ingredient, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  {editingIndex === index ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input
                        type="text"
                        value={editIngredient.name}
                        onChange={(e) => setEditIngredient({ ...editIngredient, name: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={editIngredient.quantity}
                        onChange={(e) => setEditIngredient({ ...editIngredient, quantity: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={editIngredient.unit}
                        onChange={(e) => setEditIngredient({ ...editIngredient, unit: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingIndex(null)}
                          className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="font-medium text-gray-900">{ingredient.name}</span>
                        <span className="text-gray-600">
                          {ingredient.quantity}{ingredient.unit}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditIngredient(index)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveIngredient(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 统计信息 */}
          {ingredients.length > 0 && (
            <div className="mt-8 p-4 bg-orange-50 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-900 mb-2">购物清单统计</h3>
              <p className="text-orange-800">共 {ingredients.length} 种食材</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}