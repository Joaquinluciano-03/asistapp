import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Guard: if env vars not set, use placeholder values so the app doesn't crash
// during local development without a .env file.
const url = supabaseUrl || 'https://placeholder.supabase.co'
const key = supabaseAnonKey || 'placeholder-anon-key'

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const SUPABASE_CONFIGURED = Boolean(supabaseUrl && supabaseAnonKey)

export type UserRole = 'estudiante' | 'admin' | 'superadmin'

export interface Profile {
  id: string
  email: string
  role: UserRole
  created_at: string
}

export interface Student {
  id: string
  profile_id: string
  nombre: string
  apellido: string
  grado: string
  division: string
  created_at: string
  updated_at: string
}

export interface LlegadaTarde {
  id: string
  student_id: string
  nombre: string
  apellido: string
  grado: string
  division: string
  fecha: string
  hora: string
  turno: 'mañana' | 'tarde'
  metodo: 'qr' | 'manual'
  registrado_por: string | null
  registrado_por_email: string | null
  created_at: string
}
