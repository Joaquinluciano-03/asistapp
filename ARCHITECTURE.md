# Arquitectura de AsistApp

> Mapa de referencia técnica del sistema. Generado a partir de un análisis completo del proyecto para consulta futura.

## 1. Resumen del proyecto

AsistApp es una aplicación web para gestionar la asistencia escolar mediante **carnets digitales con código QR firmado**. El personal de la escuela (preceptores/admins) escanea el QR del carnet de un estudiante para registrar su llegada tarde, con distinción de turno (mañana/tarde). Los estudiantes acceden a su propio panel para ver/descargar su carnet.

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework UI | React 19 |
| Bundler/dev server | Vite 8 (`@vitejs/plugin-react`) |
| Lenguaje | TypeScript (modo estricto) |
| Estilos | Tailwind CSS v4 (`@tailwindcss/vite`, config inline en `src/index.css`) |
| Ruteo | react-router-dom v7 |
| Backend / DB / Auth | Supabase (Postgres + Supabase Auth con Google OAuth + RLS) |
| Validación | zod (`src/schemas/studentSchema.ts`) |
| QR | `qrcode` (generación), `html5-qrcode` (escaneo por cámara) |
| Export | `xlsx` (planillas Excel) |
| Hosting | Netlify (`netlify.toml`, SPA redirect, Node 20) |

No hay Redux/Zustand: el estado global se maneja con React Context (`AuthContext`, `ToastContext`). No hay carpeta `hooks/` ni `services/`: la lógica de Supabase vive inline en cada página.

## 3. Estructura de carpetas

```
asistapp/
├── index.html                  # entry HTML, monta #root, carga /src/main.tsx
├── netlify.toml                 # SPA redirect + build config (Node 20)
├── vite.config.ts               # plugins react() + tailwindcss()
├── tsconfig.json                # ES2020, strict, noEmit
├── .env.example                 # documenta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
├── netlify/functions/
│   ├── keep-alive.ts             # cron diario, ping a Supabase (ver §8)
│   └── reset-anual.ts            # cron diario, limpia llegadas_tarde solo el 31/12 (ver §8)
├── supabase/migrations/
│   ├── 001_initial_schema.sql    # tablas, enum de roles, RLS
│   ├── 002_fix_unique_constraint.sql
│   ├── 003_add_preceptor_role.sql
│   ├── 004_fix_rls_and_reset.sql # RLS de preceptor, edición/borrado de alumnos, reset (ver §5 y §7)
│   ├── 005_scale_hardening.sql   # RPC de métricas, índices, TRUNCATE anual (ver §11)
│   ├── 006_dashboard_periodos.sql # RPC de métricas hoy/semana/mes (ver §7)
│   ├── 007_fix_profiles_read_policy.sql # agrega preceptor a la lectura de profiles
│   └── 008_cleanup_student_on_role_change.sql # limpia la ficha de alumno al ascender a staff (ver §7)
└── src/
    ├── main.tsx                  # bootstrap: createRoot + <StrictMode><App /></StrictMode>
    ├── App.tsx                   # BrowserRouter + rutas (ver §4)
    ├── index.css                  # Tailwind + estilos globales
    ├── components/
    │   ├── Navbar.tsx
    │   ├── ProtectedRoute.tsx      # guard de rutas por rol
    │   ├── QRGenerator.tsx         # genera el carnet + QR firmado (ver §6)
    │   ├── QRScanner.tsx           # cámara + decodificación (html5-qrcode)
    │   └── HelpModal.tsx
    ├── context/
    │   ├── AuthContext.tsx         # sesión, perfil, rol (ver §5)
    │   └── ToastContext.tsx        # notificaciones
    ├── lib/
    │   └── supabaseClient.ts       # cliente Supabase + tipos Profile/Student/LlegadaTarde
    ├── pages/
    │   ├── Login.tsx
    │   ├── EstudianteDashboard.tsx
    │   ├── AdminDashboard.tsx
    │   ├── AdminScanner.tsx        # flujo de escaneo/registro, incluye buscador manual (ver §6-7)
    │   ├── GestionUsuarios.tsx     # alta/baja/roles de usuarios
    │   └── Planillas.tsx           # exportación de asistencia
    ├── schemas/
    │   └── studentSchema.ts        # validación zod
    └── utils/
        ├── crypto.ts                # firma + cifrado del QR (ver §6)
        ├── turno.ts                 # cálculo de turno mañana/tarde (huso AR)
        └── exportExcel.ts           # export a Excel para Planillas.tsx
```

