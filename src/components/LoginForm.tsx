import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Toaster, toast } from 'sonner'

interface LoginFormProps {
  onToggle: () => void
}

export function LoginForm({ onToggle }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await login(email, password)
      toast.success('登录成功！')
      navigate('/')
    } catch (error: any) {
      toast.error(error.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">登录</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
      <p className="text-center mt-4 text-sm text-gray-600">
        还没有账号？{' '}
        <button
          onClick={onToggle}
          className="text-orange-500 hover:text-orange-600 font-medium"
        >
          立即注册
        </button>
      </p>
    </div>
  )
}