import { useState } from 'react'

interface HelpModalProps {
  role: 'admin' | 'superadmin' | 'estudiante' | 'preceptor'
  onClose: () => void
}

interface Section {
  icon: string
  title: string
  content: React.ReactNode
}

// ── Secciones para STAFF (admin / superadmin / preceptor) ─────────────
// "Gestión de usuarios" es exclusiva de admin/superadmin: preceptor no
// tiene acceso a esa sección (gestiona alumnos desde "Alumnos").
function buildStaffSections(role: HelpModalProps['role']): Section[] {
  const isPreceptor = role === 'preceptor'

  const sections: Section[] = [
    {
      icon: '📷',
      title: 'Escanear QR',
      content: (
        <ol style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.8, fontSize: '0.83rem', color: '#cbd5e1' }}>
          <li>Ingresá a <strong>Escanear QR</strong> desde el menú superior.</li>
          <li>Apuntá la cámara al carnet del alumno hasta que se detecte automáticamente.</li>
          <li>Verificá que los datos mostrados (nombre, apellido, año y división) correspondan al alumno.</li>
          <li>Presioná <strong>Confirmar llegada tarde</strong> para registrar.</li>
          <li>Si ese alumno ya tiene una llegada registrada en el turno actual, el sistema te avisa y no permite duplicarla.</li>
          <li>Si el QR no se lee, usá el buscador manual de la misma pantalla para encontrar al alumno por nombre o apellido y registrar su llegada sin escanear.</li>
        </ol>
      ),
    },
    {
      icon: '📋',
      title: 'Planillas de asistencia',
      content: (
        <ol style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.8, fontSize: '0.83rem', color: '#cbd5e1' }}>
          <li>Ingresá a <strong>Planillas</strong> desde el menú.</li>
          <li>Filtrá por rango de fechas, turno (mañana/tarde), año o división usando los controles.</li>
          <li>La tabla muestra cada llegada tarde con fecha, hora, turno, método (QR, manual o retroactivo) y quién la registró.</li>
          <li>La tabla muestra los primeros 500 registros; si hay más, aparece el botón <strong>"Cargar más"</strong> abajo para seguir viendo.</li>
          <li>Usá <strong>Exportar a Excel</strong> para descargar el informe del período filtrado — el archivo siempre incluye <strong>todos</strong> los registros que matchean el filtro, aunque no los hayas cargado todos en pantalla. Ningún dato queda afuera.</li>
        </ol>
      ),
    },
    {
      icon: '🎓',
      title: 'Gestión de estudiantes',
      content: (
        <ol style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.8, fontSize: '0.83rem', color: '#cbd5e1' }}>
          <li>Ingresá a <strong>Alumnos</strong> desde el menú.</li>
          <li>Vas a ver el total de alumnos registrados, agrupados por año y división, cada grupo con su propio contador.</li>
          <li>Usá el buscador para encontrar a un alumno por nombre, apellido o email — filtra la lista en el momento.</li>
          <li>Para <strong>editar datos de un alumno</strong> (nombre, apellido, año, división): presioná el botón ✏️ en su fila. El historial de llegadas tarde de ese alumno se actualiza automáticamente con los datos nuevos.</li>
        </ol>
      ),
    },
    {
      icon: '🕓',
      title: 'Carga retroactiva',
      content: (
        <ol style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.8, fontSize: '0.83rem', color: '#cbd5e1' }}>
          <li>Ingresá a <strong>Carga retroactiva</strong> desde el menú.</li>
          <li>Usala si el sistema o la conexión a internet estuvieron caídos y tomaste las llegadas tarde en papel — para asentarlas después con la fecha real en que ocurrieron.</li>
          <li>Buscá al alumno, elegí la <strong>fecha</strong> (no puede ser futura) y el <strong>turno</strong> correspondiente, y confirmá.</li>
          <li>Estas cargas quedan identificadas como <strong>"Retroactivo"</strong> en Planillas y en las exportaciones, para diferenciarlas de un registro tomado en el momento con QR.</li>
          <li>Si el alumno ya tiene una llegada cargada ese día y turno, el sistema avisa y no permite duplicarla.</li>
        </ol>
      ),
    },
  ]

  if (!isPreceptor) {
    sections.push({
      icon: '👥',
      title: 'Gestión de usuarios',
      content: (
        <ol style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.8, fontSize: '0.83rem', color: '#cbd5e1' }}>
          <li>Ingresá a <strong>Usuarios</strong> desde el menú.</li>
          <li>Los usuarios aparecen ordenados por rol (de mayor a menor jerarquía) y alfabéticamente dentro de cada rol.</li>
          <li>Podés cambiar el rol de un usuario entre <strong>Estudiante, Preceptor o Admin</strong>.</li>
          <li>Para <strong>eliminar</strong> un usuario o alumno: usá el botón 🗑️. La cuenta se desconecta del sistema — si esa persona vuelve a loguearse, va a tener que cargar sus datos de nuevo (o se le puede asignar un rol). Su historial de llegadas tarde <strong>no se borra</strong>, queda intacto.</li>
        </ol>
      ),
    })
  }

  return sections
}