## 4. Bootstrap y ruteo

`index.html` → `src/main.tsx` (`createRoot(...).render(<StrictMode><App/></StrictMode>)`) → `App.tsx`:

```
BrowserRouter
 └─ AuthProvider
     └─ ToastProvider
         └─ Suspense (PageLoader) — todas las páginas son React.lazy
```

Rutas (`STAFF_ROLES = ['preceptor', 'admin', 'superadmin']`):

| Ruta | Página | Roles permitidos |
|---|---|---|
| `/login` | `Login` | pública |
| `/estudiante` | `EstudianteDashboard` | `estudiante` |
| `/admin` | `AdminDashboard` | staff |
| `/admin/escanear` | `AdminScanner` | staff |
| `/admin/planillas` | `Planillas` | staff |
| `/admin/usuarios` | `GestionUsuarios` | staff |
| `/`, `*` | redirect | → `/login` |

`ProtectedRoute.tsx` lee `useAuth()`: sin sesión → `/login`; rol no permitido → redirige a `/estudiante` o `/admin` según corresponda.

## 5. Autenticación y roles

**`src/context/AuthContext.tsx`** — backend Supabase Auth (no Firebase). Expone `session`, `user`, `profile`, `role`, `loading`, `signInWithGoogle()`, `signOut()`, `refreshProfile()`.

- Login **solo Google OAuth**, restringido al dominio `donorionevictoria.com.ar` (`hd` param en `signInWithOAuth`).
- Sesión persistida y refrescada automáticamente por el SDK de Supabase (`persistSession: true`, `autoRefreshToken: true`).
- Tras `SIGNED_IN`, espera 800ms antes de leer `profiles` (da tiempo a que el trigger `handle_new_user` cree la fila del perfil en el primer login).
- **Auto-recuperación de perfil:** si `fetchProfile` no encuentra fila en `profiles` (`PGRST116`) — típicamente porque un admin "eliminó" (reseteó) la cuenta — llama a la RPC `ensure_own_profile()` (`004_fix_rls_and_reset.sql`), que la recrea con rol `estudiante` por defecto (o `superadmin` si es el email designado), validando el dominio igual que el trigger original. Esto reemplazó la vieja lógica de auto-promoción/degradación de superadmin en el cliente, que nunca podía tener efecto real (la policy de roles prohíbe que un usuario cambie su propio rol).

**Roles** (enum Postgres `user_role`): `estudiante`, `preceptor`, `admin`, `superadmin`, columna `role` en tabla `profiles`.

**Restricción de acciones destructivas al rol `preceptor`** (`src/pages/GestionUsuarios.tsx`, commit `555774f`):
```ts
const canModify = (target) => {
  if (myProfile.role === 'preceptor') return false
  if (target.id === myProfile.id) return false
  if (target.role === 'superadmin') return false
  return true
}
```
Respaldo a nivel de base de datos vía RLS (`get_role()`), incluyendo desde `004_fix_rls_and_reset.sql`: `preceptor` puede leer/insertar `llegadas_tarde`, leer/editar `students`, pero no puede cambiar roles ni borrar (`profiles`/`students` DELETE solo para `admin`/`superadmin`). Un `admin` puede ascender a otro usuario a `preceptor` o `admin` (no solo `superadmin` puede — decisión de producto confirmada, cualquier admin puede crear pares admin).

