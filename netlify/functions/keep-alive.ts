import { createClient } from '@supabase/supabase-js'

export default async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Variables de entorno de Supabase no definidas en Netlify')
    return new Response('Configuración incompleta', { status: 500 })
  }

  // Creamos el cliente de Supabase
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Realizamos una consulta liviana pero suficiente para registrar actividad en la BD
    // Consultamos 1 solo registro de la tabla 'profiles'
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    if (error) {
      console.error('Error al hacer ping a Supabase:', error)
      return new Response(`Error: ${error.message}`, { status: 500 })
    }

    console.log('✅ Ping a Supabase exitoso. Base de datos activa.', data)
    return new Response('Ping exitoso - Base de datos mantenida activa', { status: 200 })
  } catch (err) {
    console.error('Excepción al conectar con Supabase:', err)
    return new Response('Error interno del servidor', { status: 500 })
  }
}

// Configuración de Netlify Functions (v2) para que se ejecute diariamente
export const config = {
  schedule: "@daily" // Se ejecutará una vez al día automáticamente
}
