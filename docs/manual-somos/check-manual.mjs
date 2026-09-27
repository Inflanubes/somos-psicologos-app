// Comprueba el manual: node docs/manual-somos/check-manual.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = join(aqui, '..', '..') // somos-app
const html = readFileSync(join(aqui, 'index.html'), 'utf8')
const fallos = []

// 1. Secciones obligatorias
const SECCIONES = ['portada', 'novedades', 'montado', 'roles', 'pantallas',
  'cita', 'disponibilidad', 'dante', 'pendientes', 'glosario']
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))
for (const s of SECCIONES) if (!ids.has(s)) fallos.push(`Falta la sección id="${s}"`)

// 2. Anclas internas (href="#x" y <option value="#x">)
const destinos = [...html.matchAll(/(?:href|value)="#([^"]+)"/g)].map(m => m[1])
for (const d of new Set(destinos)) if (!ids.has(d)) fallos.push(`Ancla rota: #${d}`)

// 3. Secretos
const SECRETOS = [/hook\.eu\d?\.make\.com/i, /eltodi/i, /supabase\.co/i, /eyJ[A-Za-z0-9_-]{10,}/,
  /\bbot\d{6,}:/i, /service_role/i, /sk-[A-Za-z0-9]{10,}/, /sb_(publishable|secret)_/i,
  /api\.telegram\.org/i, /\b\d{9,10}\b/]
for (const re of SECRETOS) if (re.test(html)) fallos.push(`Posible secreto: ${re}`)

// 4. Toda tabla dentro de .tabla
const tablas = (html.match(/<table/g) || []).length
const envueltas = (html.match(/<div class="tabla">\s*<table/g) || []).length
if (tablas !== envueltas) fallos.push(`${tablas - envueltas} tabla(s) fuera de <div class="tabla">`)

// 5. Literales de la app: cada <code class="ui"> debe existir en el código
function archivos(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) archivos(p, out)
    else if (/\.(tsx?|jsx?)$/.test(n)) out.push(p)
  }
  return out
}
const normaliza = s => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const codigo = ['app', 'lib', 'components'].flatMap(d => {
  try { return archivos(join(raiz, d)) } catch { return [] }
}).map(f => readFileSync(f, 'utf8')).join('\n').replace(/\s+/g, ' ')

// Un literal puede tener partes variables marcadas con <var>…</var>; se comprueba cada trozo fijo.
const literales = [...html.matchAll(/<code class="ui"([^>]*)>([\s\S]*?)<\/code>/g)]
for (const [, attrs, lit] of literales) {
  if (/data-nocheck/.test(attrs)) continue
  const trozos = lit.split(/<var>[\s\S]*?<\/var>/).map(normaliza).filter(t => t.length >= 3)
  for (const t of trozos) if (!codigo.includes(t)) fallos.push(`Literal no encontrado en el código: "${t}"`)
}

if (fallos.length) {
  console.error(`FALLOS (${fallos.length}):\n- ` + fallos.join('\n- '))
  process.exit(1)
}
console.log(`OK · ${ids.size} ids · ${literales.length} literales · ${tablas} tablas`)