**Borrado = reset, no baja permanente.** "Eliminar usuario"/"Eliminar todos los estudiantes" en `GestionUsuarios.tsx` borran la fila de `profiles` (y en cascada la de `students`, ver §7), pero **no tocan `auth.users`** — la persona puede volver a loguearse normalmente y, gracias a `ensure_own_profile()`, se le recrea un perfil `estudiante` en blanco para que vuelva a cargar sus datos o sea reasignada a un rol por un admin. El historial de `llegadas_tarde` de un alumno reseteado **se conserva** (ver §7).

No hay hook compartido `usePermissions`/`hasRole`; los chequeos de rol se hacen ad hoc (`profile.role === '...'`) en `GestionUsuarios.tsx`, `Navbar.tsx`, `AdminDashboard.tsx`, `HelpModal.tsx`, `EstudianteDashboard.tsx`.

## 6. Seguridad del QR / carnet digital

> **⚠️ Riesgo aceptado y documentado (no corregido):** la "firma" descrita abajo se genera y verifica **enteramente en el navegador**, con un salt hardcodeado en `src/utils/crypto.ts` que queda expuesto en el bundle JS. Cualquiera con DevTools puede llamar a `generateSignature(cualquier_student_id)` y producir un QR "válido" para cualquier alumno, no solo el propio — la firma no protege realmente contra la falsificación. Se decidió **no arreglarlo en esta ronda** (menor impacto porque el personal ve el nombre/grado del alumno en pantalla antes de confirmar el registro). Un arreglo de raíz requeriría mover la generación/verificación a una función RPC de Postgres con un secreto real (vía Supabase Vault), para que el secreto nunca llegue al cliente. Revisar si se retoma en una futura iteración.

**`src/utils/crypto.ts`** — firma tipo HMAC:
- `generateSignature(payload)` = `SHA-256(payload + SIGNATURE_SALT)` truncado a 16 hex (no es HMAC keyed real, pero cumple la misma función anti-forgery).
- `verifySignature(payload, signature)` recalcula y compara.
- Además, `xorEncrypt`/`xorDecrypt`: cifrado XOR simétrico (clave `'IDO'`) + Base64, para que el QR no exponga JSON plano.

**Flujo completo:**
1. **Generación** (`QRGenerator.tsx`): arma `{ sid: studentId, sig: generateSignature(studentId) }`, lo cifra con XOR y lo codifica como QR (`qrcode`, nivel de corrección `H`). Renderiza el carnet (foto/iniciales, nombre, grado/división, logo `favicon.ico` en circular) en un canvas doble faz para plegar.
2. **Escaneo** (`QRScanner.tsx`): usa `html5-qrcode` (cámara trasera, 10fps).
3. **Verificación y registro** (`AdminScanner.tsx`):
   - decodifica → `xorDecrypt` → `{ sid, sig }` → `verifySignature(sid, sig)` → rechaza si no coincide.
   - dedupe con `lastScannedId` (evita reprocesar el mismo QR mientras la cámara sigue activa; se limpia al volver a `scanning` o al cancelar/errar/confirmar).
   - máquina de estados visible (`estados intermedios`, commit `bc49355`): `scanning → confirming → verifying → registering → done`.

## 7. Modelo de datos y registro de asistencia

Tipos en `src/lib/supabaseClient.ts`:
- `Student`: `{ id, profile_id, nombre, apellido, grado, division, created_at, updated_at }`
- `Profile`: `{ id, email, role, created_at }`
- `LlegadaTarde`: `{ student_id, fecha, hora, turno, metodo, registrado_por, registrado_por_email }`

Validación con zod en `src/schemas/studentSchema.ts` (`grado` limitado a 1°–7° año, `division` A–D). **Nota:** esos valores solo se validan en el cliente — la DB los guarda como `text` libre, sin `check`/enum.

