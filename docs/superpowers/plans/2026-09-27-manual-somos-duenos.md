# Manual vivo para los dueños de Somos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir y publicar como artifact un manual de una sola página, en estética Be Banana híbrida, que explique todo el sistema Somos a los dueños y que se pueda ampliar y republicar al mismo enlace.

**Architecture:** Un único `docs/manual-somos/index.html` con CSS y JS inline, fuentes de Google Fonts y el icono de Be Banana como archivo de apoyo. Un script Node sin dependencias (`docs/manual-somos/check-manual.mjs`) hace de batería de tests: anclas, textos literales contra el código real, ausencia de secretos, estructura. Se construye sección a sección; cada tarea deja el script en verde.

**Tech Stack:** HTML + CSS + JS vanilla, Node 22 (solo para el script de comprobación), herramienta Artifact para publicar.

**Spec:** `docs/superpowers/specs/2026-09-27-manual-somos-duenos-design.md`

## Global Constraints

- Solo español. Sin conmutador de idioma.
- Lector de negocio: sin nombres de tablas ni columnas, ni números de módulo de Make, ni ids de escenarios o workflows.
- Sin secretos: ninguna clave, token, URL de webhook ni de la API del proveedor externo. El proveedor se llama "proveedor externo de calendario".
- Textos que muestra la app: literales, dentro de `<code class="ui">…</code>`, y cada uno debe existir en el código de `somos-app` (lo comprueba el script).
- Híbrido fijo: secciones `.oscura` (portada, "Cómo está montado") y `.clara` (resto). El documento ignora `prefers-color-scheme`.
- Tipografías: Syne (titulares 700/800), DM Sans (texto 400/500/600), DM Mono (literales). Cuerpo 16px, interlineado 1.55, ancho máximo 1080px.
- Colores de rol fijos: agente `#f5c800`, psicólogo `#2dd4bf`, call center `#4a7dd4`, Dante `#8b6fd6`.
- El amarillo nunca se usa como color de texto sobre fondo claro; ahí se usa `#8a7000`.
- Móvil: gutter lateral 16px, sin scroll horizontal de página, controles de al menos 40px de alto.
- Impresión: todo en claro, plegables abiertos, sin navegación.
- Página estática: sin capacidades de runtime.

## Review Focus

1. **Texto literal que ya no existe en la app** (alguien cambia un mensaje en el código y el manual queda desfasado): el script debe fallar y decir qué literal no encuentra. Test en Task 1.
2. **Ancla rota** en el índice, la navegación móvil o Novedades: el script debe listar cada `href="#x"` sin `id="x"`. Test en Task 1.
3. **Tabla ancha en un móvil de 390px** (la tabla pantalla × rol, la de acciones): debe hacer scroll dentro de su contenedor y nunca desbordar la página. Cubierto por la regla "toda `<table>` va dentro de `.tabla`" que comprueba el script, Task 1.
4. **Imprimir a PDF** desde el móvil o el ordenador: las secciones oscuras deben salir claras y los `<details>` abiertos. Cubierto por el bloque `@media print` y el `beforeprint` de Task 1; comprobado a mano en Task 6.
5. **Secreto copiado por error** al traer un texto de un doc técnico: el script debe fallar ante `hook.eu`, `eltodi`, `supabase.co`, `eyJ` (JWT), `bot` seguido de dígitos y `:`. Test en Task 1.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `docs/manual-somos/index.html` | El manual completo. Fuente de lo que se publica. |
| `docs/manual-somos/bebanana-icon.png` | Icono de Be Banana, copiado de `../docs/branding-bebanana/BeBanana-Icon.png`. Se publica como archivo de apoyo. |
| `docs/manual-somos/check-manual.mjs` | Tests: anclas, literales, secretos, tablas envueltas, secciones presentes. |
| `docs/manual-somos/README.md` | Qué es, URL publicada, regla de actualización, cómo pasar el check y republicar. |

Fuentes de contenido que el implementador debe leer (solo lectura):
- `docs/roles-y-permisos.md` (roles, tabla de pantallas, restablecer contraseñas).
- `docs/superpowers/specs/2026-09-26-horarios-psicologos-y-calendario-design.md` (reglas de disponibilidad).
- `app/dashboard/**/page.tsx` y `app/dashboard/_components/*.tsx` (textos literales).
- `../docs/dante-revision-2026-09-25.md` §0-§2 y `../n8n/` (Dante, derivaciones; NO copiar tokens ni ids).
- `../docs/make-cambios-2026-09-25.md`, `../docs/make-cambios-dni-2026-09-26.md` (qué hace Make con cada acción, consentimiento).

---

### Task 1: Esqueleto, sistema visual y script de comprobación

**Files:**
- Create: `docs/manual-somos/check-manual.mjs`
- Create: `docs/manual-somos/index.html`
- Create: `docs/manual-somos/bebanana-icon.png` (copia)

