import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { BarChart3, TrendingUp, PieChart, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

export function NutritionPage() {
  const { user } = useAuthStore()
  const { mealHistory, loading, loadMealHistory } = useCalendarStore()
  const [timeRange, setTimeRange] = useState('7') // 今天、7天、30天、90天
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')

  useEffect(() => {
    if (user) {
      loadMealHistory(user.id)
    }
  }, [user, loadMealHistory])

  const getFilteredMeals = () => {
    // 当选择“今天”时，只返回今天的数据
    if (timeRange === '1') {
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      const todayStr = `${yyyy}-${mm}-${dd}`

      const toDateStr = (d: any) => {
        if (!d) return ''
        if (typeof d === 'string') return d.slice(0, 10)
        try {
          return new Date(d).toISOString().slice(0, 10)
        } catch {
          return ''
        }
      }

      return mealHistory.filter((meal) => toDateStr(meal.meal_date) === todayStr)
    }

    // 默认：最近N天
    const days = parseInt(timeRange)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    return mealHistory.filter(meal => new Date(meal.meal_date) >= cutoffDate)
  }

  const getNutritionData = () => {
    const filteredMeals = getFilteredMeals()
    const dailyData: { [key: string]: { date: string; calories: number; protein: number; carbs: number; fat: number } } = {}
    
    filteredMeals.forEach(meal => {
      const date = meal.meal_date
      if (!dailyData[date]) {
        dailyData[date] = { date, calories: 0, protein: 0, carbs: 0, fat: 0 }
      }
      dailyData[date].calories += meal.total_calories
      dailyData[date].protein += meal.total_protein
      dailyData[date].carbs += meal.total_carbs
      dailyData[date].fat += meal.total_fat
    })
    
    return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date))
  }

  const getTotalNutrition = () => {
    const filteredMeals = getFilteredMeals()
    return filteredMeals.reduce(
      (total, meal) => ({
        calories: total.calories + meal.total_calories,
        protein: total.protein + meal.total_protein,
        carbs: total.carbs + meal.total_carbs,
        fat: total.fat + meal.total_fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
  }

  const getAverageNutrition = () => {
    // 按天平均：今天=当日总量；其他时间范围=每日平均
    const daily = getNutritionData()
    const dayCount = daily.length
    
    if (dayCount === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 }

    const totals = daily.reduce(
      (acc, d) => ({
        calories: acc.calories + (d.calories || 0),
        protein: acc.protein + (d.protein || 0),
        carbs: acc.carbs + (d.carbs || 0),
        fat: acc.fat + (d.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )

    // 如果选择的是"今天"，直接返回总量（因为只统计了一天）
    if (timeRange === '1') {
      return {
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
      }
    }

    // 其他时间范围：计算真正的平均值（基于选择的天数，而不是有数据的天数）
    const selectedDays = parseInt(timeRange)
    return {
      calories: Math.round(totals.calories / selectedDays),
      protein: Math.round(totals.protein / selectedDays),
      carbs: Math.round(totals.carbs / selectedDays),
      fat: Math.round(totals.fat / selectedDays),
    }
  }

  const getPieChartData = () => {
    const avg = getAverageNutrition()
    const total = avg.protein + avg.carbs + avg.fat
    if (total === 0) return []
    
    return [
      { name: '蛋白质', value: avg.protein, color: '#3B82F6' },
      { name: '碳水化合物', value: avg.carbs, color: '#10B981' },
      { name: '脂肪', value: avg.fat, color: '#F59E0B' },
    ]
  }

  // 今日总热量（不随时间范围变化）
  const getTodayCalories = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const todayStr = `${yyyy}-${mm}-${dd}`

    // 兼容字符串或Date类型的 meal_date
    const toDateStr = (d: any) => {
      if (!d) return ''
      if (typeof d === 'string') return d.slice(0, 10)
      try {
        return new Date(d).toISOString().slice(0, 10)
      } catch {
        return ''
      }
    }

    const todaysMeals = mealHistory.filter((meal) => toDateStr(meal.meal_date) === todayStr)
    const total = todaysMeals.reduce((sum, meal) => sum + (meal.total_calories || 0), 0)
    return Math.round(total)
  }

  const nutritionData = getNutritionData()
  const totalNutrition = getTotalNutrition()
  const averageNutrition = getAverageNutrition()
  const pieChartData = getPieChartData()
  const todayCalories = getTodayCalories()

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">请先登录</h2>
          <Link to="/auth" className="text-green-600 hover:text-green-700 font-medium">
            前往登录
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold text-green-600">今天吃什么</Link>
              <div className="flex gap-3 sm:gap-4 overflow-x-auto whitespace-nowrap">
                <Link to="/" className="text-gray-600 hover:text-gray-900">菜单</Link>
                <Link to="/cart" className="text-gray-600 hover:text-gray-900">购物车</Link>
                <Link to="/calendar" className="text-gray-600 hover:text-gray-900">日历</Link>
                {/** 设置入口已移除 */}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <Link to="/" className="text-gray-600 hover:text-gray-900">返回菜单</Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-8 h-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">营养分析</h1>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="1">今天</option>
                <option value="7">最近7天</option>
                <option value="30">最近30天</option>
                <option value="90">最近90天</option>
              </select>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as 'bar' | 'pie')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="bar">柱状图</option>
                <option value="pie">饼图</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">加载中...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* 统计卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold text-green-900">{averageNutrition.calories}</div>
                      <div className="text-sm text-green-700">平均热量（卡）</div>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <PieChart className="w-6 h-6 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold text-blue-900">{averageNutrition.protein}g</div>
                      <div className="text-sm text-blue-700">平均蛋白质</div>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <PieChart className="w-6 h-6 text-yellow-600" />
                    <div>
                      <div className="text-2xl font-bold text-yellow-900">{averageNutrition.carbs}g</div>
                      <div className="text-sm text-yellow-700">平均碳水</div>
                    </div>
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <PieChart className="w-6 h-6 text-orange-600" />
                    <div>
                      <div className="text-2xl font-bold text-orange-900">{averageNutrition.fat}g</div>
                      <div className="text-sm text-orange-700">平均脂肪</div>
                    </div>
                  </div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-6 h-6 text-indigo-600" />
                    <div>
                      <div className="text-2xl font-bold text-indigo-900">{todayCalories}</div>
                      <div className="text-sm text-indigo-700">今日热量（卡）</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 图表 */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {timeRange === '1' ? '今日营养摄入' : `营养摄入趋势（最近${timeRange}天）`}
                </h3>
                
                {chartType === 'bar' ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={nutritionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                        formatter={(value, name) => [value, name === 'calories' ? '热量(卡)' : name === 'protein' ? '蛋白质(g)' : name === 'carbs' ? '碳水(g)' : '脂肪(g)']}
                      />
                      <Legend />
                      <Bar dataKey="calories" fill="#10B981" name="热量" />
                      <Bar dataKey="protein" fill="#3B82F6" name="蛋白质" />
                      <Bar dataKey="carbs" fill="#F59E0B" name="碳水化合物" />
                      <Bar dataKey="fat" fill="#EF4444" name="脂肪" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full flex items-center justify-center">
                    {pieChartData.length === 0 ? (
                      <div className="text-center py-16 text-gray-600">
                        <PieChart className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <p>暂无饼图数据，请调整时间范围或记录一餐。</p>
                      </div>
                    ) : (
                      <div className="w-full max-w-xl h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={120}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value}g`, '']} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 详细统计 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">总摄入统计</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">总热量：</span>
                      <span className="font-semibold">{Math.round(totalNutrition.calories)} 卡</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">总蛋白质：</span>
                      <span className="font-semibold">{Math.round(totalNutrition.protein)} 克</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">总碳水化合物：</span>
                      <span className="font-semibold">{Math.round(totalNutrition.carbs)} 克</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">总脂肪：</span>
                      <span className="font-semibold">{Math.round(totalNutrition.fat)} 克</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">营养建议</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>• 建议每日热量摄入：1800-2200 卡</p>
                    <p>• 蛋白质应占总热量的 10-15%</p>
                    <p>• 碳水化合物应占总热量的 50-65%</p>
                    <p>• 脂肪应占总热量的 20-30%</p>
                    {averageNutrition.calories > 2200 && (
                      <p className="text-orange-600 font-medium">⚠️ 您的平均热量摄入偏高</p>
                    )}
                    {averageNutrition.calories < 1500 && (
                      <p className="text-blue-600 font-medium">⚠️ 您的平均热量摄入偏低</p>
                    )}
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