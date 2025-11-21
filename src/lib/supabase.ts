import { createClient } from '@supabase/supabase-js'

let supabase: any = null
let isMockSupabase = false

type Row = Record<string, any>
type TableStore = Record<string, Row[]>

const DB_STORAGE_KEY = 'mock-supabase-db'

function readDB(): TableStore {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeDB(db: TableStore) {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db))
  } catch {}
}

function isValidHttpUrl(value?: string) {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function isPlaceholder(value?: string) {
  if (!value) return true
  const lower = value.toLowerCase()
  return lower.includes('your_supabase_url_here') || lower.includes('your_supabase_anon_key_here')
}

function createMockSupabase() {
  let db: TableStore = readDB()

  const auth = {
    signInWithPassword: async ({ email }: { email: string; password: string }) => {
      const user = { id: 'local-user', email }
      localStorage.setItem('sb-auth-token', JSON.stringify({ user }))
      return { data: { user }, error: null }
    },
    signUp: async ({ email }: { email: string; password: string }) => {
      const user = { id: 'local-user', email }
      localStorage.setItem('sb-auth-token', JSON.stringify({ user }))
      return { data: { user }, error: null }
    },
    signOut: async () => {
      localStorage.removeItem('sb-auth-token')
      return { error: null }
    },
    getUser: async () => {
      const token = localStorage.getItem('sb-auth-token')
      const user = token ? JSON.parse(token).user : null
      return { data: { user }, error: null }
    }
  }

  function makeThenable(state: any) {
    // A thenable builder so any chain end can be awaited
    return {
      select(columns: string = '*') {
        // If an action was already set (insert/upsert/update/delete), treat select as returning columns
        if (state.op && state.op !== 'select') {
          state.returning = { columns }
        } else {
          state.op = 'select'
          state.columns = columns
        }
        return this
      },
      insert(rows: any[]) {
        state.op = 'insert'
        state.payload = rows
        return this
      },
      upsert(row: any) {
        state.op = 'upsert'
        state.payload = row
        return this
      },
      delete() {
        state.op = 'delete'
        return this
      },
      update(values: any) {
        state.op = 'update'
        state.payload = values
        return this
      },
      eq(col: string, value: any) {
        state.filters.push({ col, value })
        return this
      },
      order(col: string, opts?: any) {
        state.orderBy = { col, opts }
        return this
      },
      limit(n: number) {
        state.limit = n
        return this
      },
      single() {
        state.single = true
        return this
      },
      then(resolve: any, reject: any) {
        try {
          let result: any = { data: null, error: null }

          // Ensure table exists
          if (!db[state.table]) db[state.table] = []

          const applyFilters = (rows: Row[]) => {
            let out = rows
            for (const f of state.filters) {
              out = out.filter((r) => r[f.col] === f.value)
            }
            if (state.orderBy) {
              const { col, opts } = state.orderBy
              const asc = !opts || opts.ascending !== false
              out = out.slice().sort((a, b) => {
                const va = a[col]
                const vb = b[col]
                if (va === vb) return 0
                return (va > vb ? 1 : -1) * (asc ? 1 : -1)
              })
            }
            if (typeof state.limit === 'number') {
              out = out.slice(0, state.limit)
            }
            return out
          }

          if (state.op === 'select') {
            let rows = applyFilters(db[state.table])
            result = { data: state.single ? rows[0] ?? null : rows, error: null }
          } else if (state.op === 'insert') {
            const inserted = Array.isArray(state.payload) ? state.payload : [state.payload]
            const withIds = inserted.map((r: Row) => ({
              id: r.id ?? `${state.table}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              created_at: r.created_at ?? new Date().toISOString(),
              ...r,
            }))
            db[state.table] = [...db[state.table], ...withIds]
            writeDB(db)
            const data = state.single ? withIds[0] : (state.returning ? withIds : null)
            result = { data, error: null }
          } else if (state.op === 'upsert') {
            const row: Row = state.payload
            let key = row.id
            // Use user_id as unique key for specific tables when id not provided
            if (!key && (state.table === 'shopping_cart' || state.table === 'user_configs' || state.table === 'user_selections')) {
              key = row.user_id
              const idx = db[state.table].findIndex((r) => r.user_id === row.user_id)
              if (idx >= 0) {
                db[state.table][idx] = { ...db[state.table][idx], ...row }
              } else {
                db[state.table].push({ id: `${state.table}-${Date.now()}`, ...row })
              }
            } else {
              const idx = key ? db[state.table].findIndex((r) => r.id === key) : -1
              if (idx >= 0) {
                db[state.table][idx] = { ...db[state.table][idx], ...row }
              } else {
                db[state.table].push({ id: key ?? `${state.table}-${Date.now()}`, ...row })
              }
            }
            writeDB(db)
            result = { data: null, error: null }
          } else if (state.op === 'delete') {
            const before = db[state.table]
            const filtered = before.filter((r) => !state.filters.every((f: any) => r[f.col] === f.value))
            db[state.table] = filtered
            writeDB(db)
            result = { data: null, error: null }
          } else if (state.op === 'update') {
            db[state.table] = db[state.table].map((r) => {
              const match = state.filters.every((f: any) => r[f.col] === f.value)
              return match ? { ...r, ...state.payload } : r
            })
            writeDB(db)
            result = { data: null, error: null }
          }
          return Promise.resolve(result).then(resolve, reject)
        } catch (e) {
          return Promise.reject(e).then(resolve, reject)
        }
      }
    }
  }

  return {
    auth,
    from(table: string) {
      const state = { table, op: null, payload: null, filters: [], orderBy: null, limit: null, single: false, returning: null }
      return makeThenable(state)
    }
  }
}

try {
  const fallbackUrl = 'https://moltbjqllkcqhezsejsu.supabase.co'
  const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbHRianFsbGtjcWhlenNlanN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MDc4NzEsImV4cCI6MjA3NzQ4Mzg3MX0.S1wUblAVAd5tKfMO49LKGw3H6ESnoxq9UUEG8CGm_-A'
  const url = (import.meta.env.VITE_SUPABASE_URL as string) || fallbackUrl
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || fallbackKey

  if (isValidHttpUrl(url) && !!key && !isPlaceholder(url) && !isPlaceholder(key)) {
    supabase = createClient(url as string, key as string)
    isMockSupabase = false
  } else {
    console.warn('Supabase环境变量未配置或无效，使用本地模拟客户端')
    supabase = createMockSupabase()
    isMockSupabase = true
  }
} catch (error) {
  console.error('Supabase初始化失败:', error)
  supabase = createMockSupabase()
  isMockSupabase = true
}

export { supabase, isMockSupabase }

export type Database = {
  public: {
    Tables: {
      dishes: {
        Row: {
          id: string
          name: string
          category: string
          image_url: string | null
          ingredients: string
          cooking_steps: string | null
          calories: number | null
          protein: number | null
          carbs: number | null
          fat: number | null
          is_meat: boolean | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['dishes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['dishes']['Row']>
      }
      user_selections: {
        Row: {
          id: string
          user_id: string
          dish_ids: string[]
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_selections']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_selections']['Row']>
      }
      meal_history: {
        Row: {
          id: string
          user_id: string
          dish_ids: string[]
          meal_date: string
          dishes: any[]
          total_calories: number
          total_protein: number
          total_carbs: number
          total_fat: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['meal_history']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['meal_history']['Row']>
      }
      shopping_cart: {
        Row: {
          id: string
          user_id: string
          ingredients_json: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['shopping_cart']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['shopping_cart']['Row']>
      }
      user_dishes: {
        Row: {
          id: string
          user_id: string
          name: string
          category: string
          image_url: string | null
          ingredients: string
          cooking_steps: string | null
          calories: number | null
          protein: number | null
          carbs: number | null
          fat: number | null
          is_meat: boolean | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_dishes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['user_dishes']['Row']>
      }
    }
  }
}
