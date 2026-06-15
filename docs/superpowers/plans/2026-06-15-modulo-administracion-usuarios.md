# Módulo de administración de usuarios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un módulo en `/dashboard/usuarios` (solo agentes) para crear psicólogos/agentes con su login por invitación email, editar sus datos (incl. `calendar_id`), reenviar contraseña y desactivar, ejecutando siempre los 3 pasos (Auth + tabla + `perfiles`) de forma atómica.

**Architecture:** Página cliente Next.js que llama a Route Handlers de servidor. Toda operación con privilegios usa la `service_role` key vía `lib/supabase-admin.ts`, que nunca se importa en el cliente. El acceso se valida dos veces: `middleware.ts` (sesión) + comprobación de rol en cada handler.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, `@supabase/ssr`, `@supabase/supabase-js` (admin). Sin framework de tests instalado → verificación con `npm run build`, `curl` contra la API en `npm run dev`, y consultas a Supabase con `curl`.

**Nota de contexto:** Spec en `docs/superpowers/specs/2026-06-15-modulo-administracion-usuarios-design.md`. Decisiones: psicólogo=registro+calendario+login juntos; un rol por persona; acceso para todos los agentes; contraseña por invitación email (SMTP ya configurado); baja=desactivar (solo quita de selectores, no bloquea login); el email de login no se edita aquí.

**Convención de "id" en la API:** `[id]` = id del registro (`psicologos.id` o `agentes.id`), y el cuerpo lleva `tipo: 'psicologo' | 'agente'`. El enlace con Auth se resuelve en el servidor (psicólogo → `perfiles.psicologo_id`; agente → `agentes.auth_user_id`).

---

## Task 1: Cliente admin con service_role (solo servidor)

**Files:**
- Create: `somos-app/lib/supabase-admin.ts`

- [ ] **Step 1: Crear el cliente admin**

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// SOLO SERVIDOR. Usa la service_role key (bypassa RLS y permite operaciones
// de Auth admin). NUNCA importar este módulo desde un componente cliente.
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd somos-app && npx tsc --noEmit`
Expected: sin errores nuevos relacionados con `lib/supabase-admin.ts`.

- [ ] **Step 3: Commit**

```bash
git add somos-app/lib/supabase-admin.ts
git commit -m "feat(usuarios): cliente Supabase admin (service_role, solo servidor)"
```

---

## Task 2: Guard de autorización por rol (servidor)

**Files:**
- Create: `somos-app/lib/require-agente.ts`

- [ ] **Step 1: Crear el guard**

```ts
import { createSupabaseServerClient } from '@/lib/supabase-server'

export type GuardResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }

/**
 * Permite la operación solo si hay sesión y el perfil es 'agente'. Si no hay
 * fila en `perfiles` se trata como agente (coherente con SidebarNav/RoleGate,
 * mantiene logins heredados). Un psicólogo o call_center recibe 403.
 */
export async function requireAgente(): Promise<GuardResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'No autenticado' }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle()

  if (perfil && perfil.rol !== 'agente') {
    return { ok: false, status: 403, error: 'Solo agentes pueden gestionar usuarios' }
  }
  return { ok: true, userId: user.id }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd somos-app && npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add somos-app/lib/require-agente.ts