// ── Secciones para ESTUDIANTE ─────────────────────────────────────────
const studentSections: Section[] = [
  {
    icon: '📝',
    title: 'Ingreso de datos personales',
    content: (
      <>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.83rem', color: '#cbd5e1', lineHeight: 1.7 }}>
          Al iniciar sesión por primera vez, debés completar tu nombre, apellido, año y división.
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.8, fontSize: '0.83rem', color: '#cbd5e1' }}>
          <li>Ingresá tu <strong>nombre y apellido</strong> tal como figuran en el legajo escolar.</li>
          <li>Seleccioná el <strong>año</strong> que estás cursando (1ro, 2do, etc.).</li>
          <li>Seleccioná tu <strong>división</strong> (A, B, C, etc.).</li>
          <li>Revisá todo con cuidado y presioná <strong>"Guardar y generar QR"</strong>.</li>
          <li>Un modal de confirmación te mostrará los datos — leé bien antes de confirmar.</li>
        </ul>
        <div style={{ marginTop: '0.875rem', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: '0.5rem', padding: '0.75rem 0.875rem', fontSize: '0.8rem', color: '#fde047', lineHeight: 1.65 }}>
          ⚠️ <strong>Solo podés ingresar tus datos una sola vez.</strong> Una vez guardados, quedan bloqueados y no podrás modificarlos por tu cuenta.
        </div>
      </>
    ),
  },
  {
    icon: '🔄',
    title: 'Si cometiste un error en tus datos',
    content: (
      <>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.83rem', color: '#cbd5e1', lineHeight: 1.7 }}>
          Si te equivocaste en algún dato y ya confirmaste el guardado, <strong>no podés modificarlos vos mismo</strong>. Debés:
        </p>
        <ol style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.8, fontSize: '0.83rem', color: '#cbd5e1' }}>
          <li>Dirigirte a un <strong>preceptor</strong>.</li>
          <li>Pedile que corrija tus datos (nombre, apellido, año o división).</li>
        </ol>
      </>
    ),
  },
  {
    icon: '⬇️',
    title: 'Cómo descargar e imprimir tu carnet',
    content: (
      <ol style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.8, fontSize: '0.83rem', color: '#cbd5e1' }}>
        <li>Una vez cargados tus datos, tu carnet QR aparece en pantalla.</li>
        <li>Presioná el botón <strong>"Descargar Carnet (Alta Resolución)"</strong>.</li>
        <li>Se descarga un archivo <em>.png</em> con el carnet listo para imprimir.</li>
        <li>Imprimí la hoja en tamaño A4 o carta.</li>
        <li>Doblá la hoja por la línea de puntos (✂ Doblar aquí).</li>
        <li>Quedará un carnet doble faz: tus datos en el frente y el código QR en el dorso.</li>
        <li>Podés plastificarlo para mayor durabilidad.</li>
      </ol>
    ),
  },
  {
    icon: '📲',
    title: 'Cómo usar el carnet al llegar tarde',
    content: (
      <ol style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.8, fontSize: '0.83rem', color: '#cbd5e1' }}>
        <li>Al llegar tarde al colegio, mostrá el lado del <strong>código QR</strong> de tu carnet al preceptor.</li>
        <li>El preceptor escaneará el QR con el sistema.</li>
        <li>Confirmará tu llegada y quedará registrada automáticamente.</li>
      </ol>
    ),
  },
  {
    icon: '⚠️',
    title: 'Advertencia — Uso responsable',
    content: (
      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', padding: '0.875rem', fontSize: '0.83rem', color: '#fca5a5', lineHeight: 1.75 }}>
        <strong style={{ display: 'block', marginBottom: '0.4rem', color: '#f87171', fontSize: '0.85rem' }}>🚨 Aviso importante</strong>
        Cualquier intento de <strong>falsificar datos personales</strong>, <strong>prestar el carnet a otro alumno</strong>, <strong>alterar registros de asistencia</strong> o cualquier otra forma de fraude será considerado una <strong>falta grave</strong> y será motivo de <strong>sanción disciplinaria</strong> conforme al reglamento del Instituto Don Orione.
      </div>
    ),
  },
]