**Interfaces:**
- Produces: clases CSS que usan todas las tareas siguientes: `.oscura`, `.clara`, `.wrap`, `.seccion`, `.ficha`, `.ficha-cab`, `.chip.r-agente|r-psicologo|r-callcenter|r-dante`, `.badge.b-prod|b-pend|b-decision|b-obsoleto`, `.tabla` (contenedor con scroll de toda `<table>`), `code.ui` (literal de la app), `.lista-msg` (lista de mensajes), `.mapa` y `.pieza` (sección 1), `.nota` (aviso en línea).
- Produces: ids de sección fijos: `portada`, `novedades`, `montado`, `roles`, `pantallas`, `cita`, `disponibilidad`, `dante`, `pendientes`, `glosario`.
- Produces: `node docs/manual-somos/check-manual.mjs` → sale con código 0 y "OK" o con código 1 y la lista de fallos.

- [ ] **Step 1: Escribir el script de comprobación**

```js
// docs/manual-somos/check-manual.mjs
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
  /\bbot\d{6,}:/i, /service_role/i, /sk-[A-Za-z0-9]{10,}/]
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
const literales = [...html.matchAll(/<code class="ui"[^>]*>([\s\S]*?)<\/code>/g)].map(m => m[1])
for (const lit of literales) {
  if (/data-nocheck/.test(lit)) continue
  const trozos = lit.split(/<var>[\s\S]*?<\/var>/).map(normaliza).filter(t => t.length >= 3)
  for (const t of trozos) if (!codigo.includes(t)) fallos.push(`Literal no encontrado en el código: "${t}"`)
}

if (fallos.length) {
  console.error(`FALLOS (${fallos.length}):\n- ` + fallos.join('\n- '))
  process.exit(1)
}
console.log(`OK · ${ids.size} ids · ${literales.length} literales · ${tablas} tablas`)
```

Nota sobre los literales: las partes variables (nombres, horas, centros) van dentro de `<var>`, por ejemplo `<code class="ui">⚠️ Aviso: <var>Marta ya tiene una cita a las 10:00</var>. Puedes agendar igualmente.</code>`. Un literal que la app construye con plantillas tan troceadas que no se pueda comprobar lleva `data-nocheck` en el `<code>` y se verifica a mano; usarlo lo menos posible.

- [ ] **Step 2: Ejecutarlo sin index.html para ver que falla**

Run: `node docs/manual-somos/check-manual.mjs`
Expected: error ENOENT sobre `index.html`.

- [ ] **Step 3: Copiar el icono**

```bash
cp "../docs/branding-bebanana/BeBanana-Icon.png" docs/manual-somos/bebanana-icon.png
```

- [ ] **Step 4: Escribir el esqueleto de index.html**

Estructura: `<head>` con título "Manual Somos", fuentes, CSS; `<body>` con navegación, portada con Novedades, y las nueve secciones restantes vacías salvo su título y una línea de entrada. Contenido completo del CSS:

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manual Somos</title>
<meta name="color-scheme" content="light">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap">
<style>
:root{
  --amarillo:#f5c800; --amarillo-texto:#8a7000;
  --r-agente:#f5c800; --r-psicologo:#2dd4bf; --r-callcenter:#4a7dd4; --r-dante:#8b6fd6;
  --ok:#0f9c8a; --pend:#b7791f; --decision:#7a5cc7; --obsoleto:#8a8a8a;
  --radio:16px;
}
/* Temas por sección */
.oscura{
  --fondo:#04060a; --superficie:#0a1018; --texto:#e8eef5; --texto2:#7a8fa8;
  --borde:rgba(245,200,0,.14); --acento-texto:#f5c800; --ui-fondo:rgba(245,200,0,.08);
  background:var(--fondo); color:var(--texto);
}
.clara{
  --fondo:#faf9f5; --superficie:#ffffff; --texto:#1c1c1c; --texto2:#5f5f5f;
  --borde:#e6e3db; --acento-texto:#8a7000; --ui-fondo:#f3f0e6;
  background:var(--fondo); color:var(--texto);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth; scroll-padding-top:72px}
