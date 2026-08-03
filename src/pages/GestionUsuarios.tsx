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

export function GestionUsuarios() {
  const { profile: myProfile } = useAuth()
  const { toastSuccess, toastError } = useToast()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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

  // Filtrado local por búsqueda
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) => p.email.toLowerCase().includes(q))
  }, [profiles, search])

  const canChangeRole = (target: Profile, newRole: UserRole): boolean => {
    if (!myProfile) return false
    if (target.id === myProfile.id) return false
    if (target.role === 'superadmin') return false
    if (myProfile.role === 'admin' && newRole === 'superadmin') return false
    return true
  }

  const handleRoleChange = async (target: Profile, newRole: UserRole) => {
    if (!canChangeRole(target, newRole)) {
      toastError('No tenés permisos para realizar este cambio de rol.')
      return
    }
    setSaving(target.id)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', target.id)
    if (error) {
      toastError(`Error al actualizar rol: ${error.message}`)
    } else {
      setProfiles((prev) => prev.map((p) => (p.id === target.id ? { ...p, role: newRole } : p)))
      toastSuccess(`Rol de ${target.email} actualizado a "${ROLE_LABEL[newRole]}"`)
    }
    setSaving(null)
  }

  const allowedOptions = (target: Profile): UserRole[] => {
    if (!myProfile) return []
    if (target.role === 'superadmin') return ['superadmin']
    if (myProfile.role === 'superadmin') return ['estudiante', 'admin', 'superadmin']
    if (myProfile.role === 'admin') return ['estudiante', 'admin']
    return []
  }

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">👥 Gestión de Usuarios</h1>
          <p className="page-subtitle">Administrá los roles de los usuarios registrados en el sistema.</p>
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

        <div className="glass-card" style={{ overflow: 'hidden' }}>
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
                    <th>Rol actual</th>
                    <th>Registrado</th>
                    <th>Cambiar rol</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isMe = p.id === myProfile?.id
                    const options = allowedOptions(p)
                    const isSaving = saving === p.id
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500, color: '#f1f5f9' }}>
                          {p.email}
                          {isMe && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#64748b' }}>(yo)</span>}
                        </td>
                        <td>
                          <span className={`badge ${ROLE_BADGE[p.role]}`}>{ROLE_LABEL[p.role]}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {new Date(p.created_at).toLocaleDateString('es-AR')}
                        </td>
                        <td>
                          {isMe || p.role === 'superadmin' || options.length <= 1 ? (
                            <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                              {isMe ? 'Tu cuenta' : 'Sin permisos'}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <select
                                id={`role-select-${p.id}`}
                                className="input-base"
                                style={{ width: 'auto', padding: '0.375rem 0.625rem', fontSize: '0.8rem' }}
                                value={p.role}
                                disabled={isSaving}
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Leyenda de roles */}
        <div className="glass-card" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Referencia de roles
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
            <div><span className="badge badge-primary" style={{ marginRight: '0.5rem' }}>Estudiante</span>Puede completar sus datos y generar su QR personal.</div>
            <div><span className="badge badge-warning" style={{ marginRight: '0.5rem' }}>Admin</span>Escanea QR, ve planillas, exporta Excel y administra roles.</div>
            <div><span className="badge badge-purple" style={{ marginRight: '0.5rem' }}>Superadmin</span>Todo lo anterior más gestión total de roles.</div>
          </div>
        </div>
      </div>
    </>
  )
}
