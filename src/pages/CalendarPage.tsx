import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { Calendar, Trash2, Clock, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

export function CalendarPage() {
  const { user } = useAuthStore()
  const { mealHistory, loading, loadMealHistory, deleteMealHistory } = useCalendarStore()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (user) {
      loadMealHistory(user.id)
    }
  }, [user, loadMealHistory])

  const handleDeleteMeal = async (mealId: string) => {
    if (confirm('确定要删除这条用餐记录吗？')) {
      try {
        await deleteMealHistory(mealId)
        toast.success('用餐记录已删除')
      } catch (error) {
        toast.error('删除失败，请重试')
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  }

  const getMealsByDate = () => {
    const selectedDateStr = selectedDate
    return mealHistory.filter(meal => meal.meal_date === selectedDateStr)
  }

  const getMealsByMonth = () => {
    const selectedMonth = selectedDate.substring(0, 7)
    return mealHistory.filter(meal => meal.meal_date.startsWith(selectedMonth))
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">请先登录</h2>
          <Link to="/auth" className="text-blue-600 hover:text-blue-700 font-medium">
            前往登录
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold text-blue-600">今天吃什么</Link>
              <div className="flex gap-3 sm:gap-4 overflow-x-auto whitespace-nowrap">
                <Link to="/" className="text-gray-600 hover:text-gray-900">菜单</Link>
                <Link to="/cart" className="text-gray-600 hover:text-gray-900">购物车</Link>
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

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Calendar className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">用餐日历</h1>
          </div>

          {/* 日期选择器 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择日期查看用餐记录
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">加载中...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 选中日期的用餐记录 */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {formatDate(selectedDate)} 的用餐记录
                </h2>
                {getMealsByDate().length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Utensils className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">这一天还没有用餐记录</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getMealsByDate().map((meal) => (
                      <div key={meal.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-gray-600">
                              {new Date(meal.created_at).toLocaleTimeString('zh-CN')}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteMeal(meal.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                          {meal.dishes.map((dish, index) => (
                            <div key={index} className="bg-gray-50 rounded-lg p-3">
                              <h4 className="font-medium text-gray-900">{dish.name}</h4>
                              <p className="text-sm text-gray-600">{dish.category}</p>
                            </div>
                          ))}
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          <span className="mr-4">总热量: {meal.total_calories} 卡</span>
                          <span className="mr-4">蛋白质: {meal.total_protein} 克</span>
                          <span className="mr-4">碳水: {meal.total_carbs} 克</span>
                          <span>脂肪: {meal.total_fat} 克</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 本月统计 */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">
                  {selectedDate.substring(0, 7)} 用餐统计
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {getMealsByMonth().length}
                    </div>
                    <div className="text-sm text-blue-800">用餐次数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {getMealsByMonth().reduce((sum, meal) => sum + meal.dishes.length, 0)}
                    </div>
                    <div className="text-sm text-blue-800">菜品总数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(getMealsByMonth().reduce((sum, meal) => sum + meal.total_calories, 0))}
                    </div>
                    <div className="text-sm text-blue-800">总热量（卡）</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {getMealsByMonth().length > 0 
                        ? Math.round(getMealsByMonth().reduce((sum, meal) => sum + meal.total_calories, 0) / getMealsByMonth().length)
                        : 0
                      }
                    </div>
                    <div className="text-sm text-blue-800">平均热量（卡）</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}