**Registro de llegada tarde** (tabla `llegadas_tarde`):
- `turno` (mañana/tarde) calculado en el cliente según huso horario argentino (`src/utils/turno.ts`, umbral ≥13hs = tarde), reflejando lo que hace un trigger en la DB.
- Doble guardia anti-duplicado: chequeo previo por `student_id + fecha + turno`, y constraint `UNIQUE` en la DB como resguardo final (error Postgres `23505` capturado y mostrado como toast amigable).
- No hay un campo de estado persistido en el registro; los "estados intermedios" son puramente de UI, no se guardan en la DB.
- **Edición retroactiva del historial (decisión de producto confirmada):** al editar nombre/grado/división de un alumno en `GestionUsuarios.tsx`, se reescriben también todos sus registros históricos en `llegadas_tarde` con los datos nuevos. Es intencional — el negocio prefiere que el historial siempre muestre los datos actuales del alumno, no una foto del momento.
- **Nota histórica:** la función `reset_student` fue eliminada por completo del código (commit `19b844e`) — no reintroducirla salvo pedido explícito.

**Borrado = reset sin perder historial** (`004_fix_rls_and_reset.sql`):
- `students.profile_id` ahora referencia `profiles.id` (antes `auth.users.id`) con `on delete cascade` → borrar un `profiles` row borra automáticamente su `students` row.
- `llegadas_tarde.student_id` es nullable con `on delete set null` (antes `on delete cascade`) → al borrarse el `students` row, sus filas en `llegadas_tarde` **sobreviven** con `student_id = null`, conservando el snapshot de nombre/apellido/grado/división ya guardado.

**Limpieza al ascender un alumno a staff** (`008_cleanup_student_on_role_change.sql`): cambiar el `role` de un perfil de `estudiante` a `preceptor`/`admin` es un `UPDATE`, no dispara la cascada del punto anterior (que solo aplica a un `DELETE`). El trigger `after_profile_role_change_cleanup` (`AFTER UPDATE on profiles`, `security definer`) detecta ese cambio de rol y borra la fila de `students` correspondiente — mismo resultado que el reset manual (el historial en `llegadas_tarde` se conserva vía `SET NULL`), pero disparado automáticamente para que la ficha de alumno de alguien que pasó a ser staff no quede huérfana ni siga siendo escaneable/buscable como alumno.

**Reset anual:** el 31 de diciembre (hora Argentina), `netlify/functions/reset-anual.ts` dispara la RPC `reset_llegadas_anual()`, que vacía **todas** las filas de `llegadas_tarde` con `TRUNCATE` (borrado definitivo, sin archivo — ver §11 sobre por qué `TRUNCATE` y no `DELETE`). No toca `profiles` ni `students`. El guard de fecha vive en la función SQL, así que es seguro invocarla todos los días — solo actúa el 31/12.

## 8. Funciones serverless

- **`netlify/functions/keep-alive.ts`** — Netlify Function (v2, `schedule: "@daily"`). Hace un `select id limit 1` sobre `profiles` usando un cliente Supabase server-side, con el único propósito de evitar que el proyecto Supabase se pause por inactividad (plan free tier).
- **`netlify/functions/reset-anual.ts`** — Netlify Function (v2, `schedule: "@daily"`). Llama a la RPC `reset_llegadas_anual()` todos los días; el guard de fecha vive del lado de Postgres (ver §7), así que solo borra `llegadas_tarde` cuando realmente es 31/12 hora Argentina. Usa la misma `VITE_SUPABASE_ANON_KEY` que `keep-alive.ts` — no requiere la `service_role` key porque la función RPC es `security definer` y se auto-protege con el guard de fecha.

## 9. Variables de entorno y despliegue