// ── Componente principal ──────────────────────────────────────────────
export function HelpModal({ role, onClose }: HelpModalProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const isAdmin = role === 'admin' || role === 'superadmin' || role === 'preceptor'
  const sections = isAdmin ? buildStaffSections(role) : studentSections
  const title = isAdmin ? '📖 Manual de uso (Staff)' : '📖 Manual del Alumno'

  const pdfManual =
    role === 'admin' || role === 'superadmin'
      ? { href: '/Manual_Administrador_AsistApp.pdf', label: 'Descargar manual completo (PDF)' }
      : role === 'preceptor'
      ? { href: '/Manual_Preceptor_AsistApp.pdf', label: 'Descargar manual del preceptor (PDF)' }
      : null

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-card animate-fade-in"
        style={{ maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#f1f5f9' }}>{title}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>Instituto Don Orione — Victoria</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(148,163,184,0.1)', border: 'none', borderRadius: '0.5rem', width: 32, height: 32, cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >✕</button>
        </div>

        {/* Content — scrollable */}
        <div style={{ overflowY: 'auto', padding: '1rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {pdfManual && (
            <a
              href={pdfManual.href}
              download
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderRadius: '0.75rem', background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(45,212,191,0.3)', textDecoration: 'none', marginBottom: '0.25rem' }}
            >
              <span style={{ fontSize: '1.3rem' }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#5eead4' }}>{pdfManual.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>Guía detallada con capturas y diagramas, pensada para tu rol</div>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#5eead4', flexShrink: 0 }}>⬇️</span>
            </a>
          )}
          {sections.map((sec, idx) => (
            <div
              key={idx}
              style={{ border: `1px solid ${openIdx === idx ? 'rgba(45,212,191,0.35)' : 'rgba(148,163,184,0.08)'}`, borderRadius: '0.75rem', overflow: 'hidden', transition: 'border-color 0.2s' }}
            >
              {/* Accordion header */}
              <button
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: openIdx === idx ? 'rgba(13,148,136,0.1)' : 'rgba(15,23,42,0.6)', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span style={{ fontSize: '1rem' }}>{sec.icon}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: openIdx === idx ? '#5eead4' : '#f1f5f9' }}>{sec.title}</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', transform: openIdx === idx ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
              </button>

              {/* Accordion body */}
              {openIdx === idx && (
                <div style={{ padding: '0.875rem 1rem 1rem', background: 'rgba(15,23,42,0.3)', borderTop: '1px solid rgba(148,163,184,0.07)' }}>
                  {sec.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
