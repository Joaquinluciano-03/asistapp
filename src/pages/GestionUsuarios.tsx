import { useState, useEffect, useCallback, useMemo } from 'react'
import { Navbar } from '../components/Navbar'
import { supabase } from '../lib/supabaseClient'
import type { Profile, UserRole } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const ROLE_LABEL: Record<UserRole, string> = {
  estudiante: 'Estudiante',
  admin: 'Admin',
  superadmin: 'Superadmin',
}

const ROLE_BADGE: Record<UserRole, string> = {
  estudiante: 'badge-primary',
  admin: 'badge-warning',
  superadmin: 'badge-purple',
}

interface ConfirmModal {
  type: 'delete_user' | 'delete_all_students'
  target?: Profile
}

export function GestionUsuarios() {
  const { profile: myProfile } = useAuth()
  const { toastSuccess, toastError } = useToast()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<ConfirmModal | null>(null)

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { toastError('Error al cargar usuarios') }
    else { setProfiles((data ?? []) as Profile[]) }
    setLoading(false)
  }, [toastError])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) => p.email.toLowerCase().includes(q))
  }, [profiles, search])

  const studentCount = useMemo(() => profiles.filter((p) => p.role === 'estudiante').length, [profiles])

  // ── Permisos ──────────────────────────────────────────────────────
  const canModify = (target: Profile): boolean => {
    if (!myProfile) return false
    if (target.id === myProfile.id) return false
    if (target.role === 'superadmin') return false
    return true
  }

  const allowedRoles = (target: Profile): UserRole[] => {
    if (!myProfile) return []
    if (target.role === 'superadmin') return ['superadmin']
    if (myProfile.role === 'superadmin') return ['estudiante', 'admin', 'superadmin']
    if (myProfile.role === 'admin') return ['estudiante', 'admin']
    return []
  }

  // ── Cambiar rol ───────────────────────────────────────────────────
  const handleRoleChange = async (target: Profile, newRole: UserRole) => {
    if (!canModify(target)) { toastError('Sin permisos.'); return }
    if (myProfile?.role === 'admin' && newRole === 'superadmin') { toastError('No podés asignar superadmin.'); return }
    setSaving(target.id)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', target.id)
    if (error) { toastError(`Error al actualizar: ${error.message}`) }
    else {
      setProfiles((prev) => prev.map((p) => p.id === target.id ? { ...p, role: newRole } : p))
      toastSuccess(`Rol de ${target.email} → "${ROLE_LABEL[newRole]}"`)
    }
    setSaving(null)
  }

  // ── Eliminar un usuario ───────────────────────────────────────────
  const handleDeleteUser = async (target: Profile) => {
    setConfirm(null)
    setDeleting(target.id)
    // Eliminar el perfil (cascade borrará datos relacionados)
    const { error } = await supabase.from('profiles').delete().eq('id', target.id)
    if (error) { toastError(`Error al eliminar: ${error.message}`) }
    else {
      setProfiles((prev) => prev.filter((p) => p.id !== target.id))
      toastSuccess(`Usuario ${target.email} eliminado`)
    }
    setDeleting(null)
  }

  // ── Eliminar todos los estudiantes ────────────────────────────────
  const handleDeleteAllStudents = async () => {
    setConfirm(null)
    setDeletingAll(true)
    const { error } = await supabase.from('profiles').delete().eq('role', 'estudiante')
    if (error) { toastError(`Error al eliminar estudiantes: ${error.message}`) }
    else {
      const removed = profiles.filter((p) => p.role === 'estudiante').length
      setProfiles((prev) => prev.filter((p) => p.role !== 'estudiante'))
      toastSuccess(`${removed} estudiante${removed !== 1 ? 's' : ''} eliminado${removed !== 1 ? 's' : ''}`)
    }
    setDeletingAll(false)
  }

  return (
    <>
      <Navbar />
      <div className="page-container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <h1 className="page-title">👥 Gestión de Usuarios</h1>
            <p className="page-subtitle">
              {profiles.length} usuario{profiles.length !== 1 ? 's' : ''} registrado{profiles.length !== 1 ? 's' : ''} — {studentCount} estudiante{studentCount !== 1 ? 's' : ''}
            </p>
          </div>
          {studentCount > 0 && (
            <button
              id="btn-eliminar-todos-estudiantes"
              onClick={() => setConfirm({ type: 'delete_all_students' })}
              disabled={deletingAll || loading}
              className="btn btn-danger btn-sm"
              style={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}
            >
              {deletingAll ? <><div className="spinner" /> Eliminando...</> : `🗑️ Eliminar todos los estudiantes (${studentCount})`}
            </button>
          )}
        </div>

        {/* Buscador */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              id="buscar-usuario"
              type="text"
              className="input-base"
              placeholder="🔍 Buscar por email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>
          {search && (
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.5rem' }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{search}"
            </p>
          )}
        </div>

        {/* Tabla */}
        <div className="glass-card" style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              {search ? `No se encontraron usuarios con "${search}".` : 'No hay usuarios registrados.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Registrado</th>
                    <th>Cambiar rol</th>
                    <th style={{ textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isMe = p.id === myProfile?.id
                    const options = allowedRoles(p)
                    const isSaving = saving === p.id
                    const isDeleting = deleting === p.id
                    const modifiable = canModify(p)

                    return (
                      <tr key={p.id} style={{ opacity: isDeleting ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                        <td style={{ fontWeight: 500, color: '#f1f5f9', maxWidth: 240 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.email}
                          </span>
                          {isMe && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>(vos)</span>}
                        </td>
                        <td>
                          <span className={`badge ${ROLE_BADGE[p.role]}`}>{ROLE_LABEL[p.role]}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(p.created_at).toLocaleDateString('es-AR')}
                        </td>
                        <td>
                          {!modifiable ? (
                            <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                              {isMe ? 'Tu cuenta' : '—'}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <select
                                id={`role-select-${p.id}`}
                                className="input-base"
                                style={{ width: 'auto', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                                value={p.role}
                                disabled={isSaving || isDeleting}
                                onChange={(e) => handleRoleChange(p, e.target.value as UserRole)}
                              >
                                {options.map((r) => (
                                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                                ))}
                              </select>
                              {isSaving && <div className="spinner" />}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {modifiable ? (
                            <button
                              id={`btn-eliminar-${p.id}`}
                              onClick={() => setConfirm({ type: 'delete_user', target: p })}
                              disabled={isDeleting || isSaving}
                              className="btn btn-danger btn-sm"
                              title={`Eliminar ${p.email}`}
                            >
                              {isDeleting ? <div className="spinner" style={{ width: 14, height: 14 }} /> : '🗑️'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#334155' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Referencia de roles
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
            <div><span className="badge badge-primary" style={{ marginRight: '0.5rem' }}>Estudiante</span>Puede completar sus datos y generar su QR personal.</div>
            <div><span className="badge badge-warning" style={{ marginRight: '0.5rem' }}>Admin</span>Escanea QR, ve planillas, exporta Excel y administra roles.</div>
            <div><span className="badge badge-purple" style={{ marginRight: '0.5rem' }}>Superadmin</span>Control total. No puede ser degradado por un admin.</div>
          </div>
        </div>
      </div>

      {/* ── Modal de confirmación ─────────────────────────────────── */}
      {confirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirm(null) }}
        >
          <div
            className="glass-card animate-fade-in"
            style={{ maxWidth: 420, width: '100%', padding: '2rem', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '1rem' }}>
              {confirm.type === 'delete_all_students' ? '⚠️' : '🗑️'}
            </div>

            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', textAlign: 'center', marginBottom: '0.75rem' }}>
              {confirm.type === 'delete_all_students'
                ? `Eliminar ${studentCount} estudiante${studentCount !== 1 ? 's' : ''}`
                : 'Eliminar usuario'}
            </h2>

            <p style={{ fontSize: '0.875rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              {confirm.type === 'delete_all_students'
                ? <>Esto eliminará <strong style={{ color: '#f87171' }}>permanentemente</strong> a todos los usuarios con rol <strong>Estudiante</strong> y todos sus datos (QR, llegadas). Esta acción <strong>no se puede deshacer</strong>.</>
                : <>Se eliminará permanentemente a <strong style={{ color: '#f1f5f9' }}>{confirm.target?.email}</strong> y todos sus datos. Esta acción <strong>no se puede deshacer</strong>.</>
              }
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                id="btn-confirmar-eliminacion"
                onClick={() => {
                  if (confirm.type === 'delete_all_students') handleDeleteAllStudents()
                  else if (confirm.target) handleDeleteUser(confirm.target)
                }}
                className="btn btn-danger"
                style={{ flex: 1, fontWeight: 700 }}
              >
                Sí, eliminar
              </button>
              <button
                id="btn-cancelar-eliminacion"
                onClick={() => setConfirm(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