git commit -m "feat(usuarios): guard requireAgente para los handlers"
```

---

## Task 3: GET listar + POST crear (`/api/usuarios`)

**Files:**
- Create: `somos-app/app/api/usuarios/route.ts`

- [ ] **Step 1: Escribir el handler GET (listar) y POST (crear)**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAgente } from '@/lib/require-agente'

export async function GET() {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createSupabaseAdmin()
  const [psies, ags] = await Promise.all([
    admin.from('psicologos').select('id, nombre, email, telefono, centro_id, calendar_id, activo').order('nombre'),
    admin.from('agentes').select('id, nombre, email, telefono, centro_id, activo, auth_user_id').order('nombre'),
  ])
  if (psies.error) return NextResponse.json({ error: psies.error.message }, { status: 500 })
  if (ags.error) return NextResponse.json({ error: ags.error.message }, { status: 500 })

  return NextResponse.json({ psicologos: psies.data ?? [], agentes: ags.data ?? [] })
}

type CrearBody = {
  tipo: 'psicologo' | 'agente'
  nombre: string
  email: string
  telefono?: string | null
  centro_id?: string | null
  calendar_id?: string | null
}

export async function POST(req: NextRequest) {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = (await req.json()) as CrearBody
  const nombre = body.nombre?.trim()
  const email = body.email?.trim().toLowerCase()

  // Validación de servidor
  if (body.tipo !== 'psicologo' && body.tipo !== 'agente')
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  if (body.tipo === 'psicologo' && !body.calendar_id?.trim())
    return NextResponse.json({ error: 'El calendar_id es obligatorio para un psicólogo' }, { status: 400 })

  const admin = createSupabaseAdmin()

  // Paso 1: invitar (crea cuenta auth + envía email para fijar contraseña)
  const invite = await admin.auth.admin.inviteUserByEmail(email)
  if (invite.error || !invite.data?.user) {
    const msg = /already|registered|exists/i.test(invite.error?.message ?? '')
      ? 'Ya hay un usuario con ese email'
      : invite.error?.message ?? 'No se pudo crear la cuenta'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const userId = invite.data.user.id

  if (body.tipo === 'psicologo') {
    // Paso 2: registro en psicologos
    const psi = await admin
      .from('psicologos')
      .insert({
        nombre,
        email,
        telefono: body.telefono ?? null,
        centro_id: body.centro_id ?? null,
        calendar_id: body.calendar_id!.trim(),
        activo: true,
      })
      .select('id')
      .single()
    if (psi.error || !psi.data) {
      await admin.auth.admin.deleteUser(userId) // limpieza
      return NextResponse.json({ error: psi.error?.message ?? 'Error creando psicólogo' }, { status: 500 })
    }
    // Paso 3: perfil
    const perfil = await admin.from('perfiles').insert({
      id: userId,
      nombre,
      rol: 'psicologo',
      psicologo_id: psi.data.id,
      centro_id: body.centro_id ?? null,
    })
    if (perfil.error) {
      await admin.from('psicologos').delete().eq('id', psi.data.id) // limpieza
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: perfil.error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: psi.data.id }, { status: 201 })
  }

  // tipo === 'agente'
  const ag = await admin
    .from('agentes')
    .insert({
      nombre,
      email,
      telefono: body.telefono ?? null,
      centro_id: body.centro_id ?? null,
      activo: true,
      auth_user_id: userId,
    })
    .select('id')
    .single()
  if (ag.error || !ag.data) {
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: ag.error?.message ?? 'Error creando agente' }, { status: 500 })
  }
  const perfil = await admin.from('perfiles').insert({
    id: userId,
    nombre,
    rol: 'agente',
    psicologo_id: null,
    centro_id: body.centro_id ?? null,
  })
  if (perfil.error) {
    await admin.from('agentes').delete().eq('id', ag.data.id)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: perfil.error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: ag.data.id }, { status: 201 })
}
```

> Nota: `agentes.email` y `agentes.auth_user_id` existen en la tabla (vistos en datos reales) aunque el tipo `Agente` en `types/database.ts` no los liste todos. Ver Task 4 para alinear los tipos.

- [ ] **Step 2: Verificar que compila**

Run: `cd somos-app && npx tsc --noEmit`
Expected: puede fallar por `auth_user_id`/`email` ausentes en el tipo `Agente`/`Insert`. Si ocurre, completar Task 4 primero y reintentar. Objetivo final: sin errores.

- [ ] **Step 3: Commit**

```bash
git add somos-app/app/api/usuarios/route.ts
git commit -m "feat(usuarios): API GET listar + POST crear con limpieza atómica"
```

---

