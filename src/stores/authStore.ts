import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw error
    set({ user: data.user })
  },
  
  register: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) throw error
    set({ user: data.user })
  },
  
  logout: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    set({ user: null })
  },
  
  checkAuth: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    set({ user, loading: false })
  },
}))