- `.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (nunca exponer la `service_role` key en el cliente).
- `netlify.toml`: redirect SPA (`/* → /index.html`), build `npm run build`, publish `dist`, Node 20.
- Scripts (`package.json`): `dev` (vite), `build` (`tsc && vite build`), `preview`. **No hay scripts de test ni de lint configurados.**

## 11. Escalabilidad — volumen real de uso

El sistema está dimensionado para hasta ~600 llegadas tarde/día (5 días/semana, 12 meses/año) → hasta ~144.000 filas en `llegadas_tarde` por año, antes del reset del 31/12. `005_scale_hardening.sql` + los cambios de código asociados atienden ese volumen:

- **Dashboard (`AdminDashboard.tsx`):** antes traía todas las filas crudas de los últimos 30 días al cliente y las reducía en JS — a este volumen (hasta ~18.000 filas en 30 días) eso superaba el límite de 1000 filas por request de Supabase/PostgREST y las métricas quedaban mal, **sin ningún aviso**. Ahora usa la RPC `dashboard_metrics_30d()` (`security invoker`, respeta RLS igual que antes), que calcula todo con `count()`/`group by` **dentro** de Postgres y devuelve un JSON chico — el tamaño de la respuesta ya no depende de cuántas filas haya atrás.
- **Planillas (`Planillas.tsx`):** el `.limit(500)` fijo se reemplazó por paginación real con `.range()` + botón **"Cargar más"** (decisión de producto: se prefirió sobre paginación numerada). El orden de la query incluye `id` como desempate final para que `.range()` sea determinístico y no salte/duplique filas cuando muchos registros comparten la misma `fecha`+`hora` (algo esperable a 600/día).
- **Exportar a Excel:** ya no depende de lo cargado en pantalla — `handleExport` pagina en el fondo (lotes de 1000 vía `.range()`) hasta traer **todo** lo que matchea el filtro actual antes de generar el archivo (decisión de producto confirmada). Si el total supera 20.000 filas, se avisa que puede tardar unos segundos.
- **Índices nuevos:** `idx_llegadas_fecha_hora` (fecha desc, hora desc) para el patrón de consulta más pesado del sistema a este volumen; `pg_trgm` + índices GIN en `students(nombre)`/`students(apellido)` para que la búsqueda `ilike '%...%'` del buscador manual en `AdminScanner.tsx` no se degrade si el padrón de alumnos también crece.
- **Reset anual:** `reset_llegadas_anual()` pasó de `DELETE` a `TRUNCATE` — mismo resultado (vacía la tabla), pero no escanea fila por fila, relevante a ~150.000 filas/año.
- **Fuera del alcance del código:** con este volumen de escrituras/lecturas diarias y picos de concurrencia en el horario de entrada, conviene confirmar que el proyecto de Supabase esté en un plan pago (no Free) — el almacenamiento no es un problema (el reset anual lo mantiene bajo), pero los límites de conexiones concurrentes del plan Free sí podrían notarse en la hora pico.

## 12. Puntos a tener en cuenta / mejoras futuras posibles

**Corregido en `004_fix_rls_and_reset.sql` + cambios de código asociados** (ver §5 y §7 para el detalle): RLS del rol `preceptor` incompleta desde la 003 (no podía escanear, ver planillas, ni ser asignado), sin policy `UPDATE` en `students` (editar alumno no persistía para nadie del staff), sin policy `UPDATE` en `llegadas_tarde` (la sincronización retroactiva del historial fallaba en silencio), sin policies `DELETE` en `profiles`/`students` (el borrado no borraba nada, con toast de éxito falso), y las mutaciones en `GestionUsuarios.tsx` no verificaban filas afectadas antes de mostrar éxito.

**Nota histórica:** existió una página `AdminManual.tsx` para carga manual de llegadas, reconectada brevemente al router. Se eliminó por completo — el buscador manual ya integrado en `AdminScanner.tsx` (búsqueda por nombre/apellido + registro sin escanear QR) cubre el mismo caso de uso, así que la página separada era redundante.

**Pendiente / riesgo aceptado:**
- **Firma del QR falsa** (§6) — decisión explícita de no arreglar por ahora. Ver el detalle en esa sección.
- No hay capa de servicios/hooks reutilizables: toda llamada a Supabase está inline en las páginas, lo que dificulta testear o reutilizar lógica.
- No hay tests ni linter configurados en el proyecto.
- `grado`/`division` siguen sin validación a nivel de base de datos (solo Zod en el cliente) — un alumno con DevTools podría guardar un valor fuera de la lista y quedar invisible en los filtros exactos de Planillas.