## Task 4: Alinear tipos de `agentes` (email + auth_user_id)

**Files:**
- Modify: `somos-app/types/database.ts:46-53`

- [ ] **Step 1: Añadir los campos al tipo `Agente`**

Reemplazar el bloque `export type Agente = {...}` por:

```ts
export type Agente = {
  id: string
  nombre: string
  telefono: string | null
  activo: boolean
  centro_id: string | null
  creado_en: string
  email: string | null
  auth_user_id: string | null
}
```

- [ ] **Step 2: Verificar que compila (incluye Task 3)**

Run: `cd somos-app && npx tsc --noEmit`
Expected: sin errores. El `insert` en `agentes` de Task 3 ya tipa `email`/`auth_user_id`.

- [ ] **Step 3: Commit**

```bash
git add somos-app/types/database.ts
git commit -m "feat(usuarios): tipar agentes.email y agentes.auth_user_id"
```

---

## Task 5: PATCH editar/desactivar + POST reset (`/api/usuarios/[id]`)

**Files:**
- Create: `somos-app/app/api/usuarios/[id]/route.ts`

- [ ] **Step 1: Escribir PATCH (editar/desactivar) y POST (reset password)**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAgente } from '@/lib/require-agente'

type EditarBody = {
  tipo: 'psicologo' | 'agente'
  nombre?: string
  telefono?: string | null
  email?: string | null     // email de contacto del registro, NO el de login
  centro_id?: string | null
  calendar_id?: string | null
  activo?: boolean
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await ctx.params
  const body = (await req.json()) as EditarBody
  const admin = createSupabaseAdmin()

  if (body.tipo === 'psicologo') {
    const campos: Record<string, unknown> = {}
    if (body.nombre !== undefined) campos.nombre = body.nombre.trim()
    if (body.telefono !== undefined) campos.telefono = body.telefono
    if (body.email !== undefined) campos.email = body.email
    if (body.centro_id !== undefined) campos.centro_id = body.centro_id
    if (body.calendar_id !== undefined) campos.calendar_id = body.calendar_id
    if (body.activo !== undefined) campos.activo = body.activo

    const upd = await admin.from('psicologos').update(campos).eq('id', id)
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })

    // Sincronizar nombre en perfiles (atribución coherente)
    if (body.nombre !== undefined) {
      await admin.from('perfiles').update({ nombre: body.nombre.trim() }).eq('psicologo_id', id)
    }
    return NextResponse.json({ ok: true })
  }

  if (body.tipo === 'agente') {
    const campos: Record<string, unknown> = {}
    if (body.nombre !== undefined) campos.nombre = body.nombre.trim()
    if (body.telefono !== undefined) campos.telefono = body.telefono
    if (body.centro_id !== undefined) campos.centro_id = body.centro_id
    if (body.activo !== undefined) campos.activo = body.activo

    const ag = await admin.from('agentes').update(campos).eq('id', id).select('auth_user_id').maybeSingle()
    if (ag.error) return NextResponse.json({ error: ag.error.message }, { status: 500 })

    if (body.nombre !== undefined && ag.data?.auth_user_id) {
      await admin.from('perfiles').update({ nombre: body.nombre.trim() }).eq('id', ag.data.auth_user_id)
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
}

// Reenviar acceso: envía email de recuperación de contraseña.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAgente()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await ctx.params
  const body = (await req.json()) as { tipo: 'psicologo' | 'agente' }
  const admin = createSupabaseAdmin()

  // Resolver el email de login del registro
  let email: string | null = null
  if (body.tipo === 'psicologo') {
    const perfil = await admin.from('perfiles').select('id').eq('psicologo_id', id).maybeSingle()
    if (perfil.data?.id) {
      const u = await admin.auth.admin.getUserById(perfil.data.id)
      email = u.data?.user?.email ?? null
    }
  } else {
    const ag = await admin.from('agentes').select('auth_user_id').eq('id', id).maybeSingle()
    if (ag.data?.auth_user_id) {
      const u = await admin.auth.admin.getUserById(ag.data.auth_user_id)
      email = u.data?.user?.email ?? null
    }
  }
  if (!email) return NextResponse.json({ error: 'No se encontró la cuenta de acceso' }, { status: 404 })

  const reset = await admin.auth.resetPasswordForEmail(email)
  if (reset.error) return NextResponse.json({ error: reset.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd somos-app && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add somos-app/app/api/usuarios/\[id\]/route.ts
git commit -m "feat(usuarios): API editar/desactivar y reenviar contraseña"
```

---

## Task 6: Verificación de la API en runtime (manual)

**Files:** ninguno (verificación).

- [ ] **Step 1: Arrancar el dev server**

Run: `cd somos-app && npm run dev`
Expected: servidor en `http://localhost:3000`.

- [ ] **Step 2: Probar 403 sin sesión de agente**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/usuarios`
Expected: `401` (sin cookies de sesión). Confirma que el guard bloquea accesos no autenticados.

- [ ] **Step 3: Probar el alta desde la UI (Task 8) y verificar las 3 filas**

Tras crear un psicólogo de prueba desde `/dashboard/usuarios`, comprobar en Supabase:

```bash
cd somos-app && URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '\r"') && KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | tr -d '\r"')
curl -s "$URL/rest/v1/perfiles?select=nombre,rol,psicologo_id&order=creado_en.desc&limit=3" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Expected: aparece el nuevo psicólogo con `rol=psicologo` y su `psicologo_id`, y existe la fila en `psicologos`. Verificar también que llega el email de invitación.

- [ ] **Step 4: Probar limpieza ante fallo del paso 3**

Forzar temporalmente un error en el `insert` de `perfiles` (p. ej. pasar un `centro_id` inexistente que viole la FK) y comprobar que NO queda cuenta auth huérfana:

```bash
curl -s "$URL/auth/v1/admin/users" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Expected: el email de prueba no aparece en `auth.users` tras el fallo (la limpieza lo borró). Revertir el cambio temporal después.

---

## Task 7: Página de administración `/dashboard/usuarios`

**Files:**
- Create: `somos-app/app/dashboard/usuarios/page.tsx`

- [ ] **Step 1: Crear la página (lista + alta + edición + acciones)**

```tsx
'use client'

import { useEffect, useState } from 'react'

type Psicologo = {
  id: string; nombre: string; email: string | null; telefono: string | null
  centro_id: string | null; calendar_id: string | null; activo: boolean
}
type Agente = {
  id: string; nombre: string; email: string | null; telefono: string | null
  centro_id: string | null; activo: boolean; auth_user_id: string | null
}
type Tipo = 'psicologo' | 'agente'

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid rgba(47,90,174,0.13)',
  boxShadow: '0 2px 8px rgba(47,90,174,0.06)', overflow: 'hidden', marginBottom: 28,
}
const th: React.CSSProperties = {
  padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#667799', textTransform: 'uppercase', letterSpacing: '0.07em',
}
const td: React.CSSProperties = { padding: '14px 20px', fontSize: 13, color: '#4a5870' }
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13,
  border: '1px solid rgba(47,90,174,0.25)', fontFamily: 'inherit',
}

