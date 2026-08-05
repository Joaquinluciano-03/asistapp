import { createClient } from '@supabase/supabase-js'

export default async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Variables de entorno de Supabase no definidas en Netlify')
    return new Response('Configuración incompleta', { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // reset_llegadas_anual() solo borra llegadas_tarde si hoy es 31/12
    // (hora Argentina) — el guard de fecha vive en la función SQL, así que
    // llamarla todos los días es seguro y no requiere la service_role key.
    const { error } = await supabase.rpc('reset_llegadas_anual')

    if (error) {
      console.error('Error al ejecutar reset_llegadas_anual:', error)
      return new Response(`Error: ${error.message}`, { status: 500 })
    }

    console.log('✅ reset_llegadas_anual ejecutado (borra solo si es 31/12).')
    return new Response('Reset anual verificado', { status: 200 })
  } catch (err) {
    console.error('Excepción al conectar con Supabase:', err)
    return new Response('Error interno del servidor', { status: 500 })
  }
}

// Configuración de Netlify Functions (v2) para que se ejecute diariamente
export const config = {
  schedule: '@daily', // El guard de fecha dentro de la función SQL decide si borra algo
}
