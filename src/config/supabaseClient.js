// src/config/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)?.trim()

const missingVariables = []

if (!supabaseUrl) missingVariables.push('VITE_SUPABASE_URL')
if (!supabaseKey) {
  missingVariables.push(
    'VITE_SUPABASE_ANON_KEY（或 VITE_SUPABASE_PUBLISHABLE_KEY）'
  )
}

export const supabaseConfigError =
  missingVariables.length > 0
    ? `缺少 Supabase 环境变量：${missingVariables.join('、')}`
    : ''

// Missing deployment configuration must not crash the entire guest experience.
export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseKey)