export default function UsuariosPage() {
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Formulario de alta
  const [tipo, setTipo] = useState<Tipo>('psicologo')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [calendarId, setCalendarId] = useState('')

  async function cargar() {
    setLoading(true)
    const res = await fetch('/api/usuarios')
    if (!res.ok) { setError((await res.json()).error ?? 'Error cargando'); setLoading(false); return }
    const data = await res.json()
    setPsicologos(data.psicologos)
    setAgentes(data.agentes)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo, nombre, email,
        telefono: telefono || null,
        calendar_id: tipo === 'psicologo' ? calendarId : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error'); setBusy(false); return }
    setNombre(''); setEmail(''); setTelefono(''); setCalendarId('')
    setBusy(false)
    await cargar()
  }

  async function toggleActivo(t: Tipo, id: string, activo: boolean) {
    setBusy(true)
    await fetch(`/api/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: t, activo: !activo }),
    })
    setBusy(false)
    await cargar()
  }

  async function editarCalendario(id: string, actual: string | null) {
    const nuevo = window.prompt('Nuevo calendar_id:', actual ?? '')
    if (nuevo === null) return
    setBusy(true)
    await fetch(`/api/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'psicologo', calendar_id: nuevo }),
    })
    setBusy(false)
    await cargar()
  }

  async function reenviar(t: Tipo, id: string) {
    setBusy(true)
    const res = await fetch(`/api/usuarios/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: t }),
    })
    setBusy(false)
    alert(res.ok ? 'Email de acceso enviado' : 'No se pudo enviar el email')
  }

  return (
    <div style={{ padding: '36px 40px', maxWidth: 960 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 26, fontWeight: 600, color: '#272626', margin: 0, marginBottom: 6 }}>
          Usuarios
        </h1>
        <p style={{ fontSize: 13.5, color: '#667799', margin: 0 }}>
          Crea accesos, gestiona calendarios y reenvía contraseñas
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Alta */}
      <form onSubmit={crear} style={{ ...card, padding: 20, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5870' }}>
            <input type="radio" checked={tipo === 'psicologo'} onChange={() => setTipo('psicologo')} /> Psicólogo
          </label>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5870' }}>
            <input type="radio" checked={tipo === 'agente'} onChange={() => setTipo('agente')} /> Agente
          </label>
        </div>
        <input style={input} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <input style={input} placeholder="Email de acceso" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input style={input} placeholder="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        {tipo === 'psicologo' && (
          <input style={input} placeholder="calendar_id (Google Calendar)" value={calendarId} onChange={(e) => setCalendarId(e.target.value)} required />
        )}
        <button type="submit" disabled={busy} style={{ justifySelf: 'start', padding: '9px 20px', borderRadius: 8, border: 'none', background: '#2f5aae', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Creando...' : 'Crear y enviar invitación'}
        </button>
      </form>

      {/* Listas */}
      {loading ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#8899bb', fontSize: 14 }}>Cargando...</div>
      ) : (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#272626', margin: '0 0 12px' }}>Psicólogos</h2>
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(47,90,174,0.1)' }}>
                {['Nombre', 'Email', 'Calendario', 'Estado', 'Acciones'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {psicologos.map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid rgba(47,90,174,0.07)' }}>
                    <td style={{ ...td, fontWeight: 500, color: '#272626' }}>{p.nombre}</td>
                    <td style={td}>{p.email ?? '—'}</td>
                    <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.calendar_id ?? '—'}</td>
                    <td style={td}>{p.activo ? 'Activo' : 'Inactivo'}</td>
                    <td style={td}>
                      <button onClick={() => editarCalendario(p.id, p.calendar_id)} disabled={busy} style={{ marginRight: 8, cursor: 'pointer' }}>Calendario</button>
                      <button onClick={() => reenviar('psicologo', p.id)} disabled={busy} style={{ marginRight: 8, cursor: 'pointer' }}>Reenviar</button>
                      <button onClick={() => toggleActivo('psicologo', p.id, p.activo)} disabled={busy} style={{ cursor: 'pointer' }}>{p.activo ? 'Desactivar' : 'Activar'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#272626', margin: '0 0 12px' }}>Agentes</h2>
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(47,90,174,0.1)' }}>
                {['Nombre', 'Email', 'Teléfono', 'Estado', 'Acciones'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {agentes.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid rgba(47,90,174,0.07)' }}>
                    <td style={{ ...td, fontWeight: 500, color: '#272626' }}>{a.nombre}</td>
                    <td style={td}>{a.email ?? '—'}</td>
                    <td style={td}>{a.telefono ?? '—'}</td>
                    <td style={td}>{a.activo ? 'Activo' : 'Inactivo'}</td>
                    <td style={td}>
                      <button onClick={() => reenviar('agente', a.id)} disabled={busy} style={{ marginRight: 8, cursor: 'pointer' }}>Reenviar</button>
                      <button onClick={() => toggleActivo('agente', a.id, a.activo)} disabled={busy} style={{ cursor: 'pointer' }}>{a.activo ? 'Desactivar' : 'Activar'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd somos-app && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add somos-app/app/dashboard/usuarios/page.tsx
git commit -m "feat(usuarios): página de administración (lista, alta, edición, acciones)"
```

---

## Task 8: Enlace en el menú lateral (solo agentes)

**Files:**
- Modify: `somos-app/app/dashboard/_components/SidebarNav.tsx:61-70`

- [ ] **Step 1: Añadir el item de navegación**

Dentro del array `navItems`, añadir tras la línea de `'/dashboard/agentes'`:

```ts
  { href: '/dashboard/usuarios', label: 'Usuarios', Icon: PeopleIcon, roles: ['agente'] },
```

(El filtro `visibleItems` ya oculta el enlace a quien no sea agente; `RoleGate` ya redirige a un psicólogo que intente entrar por URL, porque `isAllowed('psicologo', ...)` solo permite `/dashboard/psicologos`.)

- [ ] **Step 2: Verificar que compila y arranca**

Run: `cd somos-app && npm run build`
Expected: build sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add somos-app/app/dashboard/_components/SidebarNav.tsx
git commit -m "feat(usuarios): enlace 'Usuarios' en el menú (solo agentes)"
```

---

## Task 9: Verificación funcional completa (manual)

**Files:** ninguno.

- [ ] **Step 1:** Entrar como agente (`lacarramolina@gmail.com`) → ver "Usuarios" en el menú.
- [ ] **Step 2:** Entrar como psicólogo (`jaimervr@gmail.com`) → NO ver "Usuarios"; al teclear `/dashboard/usuarios` ser redirigido a `/dashboard/psicologos`.
- [ ] **Step 3:** Crear un psicólogo de prueba → confirmar las 3 filas (auth, `psicologos`, `perfiles`) y la llegada del email (Task 6, Step 3).
- [ ] **Step 4:** Editar su `calendar_id` y su nombre → confirmar que el nombre cambia también en `perfiles` (consulta a `perfiles`).
- [ ] **Step 5:** Desactivar el psicólogo de prueba → confirmar `activo=false` y que desaparece de los selectores en `/dashboard/psicologos`.
- [ ] **Step 6:** "Reenviar" acceso → confirmar email de recuperación.
- [ ] **Step 7:** Crear un agente de prueba como Sonia, cerrar sesión, fijar contraseña vía email, entrar como ese agente y crear una cita → confirmar en el webhook de Make que `created_by` es el nombre del nuevo agente (cierra el círculo del bug original).

---

## Self-review (cobertura del spec)

- Arquitectura (página cliente + handlers servidor + `supabase-admin` + doble guard) → Tasks 1, 2, 3, 5, 7, 8. ✔
- Alta psicólogo con `calendar_id` + login (3 pasos atómicos) → Task 3. ✔
- Alta agente → Task 3. ✔
- Edición (incl. sync de `nombre` en `perfiles`; email de login no editable) → Task 5. ✔
- Reenviar contraseña (email recuperación) → Task 5. ✔
- Desactivar (solo `activo=false`, sin bloquear login) → Task 5 (PATCH activo) + Task 7. ✔
- Acceso solo agentes (servidor 403 + menú + RoleGate) → Tasks 2, 8. ✔
- Limpieza ante fallo parcial → Task 3 + verificación Task 6. ✔
- Email ya existe / validaciones → Task 3. ✔
- Pruebas → Tasks 6 y 9. ✔
- Fuera de alcance (multi-rol, borrado físico, bloqueo de login, editar email de login) → no implementado, correcto.
