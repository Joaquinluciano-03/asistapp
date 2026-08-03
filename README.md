# AsistApp — Registro de Llegadas Tarde
### Escuela Don Orione Victoria

Sistema web para registrar llegadas tarde de alumnos mediante escaneo de QR o carga manual. Construido con **React + Vite + TypeScript + Tailwind CSS + Supabase**.

---

## Stack Tecnológico

| Categoría | Tecnología |
|-----------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Estilos | Tailwind CSS v4 |
| Ruteo | React Router v6 |
| Base de datos + Auth | Supabase (Postgres + Auth + RLS) |
| Login | Google OAuth via Supabase |
| QR Generar | `qrcode` |
| QR Escanear | `html5-qrcode` |
| Excel | `xlsx` (SheetJS) |
| Validaciones | `zod` |
| Hosting | Netlify |

---

## Variables de Entorno

Creá un archivo `.env` en la raíz del proyecto (nunca lo subas al repo):

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...tu-anon-key
```

> ⚠️ **NUNCA** pongas la `service_role` key en el frontend ni en el repositorio.

---

## Configuración Paso a Paso

### 1. Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En el SQL Editor, ejecutá el archivo completo:
   ```
   supabase/migrations/001_initial_schema.sql
   ```
3. Verificá que en **Table Editor** se hayan creado las tablas `profiles`, `students` y `llegadas_tarde`.
4. En **Authentication → Providers**, habilitá **Google** y completá el Client ID y Client Secret (los obtenés en el paso 3).
5. En **Authentication → URL Configuration**:
   - **Site URL**: `https://tu-app.netlify.app`
   - **Redirect URLs**: `https://tu-app.netlify.app`, `http://localhost:5173`

### 2. Google Cloud Console

1. Ingresá a [console.cloud.google.com](https://console.cloud.google.com).
2. Creá un proyecto o usá uno existente.
3. Ve a **APIs & Services → OAuth consent screen**:
   - Tipo: **Interno** (para que solo funcione para el Workspace del colegio `@donorionevictoria.com.ar`).
   - Completá nombre de app, email de soporte, etc.
4. Ve a **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**:
   - Tipo de aplicación: **Web application**.
   - **Authorized JavaScript origins**:
     ```
     https://tu-app.netlify.app
     http://localhost:5173
     ```
   - **Authorized redirect URIs**:
     ```
     https://<TU-PROYECTO-ID>.supabase.co/auth/v1/callback
     ```
5. Copiá el **Client ID** y **Client Secret** y pegálos en Supabase (paso 1.4).

### 3. Correr en Local

```bash
# 1. Clonás el repo
git clone <url-del-repo>
cd asistapp

# 2. Instalás dependencias
npm install

# 3. Creás el .env
cp .env.example .env
# Editás .env con tus claves reales

# 4. Levantás el servidor de desarrollo
npm run dev
```

Abrí [http://localhost:5173](http://localhost:5173).

### 4. Despliegue en Netlify

1. Conectá el repositorio en [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**.
2. Configurá:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. En **Environment variables** agregá:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. El archivo `netlify.toml` ya configura las redirecciones SPA automáticamente.
5. Hacé deploy y copiá la URL de Netlify para actualizar los **Redirect URLs** en Supabase y Google Cloud.

---

## Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **estudiante** | Completar datos, generar y descargar su propio QR. |
| **admin** | Escanear QR, carga manual, ver planillas, exportar Excel, gestionar roles (entre estudiante y admin). |
| **superadmin** | Todo lo del admin + gestionar todos los roles. No puede ser degradado por un admin. |

### Asignación automática
- El email `asistencia@donorionevictoria.com.ar` recibe `superadmin` automáticamente al registrarse.
- Todos los demás usuarios nuevos reciben `estudiante` por defecto.
- Solo emails `@donorionevictoria.com.ar` pueden ingresar (enforced en trigger de BD).

---

## Arquitectura del Proyecto

```
src/
  lib/
    supabaseClient.ts       # Cliente Supabase + tipos
  context/
    AuthContext.tsx          # Sesión, rol, signIn/Out, refreshProfile
    ToastContext.tsx         # Notificaciones toast globales
  components/
    ProtectedRoute.tsx       # Guard de rutas por rol
    Navbar.tsx               # Barra de navegación con rol
    QRGenerator.tsx          # Genera QR en canvas con info del alumno
    QRScanner.tsx            # Escaneo de cámara con html5-qrcode
  pages/
    Login.tsx                # Pantalla de login con Google OAuth
    EstudianteDashboard.tsx  # Formulario + generación de QR
    AdminDashboard.tsx       # Panel principal del admin
    AdminScanner.tsx         # Escaneo QR + confirmación + registro
    AdminManual.tsx          # Carga manual con búsqueda de alumno
    Planillas.tsx            # Tabla filtrable + exportación Excel
    GestionUsuarios.tsx      # Listado y cambio de roles
  utils/
    exportExcel.ts           # Exportación a .xlsx con SheetJS
  schemas/
    studentSchema.ts         # Validaciones zod

supabase/
  migrations/
    001_initial_schema.sql   # Enums, tablas, triggers, RLS

netlify.toml                 # Configuración Netlify
.env.example                 # Variables de entorno de ejemplo
```

---

## Regla de Turno

El cálculo se realiza **100% del lado del servidor** mediante un trigger `BEFORE INSERT` en Postgres (zona horaria `America/Argentina/Buenos_Aires`):

- **≥ 13:00** → turno `tarde`
- **< 13:00** → turno `mañana`

El cliente **solo envía** `student_id`, `metodo`, `registrado_por` y `registrado_por_email`. El resto lo completa el servidor.

---

## Seguridad

- **RLS activo** en todas las tablas como barrera principal.
- **Trigger de dominio**: solo emails `@donorionevictoria.com.ar` pueden crear perfil (error de BD si no).
- **Guards de ruta** en el frontend por rol.
- **Validación con zod** en todos los formularios (trim, longitud, formato).
- **Solo `anon key`** en el cliente. La `service_role` key jamás va al frontend.
- Las consultas usan el cliente Supabase JS (PostgREST parametrizado). Nunca se concatena SQL del usuario.

---

## Criterios de Aceptación

- [x] Solo emails `@donorionevictoria.com.ar` pueden iniciar sesión.
- [x] `asistencia@donorionevictoria.com.ar` obtiene `superadmin` automáticamente.
- [x] Nuevos usuarios reciben `estudiante` por defecto.
- [x] Estudiante puede completar datos, generar y descargar su QR.
- [x] Admin puede escanear QR y registrar llegada tarde.
- [x] Admin puede registrar llegada tarde manualmente.
- [x] Fecha/hora/turno calculados del lado del servidor (horario Argentina).
- [x] Planillas filtrables y exportables a Excel (.xlsx).
- [x] Admin/superadmin puede administrar roles con las reglas definidas.
- [x] RLS activo y validación zod en todos los formularios.
- [x] Desplegable en Netlify con el login de Google funcionando.