body{margin:0; background:#faf9f5; font:400 16px/1.55 "DM Sans",system-ui,sans-serif; -webkit-font-smoothing:antialiased}
.wrap{max-width:1080px; margin:0 auto; padding:0 16px}
h1,h2,h3{font-family:"Syne",sans-serif; line-height:1.1; letter-spacing:-.01em; text-wrap:balance}
h1{font-weight:800; font-size:clamp(34px,6vw,64px); margin:0}
h2{font-weight:800; font-size:clamp(26px,4vw,40px); margin:0 0 8px}
h3{font-weight:700; font-size:20px; margin:0}
p{margin:0 0 12px}
a{color:inherit}
.seccion{padding:64px 0}
.seccion .entrada{color:var(--texto2); max-width:70ch; font-size:17px; margin-bottom:28px}
.num{font:500 13px "DM Mono",monospace; color:var(--acento-texto); letter-spacing:.08em; display:block; margin-bottom:6px}

/* Navegación */
.nav{position:sticky; top:0; z-index:30; background:rgba(4,6,10,.92); backdrop-filter:blur(8px); border-bottom:1px solid rgba(245,200,0,.14)}
.nav .wrap{display:flex; align-items:center; gap:14px; min-height:56px}
.nav img{width:26px; height:26px}
.nav .marca{font:800 15px "Syne",sans-serif; color:#e8eef5; white-space:nowrap}
.nav ul{display:flex; gap:4px; list-style:none; margin:0 0 0 auto; padding:0; flex-wrap:wrap}
.nav ul a{display:block; padding:6px 10px; border-radius:999px; color:#a9b8c9; font-size:13.5px; font-weight:500; text-decoration:none; transition:background .15s,color .15s}
.nav ul a:hover{background:rgba(245,200,0,.12); color:#f5c800}
.nav select{display:none; margin-left:auto; min-height:40px; background:#0a1018; color:#e8eef5; border:1px solid rgba(245,200,0,.3); border-radius:8px; padding:0 10px; font:500 14px "DM Sans",sans-serif; max-width:60vw}
@media (max-width:900px){ .nav ul{display:none} .nav select{display:block} }

/* Portada */
.portada{padding:72px 0 56px}
.portada .para{font:500 13px "DM Mono",monospace; color:var(--amarillo); letter-spacing:.12em; text-transform:uppercase}
.portada h1 em{font-style:normal; color:var(--amarillo)}
.portada .lead{font-size:clamp(17px,2vw,20px); color:var(--texto2); max-width:62ch; margin:18px 0 0}
.portada .meta{display:flex; flex-wrap:wrap; gap:8px; margin-top:22px}
.pildora{display:inline-flex; align-items:center; gap:6px; border:1px solid var(--borde); border-radius:999px; padding:4px 12px; font-size:13px; color:var(--texto2)}
.indice{display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; margin-top:36px; padding:0; list-style:none}
.indice a{display:flex; gap:12px; align-items:baseline; padding:14px 16px; border:1px solid var(--borde); border-radius:var(--radio); background:var(--superficie); text-decoration:none; transition:border-color .15s, transform .15s}
.indice a:hover{border-color:var(--amarillo); transform:translateY(-2px)}
.indice .n{font:500 13px "DM Mono",monospace; color:var(--amarillo)}
.novedades{margin-top:36px; border:1px solid var(--borde); border-radius:var(--radio); background:var(--superficie); padding:18px 20px}
.novedades h2{font-size:22px}
.novedades ol{list-style:none; margin:10px 0 0; padding:0}
.novedades li{display:flex; gap:14px; flex-wrap:wrap; padding:10px 0; border-top:1px dashed var(--borde)}
.novedades time{font:500 13px "DM Mono",monospace; color:var(--amarillo); min-width:92px}

/* Fichas, chips, badges */
.fichas{display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr)); gap:16px}
.ficha{background:var(--superficie); border:1px solid var(--borde); border-radius:var(--radio); padding:18px 20px; scroll-margin-top:80px}
.clara .ficha{box-shadow:0 1px 3px rgba(28,28,28,.05)}
.ficha-cab{display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:10px}
.ficha-cab h3{flex:1 1 200px}
.ficha dl{margin:0; display:grid; grid-template-columns:auto 1fr; gap:6px 14px; font-size:15px}
.ficha dt{font-weight:600; color:var(--texto2)}
.ficha dd{margin:0}
.chip{display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; border-radius:999px; padding:2px 10px; border:1px solid currentColor; white-space:nowrap}
.chip::before{content:""; width:8px; height:8px; border-radius:50%; background:var(--c)}
.chip.r-agente{--c:var(--r-agente)} .chip.r-psicologo{--c:var(--r-psicologo)} .chip.r-callcenter{--c:var(--r-callcenter)} .chip.r-dante{--c:var(--r-dante)}
.chip{color:var(--texto)}
.badge{font-size:11.5px; font-weight:700; letter-spacing:.04em; border-radius:6px; padding:2px 8px; color:#fff; white-space:nowrap}
.b-prod{background:var(--ok)} .b-pend{background:var(--pend)} .b-decision{background:var(--decision)} .b-obsoleto{background:var(--obsoleto)}
code.ui{font:400 .88em/1.4 "DM Mono",monospace; background:var(--ui-fondo); border-radius:5px; padding:1px 6px; box-decoration-break:clone; -webkit-box-decoration-break:clone}
code.ui var{font-style:italic; opacity:.85}
.lista-msg{list-style:none; margin:8px 0 0; padding:0}
.lista-msg li{padding:7px 0; border-top:1px dashed var(--borde); font-size:14.5px}
.lista-msg li .donde{display:block; font-size:12.5px; color:var(--texto2)}
.nota{border-left:3px solid var(--amarillo); background:var(--ui-fondo); padding:10px 14px; border-radius:0 10px 10px 0; font-size:15px; margin:12px 0}
details{margin-top:12px; border-top:1px solid var(--borde); padding-top:10px}
summary{cursor:pointer; font-weight:600; font-size:14px; color:var(--acento-texto); list-style:none; display:flex; align-items:center; gap:8px; min-height:32px}
summary::-webkit-details-marker{display:none}
summary::before{content:"+"; font:500 16px "DM Mono",monospace; transition:transform .15s}
details[open] summary::before{content:"–"}
.subtitulo{font:700 13px "DM Sans",sans-serif; letter-spacing:.1em; text-transform:uppercase; color:var(--texto2); margin:32px 0 12px}

/* Tablas */
.tabla{overflow-x:auto; border:1px solid var(--borde); border-radius:12px; background:var(--superficie); margin:12px 0}
table{border-collapse:collapse; width:100%; min-width:560px; font-size:14.5px}
th,td{text-align:left; padding:10px 12px; border-bottom:1px solid var(--borde); vertical-align:top}
th{position:sticky; top:0; background:var(--superficie); font-weight:600; color:var(--texto2); font-size:13px}
tr:last-child td{border-bottom:0}
td.si{color:var(--ok); font-weight:700} td.no{color:var(--texto2)}

/* Sección 1: mapa */
.mapa{display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr)); gap:14px}
.pieza{border:1px solid var(--borde); border-radius:var(--radio); padding:18px; background:var(--superficie); position:relative}
.pieza .icono{font-size:26px; line-height:1}
.pieza h3{margin:10px 0 6px}
.pieza p{color:var(--texto2); font-size:15px; margin:0}
.pieza.destacada{border-color:var(--amarillo)}
.flujo{display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:24px; font:500 14px "DM Mono",monospace}
.flujo span{border:1px solid var(--borde); border-radius:999px; padding:6px 12px; background:var(--superficie)}
.flujo b{color:var(--amarillo)}

footer{padding:40px 0 56px; font-size:14px; color:var(--texto2)}
footer .wrap{display:flex; gap:12px; align-items:center; flex-wrap:wrap}
footer img{width:28px; height:28px}

@media (prefers-reduced-motion:reduce){ html{scroll-behavior:auto} *{transition:none!important} }

@media print{
  .nav{display:none}
  .oscura{--fondo:#fff; --superficie:#fff; --texto:#1c1c1c; --texto2:#555; --borde:#ddd; --acento-texto:#8a7000; --ui-fondo:#f3f0e6}
  body,.clara{background:#fff}
  .seccion{padding:24px 0; break-inside:auto}
  .ficha,.pieza,tr{break-inside:avoid}
  .tabla{overflow:visible}
  table{min-width:0}
  th{position:static}
  .portada h1 em,.flujo b,.indice .n,.novedades time,.portada .para{color:#8a7000}
}
</style>
</head>
<body>
<nav class="nav" aria-label="Secciones">
  <div class="wrap">
    <img src="bebanana-icon.png" alt="" width="26" height="26">
    <span class="marca">Manual Somos</span>
    <ul>
      <li><a href="#montado">Cómo está montado</a></li>
      <li><a href="#roles">Quién ve qué</a></li>
      <li><a href="#pantallas">Pantallas</a></li>
      <li><a href="#cita">Una cita</a></li>
      <li><a href="#disponibilidad">Horarios</a></li>
      <li><a href="#dante">Dante</a></li>
      <li><a href="#pendientes">Pendientes</a></li>
      <li><a href="#glosario">Glosario</a></li>
    </ul>
    <select aria-label="Ir a la sección" id="nav-movil">
      <option value="#portada">Inicio</option>
      <option value="#novedades">Novedades</option>
      <option value="#montado">1 · Cómo está montado</option>
      <option value="#roles">2 · Quién entra y qué ve</option>
      <option value="#pantallas">3 · Las pantallas</option>
      <option value="#cita">4 · El viaje de una cita</option>
      <option value="#disponibilidad">5 · Horarios y disponibilidad</option>
      <option value="#dante">6 · Dante</option>
      <option value="#pendientes">7 · Pendientes</option>
      <option value="#glosario">8 · Glosario</option>
    </select>
  </div>
</nav>

<header class="oscura" id="portada">
  <div class="wrap portada">
    <span class="para">Para el equipo de dirección de Somos Psicólogos</span>
    <h1>Cómo funciona<br><em>vuestra app</em>, pieza a pieza</h1>
    <p class="lead">Qué hace cada pantalla, qué ve cada persona del equipo, qué mensajes aparecen y por qué, y qué pasa por detrás cada vez que alguien agenda una cita. Este documento crece con la app: cuando añadimos algo, lo veréis en Novedades.</p>
    <div class="meta">
      <span class="pildora">Versión del 27-09-2026</span>
      <span class="pildora">Preparado por Be Banana</span>
    </div>
    <ol class="indice">
      <li><a href="#montado"><span class="n">01</span>Cómo está montado</a></li>
      <li><a href="#roles"><span class="n">02</span>Quién entra y qué ve</a></li>
      <li><a href="#pantallas"><span class="n">03</span>Las pantallas, una a una</a></li>
      <li><a href="#cita"><span class="n">04</span>El viaje de una cita</a></li>
      <li><a href="#disponibilidad"><span class="n">05</span>Horarios y disponibilidad</a></li>
      <li><a href="#dante"><span class="n">06</span>Dante</a></li>
      <li><a href="#pendientes"><span class="n">07</span>Pendientes y decisiones</a></li>
      <li><a href="#glosario"><span class="n">08</span>Glosario</a></li>
    </ol>
    <section class="novedades" id="novedades" aria-labelledby="t-novedades">
      <h2 id="t-novedades">Novedades</h2>
      <ol>
        <li><time datetime="2026-09-27">27-09-2026</time><span>Primera versión del manual: todo el sistema tal y como está hoy.</span></li>
      </ol>
    </section>
  </div>
</header>

<!-- SECCIONES: cada tarea sustituye su bloque -->
<section class="oscura seccion" id="montado"><div class="wrap"><span class="num">01</span><h2>Cómo está montado</h2></div></section>
<section class="clara seccion" id="roles"><div class="wrap"><span class="num">02</span><h2>Quién entra y qué ve</h2></div></section>
<section class="clara seccion" id="pantallas"><div class="wrap"><span class="num">03</span><h2>Las pantallas, una a una</h2></div></section>
<section class="clara seccion" id="cita"><div class="wrap"><span class="num">04</span><h2>El viaje de una cita</h2></div></section>
<section class="clara seccion" id="disponibilidad"><div class="wrap"><span class="num">05</span><h2>Horarios y disponibilidad</h2></div></section>
<section class="clara seccion" id="dante"><div class="wrap"><span class="num">06</span><h2>Dante</h2></div></section>
<section class="clara seccion" id="pendientes"><div class="wrap"><span class="num">07</span><h2>Pendientes y decisiones abiertas</h2></div></section>
<section class="clara seccion" id="glosario"><div class="wrap"><span class="num">08</span><h2>Glosario</h2></div></section>

<footer class="clara">
  <div class="wrap">
    <img src="bebanana-icon.png" alt="Be Banana" width="28" height="28">
    <span>Preparado por <b>Be Banana</b> para Somos Psicólogos · versión del 27-09-2026 · «Where humans use artificial intelligence with real intelligence»</span>
  </div>
</footer>

<script>
  // Navegación móvil
  document.getElementById('nav-movil').addEventListener('change', e => {
    const d = document.querySelector(e.target.value); if (d) d.scrollIntoView()
  })
  // Imprimir con todo abierto
  let abiertos = []
  addEventListener('beforeprint', () => {
    abiertos = [...document.querySelectorAll('details:not([open])')]
    abiertos.forEach(d => d.open = true)
  })
  addEventListener('afterprint', () => abiertos.forEach(d => d.open = false))
</script>
</body>
</html>
```

- [ ] **Step 5: Ejecutar el script**

Run: `node docs/manual-somos/check-manual.mjs`
Expected: `OK · … ids · 0 literales · 0 tablas`

- [ ] **Step 6: Probar que el script detecta fallos (y deshacer)**

Añadir temporalmente al final del `<body>`: `<a href="#no-existe">x</a><code class="ui">Texto que no está en la app</code><p>hook.eu2.make.com</p><table></table>`.
Run: `node docs/manual-somos/check-manual.mjs`
Expected: código 1 con cuatro fallos: ancla rota `#no-existe`, literal no encontrado, posible secreto, 1 tabla fuera de `.tabla`. Quitar la línea y volver a ejecutar: `OK`.

- [ ] **Step 7: Commit**

```bash
git add docs/manual-somos
git commit -m "Docs: esqueleto del manual Somos (estética Be Banana) y script de comprobación"
```

---

### Task 2: Secciones 1 y 2 (Cómo está montado, Quién entra y qué ve)

**Files:**
- Modify: `docs/manual-somos/index.html` (bloques `#montado` y `#roles`)

**Interfaces:**
- Consumes: clases de Task 1 (`.mapa`, `.pieza`, `.flujo`, `.tabla`, `.chip.r-*`, `.ficha`).
- Produces: nada que usen otras tareas.

- [ ] **Step 1: Escribir `#montado`**

Dentro de `.wrap`, tras el `<h2>`: un `<p class="entrada">` ("Vuestra app no trabaja sola. Cuando alguien agenda una cita, se ponen en marcha varias piezas. Así encajan.") y una `.mapa` con ocho `.pieza` (icono emoji, `<h3>`, `<p>`, badge de estado si aplica), con exactamente estas piezas y textos del spec §1: La app (destacada, badge "en producción"), Make, Dante (badge "en producción"), Google Calendar, Telegram, WhatsApp Business (badge "pendiente": "el paso completo está pendiente"), Consentimiento informado, Proveedor externo de calendario. Debajo, `.flujo`:

```html
<div class="flujo" aria-label="Recorrido de una acción">
  <span>App o Dante</span><b>→</b><span>Make</span><b>→</b><span>Google Calendar</span><b>+</b><span>estado del paciente</span><b>+</b><span>aviso por Telegram</span>
</div>
<p class="nota">Además, la propia base de datos avisa sola al proveedor externo de calendario cada vez que se agenda, cambia o anula una cita o se bloquea una agenda. Y cada acción queda apuntada en un historial, que es de donde salen las Estadísticas.</p>
```

- [ ] **Step 2: Escribir `#roles`**

`<p class="entrada">` + tres `.ficha` (una por rol), cada una con `.ficha-cab` (`<h3>` + `.chip` del rol) y `<dl>` con: *Quién es*, *Empieza en* (Panel General / Citas / Calendario), *Puede*, *No puede*. Contenido de `docs/roles-y-permisos.md` y del apartado 2 del spec. Luego `<p class="subtitulo">Qué pantalla ve cada uno</p>` y la tabla pantalla × rol dentro de `<div class="tabla">`, con columnas Pantalla · Agente · Psicólogo · Call center; filas: Calendario, Panel General, Estadísticas, Pacientes, Psicólogos, Agentes, Usuarios, Citas, Comunicaciones, Mensajes. Celdas `td.si` con "Sí" o matiz ("Solo los suyos", "Su actividad", "Solo citas y altas", "Página de inicio") y `td.no` con "No".

Después `<p class="subtitulo">Altas, bajas y contraseñas</p>` con una `.ficha` que explica: las altas se hacen en Usuarios con el botón `<code class="ui">Crear y enviar acceso</code>`; dos formas de restablecer (`<code class="ui">Enviar acceso</code>` y `<code class="ui">Generar</code>`, tabla de dos filas con qué hace y cuándo usarlo, sacada de roles-y-permisos.md); `.nota`: "Desactivar a alguien no borra su cuenta ni le impide entrar: deja de aparecer en los desplegables. En call center conviene una cuenta por persona, porque todo lo que hace queda firmado con su nombre."

- [ ] **Step 3: Pasar el check**

Run: `node docs/manual-somos/check-manual.mjs`
Expected: `OK`. Si un literal falla, buscar el texto real con `grep -rn "Enviar acceso" app` y copiarlo exacto.

- [ ] **Step 4: Commit**

```bash
git add docs/manual-somos/index.html
git commit -m "Docs: manual Somos, secciones Cómo está montado y Quién ve qué"
```

---

### Task 3: Sección 3 (Las pantallas, una a una)

**Files:**
- Modify: `docs/manual-somos/index.html` (bloque `#pantallas`)

**Interfaces:**
- Consumes: `.fichas`, `.ficha`, `.chip.r-*`, `.lista-msg`, `code.ui` con `<var>`, `details`, `.badge.b-obsoleto`.

- [ ] **Step 1: Plantilla de ficha**

Cada pantalla es un `<article class="ficha" id="p-<slug>">` con esta estructura exacta:

```html
<article class="ficha" id="p-citas">
  <div class="ficha-cab"><h3>Citas</h3><span class="chip r-agente">Agente</span><span class="chip r-psicologo">Psicólogo</span><span class="chip r-callcenter">Call center</span></div>
  <dl>
    <dt>Para qué</dt><dd>…</dd>
    <dt>Qué se hace</dt><dd>…</dd>
  </dl>
  <details><summary>Ver mensajes</summary>
    <ul class="lista-msg">
      <li><code class="ui">⚠️ Aviso: <var>la agenda de Marta está bloqueada ese día (Vacaciones)</var>. Puedes agendar igualmente.</code><span class="donde">Solo agentes · aviso ámbar encima del botón, no impide enviar</span></li>
    </ul>
  </details>
</article>
```

Slugs: `p-calendario`, `p-panel`, `p-estadisticas`, `p-pacientes`, `p-psicologos`, `p-agentes`, `p-usuarios`, `p-citas`, `p-comunicaciones`, `p-mensajes`. Orden: Citas, Calendario, Pacientes, Comunicaciones, Mensajes, Panel General, Estadísticas, Usuarios, Psicólogos, Agentes (primero lo que más se usa).

- [ ] **Step 2: Escribir las diez fichas**

Contenido de "Para qué" y "Qué se hace": el inventario del spec §3 y de `docs/roles-y-permisos.md`. Mensajes: para Citas, Usuarios y Calendario, todos los del bloque que pegó Sonia (en la conversación del 26-09, reproducido en el spec §3), agrupados con `<span class="donde">` indicando rol y lugar. Para el resto, los mensajes visibles encontrados en su `page.tsx` (errores, vacíos, confirmaciones). Incluir en Citas también los de alta de paciente y duplicados (`Este paciente ya está añadido en tu lista`, `Este paciente ya existe en la base de datos asignado a otro psicólogo. Hemos avisado al equipo para que lo revisen.`) y `✅ ¡Listo! La acción se ha registrado correctamente.`

El aviso de la migración 012 va así, con `data-nocheck` solo si el grep no lo encuentra:

```html
<li><code class="ui">Falta ejecutar la migración 012 (horarios y medias horas): <var>…</var></code> <span class="badge b-obsoleto">ya no debería salir</span><span class="donde">Usuarios · si aparece, avisad a Be Banana</span></li>
```

Antes de escribir cada literal: `grep -rn "<texto>" app lib components` y copiar el texto exacto, respetando tildes, comillas tipográficas, puntos suspensivos `…` y espacios.

- [ ] **Step 3: Pasar el check**

Run: `node docs/manual-somos/check-manual.mjs`
Expected: `OK` con más de 60 literales. Cada fallo de literal se corrige copiando el texto real; si el texto de Sonia difiere del código, manda el código.

- [ ] **Step 4: Commit**

```bash
git add docs/manual-somos/index.html
git commit -m "Docs: manual Somos, fichas de las diez pantallas con sus mensajes"
```

---

### Task 4: Secciones 4 y 5 (El viaje de una cita, Horarios y disponibilidad)

**Files:**
- Modify: `docs/manual-somos/index.html` (bloques `#cita` y `#disponibilidad`)

**Interfaces:**
- Consumes: `.tabla`, `.ficha`, `.badge.b-decision`, `.nota`, `.subtitulo`, enlaces a `#p-citas`, `#p-comunicaciones`, `#dante`.

- [ ] **Step 1: Escribir `#cita`**

En este orden, con `<p class="subtitulo">` para cada bloque:
1. **Por dónde entra un paciente**: dos `.ficha` (La app, con enlace a `#p-citas`; Dante, con enlace a `#dante`). Qué se pide, iniciales automáticas, casilla `<code class="ui">Nueva recomendación</code>`, tutores si es menor (hasta 15 años).
2. **Duplicados**: párrafo + los dos mensajes literales + "el equipo recibe un aviso de posible duplicado por Telegram; si venía como recomendación, se marca para revisar".
3. **Estados del paciente**: tabla Estado · Quién lo pone · Cuándo. Filas: Nuevo paciente, Agendado, Anulado, Sin disponibilidad, En espera, Cambio solicitado, Dudoso contactado, Psicólogo. Y cuatro filas con `<span class="badge b-decision">decisión pendiente</span>` en la columna "Quién lo pone": Dudoso, Revisar recomendado, Psicólogo sin disponibilidad, Inactivo; en "Cuándo": "Hoy nadie lo asigna. Por decidir: ¿lo usará el call center? ¿se activa?". Nota bajo la tabla: los cambios desde Comunicaciones quedan registrados.
4. **Acciones**: tabla Acción · Quién la tiene · Qué pasa en Google Calendar · Estado del paciente · Mensaje. Diez filas (Agendar, Cambiar, Cancelar, Añadir nuevo paciente, Bloquear agenda, Desbloquear agenda, Modificar bloqueo personal, Asuntos propios, Vacaciones, Baja laboral) con los datos del spec §4 y `../docs/make-cambios-2026-09-25.md`. Quién la tiene con `.chip`. Nota: "Cambiar mueve la misma cita, no crea otra. Cancelar la deja anulada en el historial."
5. **Consentimiento**: `.ficha` adultos y `.ficha` menores (dos tutores; si solo hay uno, se explica en "Otros"). Estados visibles en la app: `✓ Consentimiento firmado` / `⏳ Consentimiento pendiente` (copiar el literal real del código). Nota: "Si cambia el formulario de la web (remitente, asunto o campos), el consentimiento deja de marcarse solo sin avisar."
6. **Tipo de cita**: Adulto, Pareja, Menor; se preselecciona Menor si el paciente es menor. Todas duran 60 minutos.

- [ ] **Step 2: Escribir `#disponibilidad`**

1. `<p class="entrada">`: "Cada psicólogo tiene un horario semanal en cada centro donde trabaja. La app lo usa para ofrecer solo huecos reales."
2. `.ficha` "Las reglas" con lista numerada: horario semanal por centro editado por agentes en Usuarios (enlace `#p-usuarios`); sin horario = sin restricción; citas de 60 minutos; horas en punto de 08:00 a 21:00; con `30'` también las medias hasta 21:30 (por defecto nadie lo tiene); bloqueos cuentan como días completos.
3. `.ficha` "Qué se comprueba al elegir hora": las cuatro comprobaciones del spec §5 en orden y la prioridad ocupada > fuera de horario > media hora.
4. Dos `.ficha` lado a lado: **Psicólogo y call center: la app no deja** (solo huecos libres, sin fechas pasadas, selector desactivado con motivo) y **Agente: la app avisa** (ve todas las horas con sufijo, aviso ámbar, puede agendar igualmente). Cada una con sus literales.
5. `<p class="subtitulo">Límites que conviene conocer</p>` con `.lista-msg` de tres puntos: dos personas en el mismo hueco a la vez; lo apuntado a mano en Google Calendar no se ve en la app; Dante consulta hoy otra fuente y puede ofrecer huecos distintos (badge `b-pend` y enlace a `#pendientes`).

- [ ] **Step 3: Pasar el check**

Run: `node docs/manual-somos/check-manual.mjs`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add docs/manual-somos/index.html
git commit -m "Docs: manual Somos, viaje de una cita y reglas de disponibilidad"
```

---

### Task 5: Secciones 6, 7 y 8 (Dante, Pendientes, Glosario)

**Files:**
- Modify: `docs/manual-somos/index.html` (bloques `#dante`, `#pendientes`, `#glosario`)

**Interfaces:**
- Consumes: `.fichas`, `.ficha`, `.tabla`, `.badge.*`, `.chip.r-dante`.

- [ ] **Step 1: Escribir `#dante`**

`<p class="entrada">` ("Dante es el asistente de Telegram que atiende a los pacientes a cualquier hora."). Tres `.ficha`: **Qué hace** (alta, huecos, agendar, cambiar, anular con confirmación previa, registrar "Sin disponibilidad" y "Cambio solicitado"; texto y audio), **Qué no hace** (bloqueos; imágenes, con su respuesta literal entre comillas normales porque no está en `somos-app`; nunca muestra identificadores; una sola cita activa por paciente; horas en punto o y media de 08:00 a 21:30), **Cuándo pasa a una persona**: tabla Tipo · Orden de aviso (General: Marta → Sonia → Jaime; Marketing: Jaime → Sonia → Marta; Emergencia: Bea → Marta → Sonia → Jaime, y recuerda 112 y 024). Nota: responder "atendido" cierra la derivación; si nadie responde, recordatorio cada 15 minutos. Nota con `b-decision`: el paciente recibe hoy dos confirmaciones (Dante y la de Make). Los textos de Dante no van en `code.ui` (no están en el código de la app); usar comillas «».

- [ ] **Step 2: Escribir `#pendientes`**

Dos bloques con `<p class="subtitulo">`: **Decisiones que tomar** (badge `b-decision`) y **Cosas por construir o ajustar** (badge `b-pend`). Cada punto es un `<li>` en `.lista-msg` con una frase en negrita y una de contexto. Decisiones: estados sin uso (¿call center? ¿se activan?); doble confirmación con Dante; si Dante envía el enlace del consentimiento; rediseño "paciente con varios psicólogos" (no se hace hasta que Sonia lo indique). Por construir: paso a WhatsApp de Dante y recordatorios de consentimiento; unificar disponibilidad de Dante con la app; tipo de cita en el título del evento del calendario; renombrar "Barrio Salamanca" a "Salamanca"; activar `30'` a quien lo necesite; cerrar la protección de datos a nivel de base de datos; actualizar la guía de pruebas antigua.

- [ ] **Step 3: Escribir `#glosario`**

`<dl>` a dos columnas en escritorio (CSS local: `#glosario dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:4px 32px}` y cada término un `<div>` con `<dt>` + `<dd>`). Términos, en orden alfabético: Bloqueo, Centro, Cita activa, Consentimiento, Dante, Derivación, Ficha de psicólogo, Iniciales, Menor, Origen, Permiso de bloqueo, Proveedor externo de calendario, Psicólogo en varios centros, Recomendado, Tipo de cita, 30'. Definiciones del spec §8, en una o dos frases.

- [ ] **Step 4: Pasar el check**

Run: `node docs/manual-somos/check-manual.mjs`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add docs/manual-somos/index.html
git commit -m "Docs: manual Somos, Dante, pendientes y glosario"
```

---

### Task 6: Revisión visual, publicación, README y memoria

**Files:**
- Create: `docs/manual-somos/README.md`
- Create: memoria `C:\Users\Usuario\.claude\projects\z--Claude-Somos-Psicol-gos\memory\project_manual_somos.md` + línea en `MEMORY.md`

- [ ] **Step 1: Revisión visual**

Abrir `docs/manual-somos/index.html` en el navegador disponible (skill de navegador si hay uno; si no, publicar primero y revisar el artifact). Comprobar a 390px y a 1280px: sin scroll horizontal de página, navegación en `<select>` en móvil y funcional, tablas con scroll propio, contraste correcto en oscuro y claro, vista previa de impresión en claro con plegables abiertos. Corregir y volver a pasar el check.

- [ ] **Step 2: Publicar**

Artifact `publish` con `file_path` = `docs/manual-somos/index.html`, `files` = `{"bebanana-icon.png": "docs/manual-somos/bebanana-icon.png"}`, `icon` = `book`, descripción: "Manual vivo de la app Somos Psicólogos para su equipo de dirección." Sin `capabilities`.

- [ ] **Step 3: Escribir README con la URL**

```markdown
# Manual Somos (artifact para los dueños)

Manual vivo de la app para el equipo de dirección de Somos Psicólogos.

- Publicado en: <URL devuelta por el publish>
- Fuente: `index.html` (esta carpeta). Nunca se edita el artifact a mano.
- Spec: `../superpowers/specs/2026-09-27-manual-somos-duenos-design.md`

## Regla de actualización

Cada cambio de la app que afecte a lo que ve alguien (pantalla, mensaje, regla, decisión tomada):

1. Actualizar su ficha en `index.html`.
2. Añadir una línea arriba en Novedades con la fecha y un enlace a la ficha.
3. Cambiar la fecha de versión en la portada y en el pie.
4. `node docs/manual-somos/check-manual.mjs` debe dar OK.
5. Republicar al mismo enlace (Artifact publish con la URL de arriba y el icono como archivo de apoyo).
```

- [ ] **Step 4: Memoria**

Crear `project_manual_somos.md` (type project) con la URL, la ruta de la fuente y la regla de actualización (Why: los dueños ven el mismo enlace; How to apply: al cerrar cualquier funcionalidad de somos-app, actualizar ficha + Novedades + republicar). Añadir la línea al índice `MEMORY.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/manual-somos
git commit -m "Docs: manual Somos publicado, README con URL y regla de actualización"
```
