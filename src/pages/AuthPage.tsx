import { useState } from 'react'
import { LoginForm } from '@/components/LoginForm'
import { RegisterForm } from '@/components/RegisterForm'
import { Toaster } from 'sonner'

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">今天吃什么</h1>
          <p className="text-gray-600">智能用餐推荐，解决你的选择困难症</p>
        </div>
        
        {isLogin ? (
          <LoginForm onToggle={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onToggle={() => setIsLogin(true)} />
        )}
        
        <Toaster position="top-right" />
      </div>
    </div>
  )
}