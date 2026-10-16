// Vista RUNNING: plan del entrenador, registro de sesiones, zonas, auditoría inicial y guía.
// El contenido del entrenador viene de data/running.json; tus datos, de running-store.js.
import * as rs from '../running-store.js';
import { zonasRitmo, zonasFC, formatoRitmo, leerTiempo, resumenCarga, ritmoMedio, cargaSesion } from '../running-calc.js';
import { iso, parse, addDays } from '../schedule.js';
import { icono } from '../icons.js';
import { esc, DIAS, fechaCorta, fechaLarga, botonCheck, mostrarToast, confirmar, abrirHoja } from '../ui.js';
import { idNuevo } from '../store.js';

const SECCIONES = [
  ['plan', 'Plan'],
  ['registro', 'Registro'],
  ['zonas', 'Zonas'],
  ['auditoria', 'Auditoría'],
  ['guia', 'Guía'],
];
const TIPOS = [
  ['rodaje', 'Rodaje'],
  ['calidad', 'Calidad'],
  ['tirada', 'Tirada larga'],
  ['competicion', 'Competición o test'],
  ['padel', 'Pádel'],
  ['gimnasio', 'Gimnasio'],
  ['natacion', 'Natación'],
  ['otro', 'Otro'],
];
const NOMBRES_PLAN = { descanso: 'Descanso', fuerza: 'Fuerza', movilidad: 'Movilidad' };
const nombreTipo = (t) => NOMBRES_PLAN[t] || (TIPOS.find((x) => x[0] === t) || [, 'Sesión'])[1];
const esCarrera = (t) => ['rodaje', 'calidad', 'tirada', 'competicion'].includes(t);
const MOLESTIAS = [['aquiles', 'Gemelo / Aquiles'], ['rodilla', 'Rodilla izq.'], ['cervical', 'Cuello / trapecios']];

let raiz = null;
let seccion = 'plan';
let semanaIdx = null;
const abiertas = new Set();

// --- Utilidades ---------------------------------------------------------------------------------
const kmTxt = (n) => (Math.round(n * 10) / 10).toLocaleString('es-ES');
const fechaTxt = (s) => { const d = parse(s); return `${DIAS[d.getDay() || 7].toLowerCase()} ${fechaCorta(d)}`; };

function zonasActuales() {
  const z = rs.datosZonas();
  const t = leerTiempo(z.marca);
  return {
    datos: z,
    ritmo: t ? zonasRitmo(Number(z.distancia) || 10000, t) : null,
    fc: Number(z.fcUmbral) ? zonasFC(Number(z.fcUmbral), Number(z.fcMax) || null) : null,
  };
}

// Sustituye {E}, {T}, {I}… por el rango de ritmo correspondiente.
function conRitmos(txt, ritmo) {
  return esc(txt).replace(/\{(E|M|T|10K|I|R)\}/g, (_, id) => {
    const z = ritmo && ritmo.zonas.find((x) => x.id === id);
    return z ? `<b class="ritmo">${formatoRitmo(z.desde)}–${formatoRitmo(z.hasta)}/km</b>` : `ritmo ${id}`;
  });
}

function desplegable(id, cabecera, cuerpo, extra = '') {
  const ab = abiertas.has(id);
  return `<section class="r-plegable${ab ? ' abierta' : ''}${extra}" data-plegable="${esc(id)}">
    <button type="button" class="r-plegable-cab" aria-expanded="${ab}">${cabecera}${icono('chevronAbajo', 18, 'mini-chev')}</button>
    <div class="r-plegable-det"><div><div class="r-plegable-int">${cuerpo}</div></div></div>
  </section>`;
}

// --- PLAN -------------------------------------------------------------------------------------------
function semanaActualIdx(semanas) {
  const hoy = iso(new Date());
  let idx = semanas.findIndex((s) => s.lunes <= hoy && hoy <= iso(addDays(parse(s.lunes), 6)));
  if (idx < 0) idx = semanas.findIndex((s) => s.lunes > hoy);
  if (idx < 0) idx = semanas.length - 1;
  return idx;
}

function htmlDetalleSesion(s, ritmo) {
  const filas = [
    ['Duración', [s.duracion ? `${s.duracion} min` : '', s.km ? `~${kmTxt(s.km)} km` : ''].filter(Boolean).join(' · ')],
    ['Calentamiento', s.calentamiento],
    ['Bloque principal', s.principal],
    ['Recuperaciones', s.recuperaciones],
    ['Vuelta a la calma', s.vuelta],
    ['Ritmo', s.ritmo],
    ['Intensidad', [s.zona, s.rpe ? `RPE ${s.rpe}` : ''].filter(Boolean).join(' · ') || s.intensidad],
    ['Objetivo', s.objetivo],
    ['Notas', s.notas || s.nota],
  ].filter(([, v]) => v);
  return `<dl class="r-dl">${filas.map(([k, v]) => `<div class="dato"><dt>${k}</dt><dd>${conRitmos(v, ritmo)}</dd></div>`).join('')}</dl>`;
}

function htmlSesionPlan(s, ritmo) {
  const hecha = rs.sesionHecha(s.id);
  const reg = rs.registroDeSesion(s.id);
  const meta = [nombreTipo(s.tipo), s.duracion ? `${s.duracion} min` : '', s.km ? `~${kmTxt(s.km)} km` : '', s.zona].filter(Boolean).join(' · ');
  const ab = abiertas.has(s.id);
  return `<li class="fila r-sesion tipo-${esc(s.tipo)}${hecha ? ' hecha' : ''}${ab ? ' abierta' : ''}" data-sesion="${esc(s.id)}">
    ${s.tipo === 'descanso' ? '<span class="check"></span>' : botonCheck(hecha)}
    <div class="fila-cuerpo" role="button" tabindex="0" aria-expanded="${ab}">
      <div class="fila-titulo"><span class="tt">${esc(s.titulo)}</span></div>
      <div class="fila-meta"><span>${esc(meta)}</span>${icono('chevronAbajo', 13, 'mini-chev')}</div>
      <div class="fila-notas"><div>${htmlDetalleSesion(s, ritmo)}
        ${s.tipo === 'descanso' ? '' : `<button type="button" class="boton-fino r-registrar" data-registrar="${esc(s.id)}">${reg ? 'Ver registro' : 'Registrar cómo fue'}</button>`}
      </div></div>
    </div>
  </li>`;
}

function htmlSemana(sem, ritmo, idx, total) {
  const lunes = parse(sem.lunes);
  const domingo = addDays(lunes, 6);
  const hoy = iso(new Date());
  const lista = (titulo, items) => (items && items.length ? `<div class="tit-lista">${titulo}</div><div class="lista r-texto"><ul class="r-puntos">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '');
  return `
    <div class="r-semana-nav">
      <button type="button" class="btn-icono" data-semana="-1" ${idx <= 0 ? 'disabled' : ''} aria-label="Semana anterior">${icono('chevronIzq', 22)}</button>
      <div class="r-semana-tit"><b>${fechaCorta(lunes)} – ${fechaCorta(domingo)}</b><span>${esc(sem.fase || '')}</span></div>
      <button type="button" class="btn-icono" data-semana="1" ${idx >= total - 1 ? 'disabled' : ''} aria-label="Semana siguiente">${icono('chevron', 22)}</button>
    </div>
    ${sem.diagnostico ? `<div class="r-tarjeta"><div class="r-sobre">Diagnóstico</div><p>${esc(sem.diagnostico)}</p></div>` : ''}
    ${sem.objetivo ? `<div class="r-tarjeta acento"><div class="r-sobre">Objetivo de la semana</div><p>${esc(sem.objetivo)}</p></div>` : ''}
    ${(sem.dias || []).map((d) => `
      <section class="dia${d.fecha === hoy ? ' hoy' : ''}">
        <div class="dia-cab"><span class="nombre">${DIAS[parse(d.fecha).getDay() || 7]}</span><span class="fecha">${fechaCorta(parse(d.fecha))}</span>
          ${d.fecha === hoy ? '<span class="pildora">Hoy</span>' : ''}</div>
        <ul>${(d.sesiones || []).map((s) => htmlSesionPlan(s, ritmo)).join('')}</ul>
      </section>`).join('')}
    ${lista('Qué observar', sem.observar)}
    ${lista('Cuándo modificar o cancelar', sem.modificar)}
    ${sem.porque ? `<div class="tit-lista">Por qué esta semana</div><div class="lista r-texto"><p>${esc(sem.porque)}</p></div>` : ''}`;
}

function htmlPlan(c, ritmo) {
  const semanas = (c.plan && c.plan.semanas) || [];
  if (semanas.length) {
    if (semanaIdx == null || semanaIdx >= semanas.length) semanaIdx = semanaActualIdx(semanas);
    return htmlSemana(semanas[semanaIdx], ritmo, semanaIdx, semanas.length);
  }
  const d = c.diagnostico || {};
  const respondidas = contarRespuestas(c);
  return `
    <div class="r-tarjeta acento">
      <div class="r-sobre">${icono('info', 15)} Fase actual</div>
      <div class="r-grande">Auditoría inicial</div>
      <p>Aún no hay plan semanal: antes necesito confirmar tu punto de partida. ${respondidas.hechas ? `Llevas ${respondidas.hechas} de ${respondidas.total} preguntas respondidas.` : 'Empieza por el bloque 1.'}</p>
      <button type="button" class="boton-fino" data-ir="auditoria">Ir a la auditoría</button>
    </div>

    <div class="tit-lista">Hoja de ruta</div>
    <ol class="lista r-pasos">${(c.hojaDeRuta || []).map((p, i) => `<li class="${p.estado}"><span class="r-num">${i + 1}</span><div><b>${esc(p.paso)}</b><small>${esc(p.texto)}</small></div></li>`).join('')}</ol>

    <div class="tit-lista">Lo que ya veo en tus datos</div>
    <div class="lista r-hallazgos">
      ${(d.hallazgos || []).map((h) => `<div class="r-hallazgo nivel-${h.nivel}"><b>${esc(h.titulo)}</b><p>${esc(h.texto)}</p></div>`).join('')}
    </div>
    ${d.conclusion ? `<div class="r-tarjeta"><div class="r-sobre">Conclusión provisional</div><p>${esc(d.conclusion)}</p></div>` : ''}
    ${d.fuente ? `<p class="pie">${esc(d.fuente)}</p>` : ''}

    <div class="tit-lista">Periodización prevista</div>
    <div class="lista r-fases">${(c.fases || []).map((f) => `<div class="campo col"><div class="et"><b>${esc(f.nombre)}</b> · ${esc(f.duracion)}<small>${esc(f.objetivo)}</small></div></div>`).join('')}</div>
    <p class="pie">Las fases no son rígidas: su duración depende de tu respuesta al entrenamiento y del calendario de carreras.</p>`;
}

// --- REGISTRO -----------------------------------------------------------------------------------
function htmlRegistro() {
  const regs = rs.registros();
  const r = resumenCarga(regs);
  const hoy = new Date();
  const ult7 = regs.filter((x) => x.fecha >= iso(addDays(hoy, -6)));
  const molestias = MOLESTIAS.map(([k, n]) => {
    const vals = ult7.filter((x) => typeof x[k] === 'number').map((x) => x[k]);
    return [n, vals.length ? Math.max(...vals) : null];
  });
  const max = Math.max(1, ...r.semanas.map((s) => s.km));
  const barras = r.semanas.map((s, i) => `<div class="r-barra"><span class="r-barra-val">${kmTxt(s.km)}</span><div class="r-barra-pista"><div style="height:${(s.km / max) * 100}%"></div></div><small>${i === 3 ? 'Últ. 7 d' : fechaCorta(parse(s.desde))}</small></div>`).join('');
  const ratio = r.ratio == null
    ? `<small>Necesita 4 semanas de registros (llevas ${r.historialDias} ${r.historialDias === 1 ? 'día' : 'días'}).</small>`
    : `<b>${r.ratio.toFixed(2).replace('.', ',')}</b><small>${r.ratio > 1.5 ? 'Subida brusca de carga: vigila molestias y sueño.' : r.ratio < 0.8 ? 'Carga por debajo de lo habitual.' : 'Carga estable respecto a tu media.'}</small>`;
  return `
    <div class="cabecera-acc"><button type="button" class="btn-mas" data-a="nuevo" aria-label="Registrar sesión">${icono('mas', 24)}</button></div>
    <div class="tit-lista">Km de carrera · últimas 4 semanas</div>
    <div class="lista r-barras">${barras}</div>
    <div class="r-metricas">
      <div class="r-metrica"><span>Carga 7 días</span><b>${Math.round(r.aguda)}</b><small>min × RPE</small></div>
      <div class="r-metrica"><span>Media 28 días</span><b>${Math.round(r.cronica)}</b><small>por semana</small></div>
      <div class="r-metrica"><span>Aguda : crónica</span>${ratio}</div>
      <div class="r-metrica"><span>Monotonía</span>${r.monotonia == null ? '<small>Sin datos</small>' : `<b>${r.monotonia.toFixed(1).replace('.', ',')}</b><small>${r.monotonia > 2 ? 'Días muy parecidos: alterna duros y fáciles.' : 'Variación adecuada.'}</small>`}</div>
    </div>
    <div class="tit-lista">Molestias · máximo de los últimos 7 días</div>
    <div class="lista">${molestias.map(([n, v]) => `<div class="campo"><span class="et">${n}</span><span class="r-dolor n${v == null ? 'x' : v <= 2 ? 'v' : v <= 5 ? 'a' : 'r'}">${v == null ? '—' : `${v}/10`}</span></div>`).join('')}</div>
    <p class="pie">Ninguna métrica predice lesiones por sí sola. La relación aguda:crónica y la monotonía solo indican cambios bruscos o semanas sin contraste; se leen junto con las molestias, el sueño y las sensaciones.</p>

    <div class="tit-lista">Sesiones</div>
    ${regs.length ? `<div class="tarjeta">${regs.map((x) => {
      const rit = ritmoMedio(x);
      const meta = [fechaTxt(x.fecha), x.minutos ? `${x.minutos} min` : '', x.km ? `${kmTxt(Number(x.km))} km` : '', rit && esCarrera(x.tipo) ? `${formatoRitmo(rit)}/km` : '', x.fc ? `${x.fc} ppm` : '', x.rpe !== '' && x.rpe != null ? `RPE ${x.rpe}` : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="item" data-reg="${esc(x.id)}"><span class="insignia r-tipo tipo-${esc(x.tipo)}" style="--tam:36px">${icono(esCarrera(x.tipo) ? 'running' : 'pulso', 20)}</span>
        <span class="item-txt"><span class="item-tit">${esc(x.titulo || nombreTipo(x.tipo))}</span><span class="item-meta">${esc(meta)}</span></span>${icono('chevron', 16, 'chev')}</button>`;
    }).join('')}</div>` : `<div class="vacio">${icono('running', 40)}<p>Aún no has registrado sesiones. Pulsa + después de entrenar: lo importante es el RPE, el sueño y las molestias. Ritmos y FC ya los leo de Strava.</p></div>`}
    <div class="lista r-margen"><button type="button" class="boton-fila" data-a="copiar-resumen">${icono('subir', 22)}Copiar resumen para el entrenador</button></div>
    <p class="pie">Pega el resumen en el chat con Claude cuando quieras la revisión semanal.</p>`;
}

function formRegistro(r) {
  const opt = (lista, v) => lista.map(([k, n]) => `<option value="${k}"${String(v) === String(k) ? ' selected' : ''}>${n}</option>`).join('');
  const escala = (min, max) => [['', '—'], ...Array.from({ length: max - min + 1 }, (_, i) => [String(min + i), String(min + i)])];
  const num = (name, label, v, extra = '') => `<div class="campo"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="number" inputmode="decimal" value="${esc(v ?? '')}" ${extra}></div>`;
  return `
    <div class="lista">
      <div class="campo"><label for="f-fecha">Fecha</label><input id="f-fecha" name="fecha" type="date" value="${esc(r.fecha)}"></div>
      <div class="campo"><label for="f-tipo">Tipo</label><select id="f-tipo" name="tipo">${opt(TIPOS, r.tipo)}</select></div>
      <div class="campo col"><span class="et">Título o sesión</span><input type="text" name="titulo" value="${esc(r.titulo || '')}" placeholder="p. ej. 4 × 6 min umbral"></div>
    </div>
    <div class="tit-lista">Datos</div>
    <div class="lista">
      ${num('minutos', 'Duración (min)', r.minutos, 'min="0" step="1"')}
      ${num('km', 'Distancia (km)', r.km, 'min="0" step="0.01"')}
      ${num('fc', 'FC media (ppm)', r.fc, 'min="40" max="230" step="1"')}
      <div class="campo"><label for="f-rpe">Esfuerzo (RPE 0-10)</label><select id="f-rpe" name="rpe">${opt(escala(0, 10), r.rpe)}</select></div>
    </div>
    <div class="tit-lista">Recuperación</div>
    <div class="lista">
      ${num('sueno', 'Sueño anoche (h)', r.sueno, 'min="0" max="14" step="0.5"')}
      <div class="campo"><label for="f-calidad">Calidad del sueño (1-5)</label><select id="f-calidad" name="calidad">${opt(escala(1, 5), r.calidad)}</select></div>
      ${MOLESTIAS.map(([k, n]) => `<div class="campo"><label for="f-${k}">${n} (0-10)</label><select id="f-${k}" name="${k}">${opt(escala(0, 10), r[k])}</select></div>`).join('')}
    </div>
    <div class="lista r-margen"><div class="campo col"><span class="et">Notas: sensaciones, calor, viento, qué salió bien o mal</span><textarea name="notas" rows="4">${esc(r.notas || '')}</textarea></div></div>
    ${r.existe ? '<div class="lista r-margen"><button type="button" class="boton-fila peligro" data-borrar-reg>' + icono('papelera', 22) + 'Eliminar registro</button></div>' : ''}`;
}

function abrirRegistro(r, sesionId) {
  const existe = rs.registros().some((x) => x.id === r.id);
  abrirHoja({
    titulo: existe ? 'Editar sesión' : 'Registrar sesión',
    html: formRegistro({ ...r, existe }),
    onMostrar: (h, cerrar) => {
      const b = h.querySelector('[data-borrar-reg]');
      if (b) b.addEventListener('click', async () => {
        if (!(await confirmar({ titulo: '¿Eliminar este registro?', ok: 'Eliminar', peligro: true }))) return;
        rs.eliminarRegistro(r.id);
        cerrar();
        render();
        mostrarToast('Registro eliminado');
      });
    },
    onGuardar: (h) => {
      const v = (n) => h.querySelector(`[name=${n}]`).value.trim();
      if (!v('fecha')) { h.querySelector('[name=fecha]').closest('.campo').classList.add('error'); return false; }
      const nuevo = { id: r.id, fecha: v('fecha'), tipo: v('tipo'), titulo: v('titulo'), notas: v('notas') };
      for (const k of ['minutos', 'km', 'fc', 'rpe', 'sueno', 'calidad', ...MOLESTIAS.map((m) => m[0])]) {
        const x = v(k).replace(',', '.');
        if (x !== '' && !Number.isNaN(Number(x))) nuevo[k] = Number(x);
      }
      rs.guardarRegistro(nuevo);
      if (sesionId) rs.marcarSesion(sesionId, nuevo.id);
      render();
      mostrarToast(existe ? 'Registro actualizado' : 'Sesión registrada');
      return true;
    },
  });
}

function textoResumen() {
  const regs = rs.registros();
  const r = resumenCarga(regs);
  const desde = iso(addDays(new Date(), -13));
  const recientes = regs.filter((x) => x.fecha >= desde).reverse();
  const lineas = [`RESUMEN RUNNING · ${fechaLarga(new Date())}`, '', 'Km por semana (últimas 4): ' + r.semanas.map((s) => kmTxt(s.km)).join(' · ')];
  lineas.push(`Carga 7 d: ${Math.round(r.aguda)} · media semanal 28 d: ${Math.round(r.cronica)}${r.ratio != null ? ` · A:C ${r.ratio.toFixed(2)}` : ''}`);
  lineas.push('', 'Sesiones de los últimos 14 días:');
  if (!recientes.length) lineas.push('(ninguna registrada)');
  for (const x of recientes) {
    const rit = ritmoMedio(x);
    const partes = [fechaTxt(x.fecha), x.titulo || nombreTipo(x.tipo), x.minutos ? `${x.minutos} min` : '', x.km ? `${x.km} km` : '', rit && esCarrera(x.tipo) ? `${formatoRitmo(rit)}/km` : '', x.fc ? `FC ${x.fc}` : '', x.rpe != null ? `RPE ${x.rpe}` : '', x.sueno ? `sueño ${x.sueno} h${x.calidad ? ` (${x.calidad}/5)` : ''}` : ''];
    const dolor = MOLESTIAS.filter(([k]) => x[k] != null).map(([k, n]) => `${n} ${x[k]}/10`).join(', ');
    lineas.push(`- ${partes.filter(Boolean).join(' · ')}${dolor ? ` · molestias: ${dolor}` : ''}${cargaSesion(x) ? ` · carga ${cargaSesion(x)}` : ''}`);
    if (x.notas) lineas.push(`  ${x.notas}`);
  }
  return lineas.join('\n');
}

// --- ZONAS --------------------------------------------------------------------------------------
function htmlZonas(c, z) {
  const d = z.datos;
  const fc = z.fc ? `<div class="tarjeta r-tabla">${z.fc.map((x) => `<div class="r-zona"><span class="r-zid">${x.id}</span><div><b>${esc(x.nombre)}</b><small>${esc(x.uso)}</small></div><span class="r-zval">${!x.min ? `&lt; ${x.max + 1}` : x.max == null ? `≥ ${x.min}` : `${x.min}–${x.max}`}</span></div>`).join('')}</div>` : '<p class="pie">Introduce tu FC de umbral.</p>';
  const ritmo = z.ritmo ? `<div class="tarjeta r-tabla">${z.ritmo.zonas.map((x) => `<div class="r-zona"><span class="r-zid">${x.id}</span><div><b>${esc(x.nombre)}</b><small>${esc(x.uso)}</small></div><span class="r-zval">${formatoRitmo(x.desde)}–${formatoRitmo(x.hasta)}</span></div>`).join('')}</div>` : '<p class="pie">Introduce una marca válida (mm:ss).</p>';
  return `
    <div class="r-tarjeta ambar"><div class="r-sobre">${icono('info', 15)} Zonas provisionales</div>
      <p>Salen de marcas y de una FC de umbral sin validar. Si llevas semanas sin correr, los ritmos de calidad estarán por encima de tu forma actual. Se recalculan tras un test o una carrera.</p></div>
    <div class="tit-lista">Datos de referencia</div>
    <div class="lista">
      <div class="campo"><label for="z-dist">Marca de referencia</label>
        <select id="z-dist" data-zona="distancia">${[[5000, '5K'], [10000, '10K'], [21097, 'Media maratón']].map(([k, n]) => `<option value="${k}"${Number(d.distancia) === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="campo"><label for="z-marca">Tiempo (mm:ss)</label><input id="z-marca" class="r-input" type="text" inputmode="numeric" data-zona="marca" value="${esc(d.marca || '')}" placeholder="41:00"></div>
      <div class="campo"><label for="z-umbral">FC de umbral (ppm)</label><input id="z-umbral" class="r-input" type="number" inputmode="numeric" data-zona="fcUmbral" value="${esc(d.fcUmbral || '')}"></div>
      <div class="campo"><label for="z-max">FC máxima (ppm)</label><input id="z-max" class="r-input" type="number" inputmode="numeric" data-zona="fcMax" value="${esc(d.fcMax || '')}"></div>
    </div>
    ${z.ritmo ? `<p class="pie">VDOT estimado: <b>${z.ritmo.vdot.toFixed(1).replace('.', ',')}</b> (fórmula de Daniels). Es una referencia de rendimiento en carrera, no tu VO2max de laboratorio.</p>` : ''}

    <div class="tit-lista">Zonas de ritmo (min/km)</div>${ritmo}
    <div class="tit-lista">Zonas de frecuencia cardíaca (ppm)</div>${fc}
    <p class="pie">Ritmo y FC no son intercambiables: la FC sube con el calor, la deshidratación y la fatiga, y tarda en responder en esfuerzos cortos.</p>

    <div class="tit-lista">Cuándo guiarte por qué</div>
    <div class="lista r-texto">${((c.guia && c.guia.guiarse) || []).map((g) => `<div class="r-par"><b>${esc(g.sesion)}</b><p>${esc(g.como)}</p></div>`).join('')}</div>
    <div class="lista r-margen"><button type="button" class="boton-fila" data-a="zonas-defecto">${icono('reiniciar', 22)}Volver a los valores del entrenador</button></div>`;
}

// --- AUDITORÍA ----------------------------------------------------------------------------------
function contarRespuestas(c) {
  const ids = (c.auditoria || []).flatMap((b) => b.preguntas.map((p) => p.id));
  return { total: ids.length, hechas: ids.filter((id) => rs.respuesta(id).trim()).length };
}

function htmlAuditoria(c) {
  const n = contarRespuestas(c);
  return `
    <div class="r-tarjeta"><p>Responde por bloques y en orden: el primero es el que condiciona el plan. Puedes contestar en notas cortas. Las respuestas se guardan en este iPhone; cuando termines un bloque, cópialas y pégalas en el chat.</p>
      <div class="r-progreso"><div style="width:${n.total ? (n.hechas / n.total) * 100 : 0}%"></div></div><small class="r-progreso-txt">${n.hechas} de ${n.total} respondidas</small></div>
    ${(c.auditoria || []).map((b) => `
      <div class="tit-lista">${esc(b.titulo)}</div>
      <p class="pie r-porque">${esc(b.porque)}</p>
      <div class="lista r-preguntas">${b.preguntas.map((p) => `
        <div class="campo col${rs.respuesta(p.id).trim() ? ' respondida' : ''}">
          <label class="et r-pregunta" for="q-${esc(p.id)}"><b>${esc(p.texto)}</b><small>${esc(p.ayuda)}</small></label>
          <textarea id="q-${esc(p.id)}" data-pregunta="${esc(p.id)}" rows="3" placeholder="Tu respuesta…">${esc(rs.respuesta(p.id))}</textarea>
        </div>`).join('')}</div>`).join('')}
    <div class="lista r-margen"><button type="button" class="boton-fila" data-a="copiar-auditoria">${icono('subir', 22)}Copiar respuestas para el entrenador</button></div>
    <p class="pie">No hace falta responderlo todo de una vez. Con el bloque 1 ya puedo darte el diagnóstico y las primeras semanas.</p>`;
}

function textoAuditoria(c) {
  const lineas = ['AUDITORÍA INICIAL · RESPUESTAS', ''];
  for (const b of c.auditoria || []) {
    const resp = b.preguntas.filter((p) => rs.respuesta(p.id).trim());
    if (!resp.length) continue;
    lineas.push(b.titulo.toUpperCase());
    for (const p of resp) lineas.push(`- ${p.texto}`, `  ${rs.respuesta(p.id).trim().replace(/\n/g, '\n  ')}`);
    lineas.push('');
  }
  return lineas.join('\n').trim();
}

// --- GUÍA ---------------------------------------------------------------------------------------
function htmlGuia(c, ritmo) {
  const g = c.guia || {};
  const semaforo = (g.semaforo || []).map((s) => `<div class="r-semaforo ${s.nivel}"><b>${esc(s.titulo)}</b><ul class="r-puntos">${s.puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('') + (g.semaforoNota ? `<p class="ayuda">${esc(g.semaforoNota)}</p>` : '');
  const sesiones = (g.sesiones || []).map((s) => desplegable(`g-${s.id}`, `<span class="r-pcab"><b>${esc(s.titulo)}</b><small>${esc(nombreTipo(s.tipo))}</small></span>`, htmlDetalleSesion(s, ritmo))).join('');
  const f = g.fuerza || {};
  const fuerza = `<ul class="r-puntos">${(f.principios || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    ${(f.bloques || []).map((b) => `<h4 class="r-h4">${esc(b.titulo)}</h4><dl class="r-dl">${b.ejercicios.map(([e, d]) => `<div class="dato"><dt>${esc(e)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>`).join('')}
    <h4 class="r-h4">Adaptaciones según molestias</h4><dl class="r-dl">${(f.adaptaciones || []).map(([e, d]) => `<div class="dato"><dt>${esc(e)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>`;
  const nutri = `<dl class="r-dl">${(g.nutricion || []).map((n) => `<div class="dato"><dt>${esc(n.tema)}</dt><dd>${esc(n.texto)}<span class="r-evid">${esc(n.evidencia)}</span></dd></div>`).join('')}</dl>
    <p class="ayuda">Evidencia: «sólida» = metaanálisis o ensayos consistentes; «consenso» = posicionamientos de sociedades científicas; «hipótesis» = razonable pero sin pruebas directas en tu caso.</p>`;
  return `
    <div class="tit-lista">Semáforo de molestias</div>
    <div class="lista r-texto">${semaforo}</div>
    <div class="tit-lista">Sesiones clave para el 10K</div>
    <p class="pie r-porque">Con los ritmos de tus zonas actuales. Es la biblioteca de sesiones, no tu plan: el plan semanal decide cuáles tocan y cuándo.</p>
    <div class="tarjeta">${sesiones}</div>
    <div class="tit-lista">Fuerza y prevención</div>
    <div class="tarjeta">${desplegable('g-fuerza', '<span class="r-pcab"><b>Programa de fuerza para corredores</b><small>2 sesiones por semana</small></span>', fuerza)}</div>
    <div class="tit-lista">Nutrición y recuperación</div>
    <div class="tarjeta">${desplegable('g-nutri', '<span class="r-pcab"><b>Recomendaciones prácticas</b><small>Con nivel de evidencia</small></span>', nutri)}</div>`;
}

// --- Render y eventos ------------------------------------------------------------------------------
export function renderRunning(el) {
  raiz = el;
  render();
}

function render() {
  const el = raiz;
  if (!rs.disponible()) {
    el.innerHTML = `<header class="cabecera"><div><h1>Running</h1></div></header><div class="vacio"><p>No se pudo cargar el plan de running. Abre la app con conexión una vez para descargarlo.</p></div>`;
    return;
  }
  const c = rs.contenido();
  const z = zonasActuales();
  const cuerpo = {
    plan: () => htmlPlan(c, z.ritmo),
    registro: () => htmlRegistro(),
    zonas: () => htmlZonas(c, z),
    auditoria: () => htmlAuditoria(c),
    guia: () => htmlGuia(c, z.ritmo),
  }[seccion]();
  el.innerHTML = `
    <header class="cabecera vertical">
      <div class="sobre">Entrenador de 10K</div>
      <h1>Running</h1>
    </header>
    <div class="segmentado r-secciones" role="tablist">${SECCIONES.map(([id, n]) => `<button type="button" role="tab" data-seccion="${id}" aria-pressed="${seccion === id}">${n}</button>`).join('')}</div>
    <div class="r-cuerpo">${cuerpo}</div>`;
}

async function copiar(texto, que) {
  try {
    await navigator.clipboard.writeText(texto);
    mostrarToast(`${que} copiado`);
  } catch (e) {
    abrirHoja({
      titulo: 'Copiar',
      guardar: 'Hecho',
      html: `<div class="lista"><div class="campo col"><span class="et">Mantén pulsado para seleccionar y copiar</span><textarea rows="14" readonly>${esc(texto)}</textarea></div></div>`,
      onMostrar: (h) => { const t = h.querySelector('textarea'); t.focus(); t.select(); },
    });
  }
}

export function eventosRunning(el) {
  let temporizador = null;
  el.addEventListener('input', (e) => {
    if (el.dataset.vista !== 'running') return;
    const t = e.target;
    if (t.dataset.pregunta) {
      clearTimeout(temporizador);
      const id = t.dataset.pregunta, valor = t.value;
      temporizador = setTimeout(() => rs.responder(id, valor), 300);
      t.closest('.campo').classList.toggle('respondida', Boolean(valor.trim()));
      const total = el.querySelectorAll('[data-pregunta]').length;
      const hechas = el.querySelectorAll('.respondida [data-pregunta]').length;
      el.querySelector('.r-progreso div').style.width = `${(hechas / total) * 100}%`;
      el.querySelector('.r-progreso-txt').textContent = `${hechas} de ${total} respondidas`;
    }
  });
  el.addEventListener('change', (e) => {
    if (el.dataset.vista !== 'running') return;
    const t = e.target;
    if (t.dataset.pregunta) {
      clearTimeout(temporizador);
      rs.responder(t.dataset.pregunta, t.value);
    } else if (t.dataset.zona) {
      const k = t.dataset.zona;
      if (k === 'marca' && t.value.trim() && !leerTiempo(t.value)) { t.closest('.campo').classList.add('error'); return; }
      rs.cambiarZonas({ [k]: k === 'marca' ? t.value.trim() : (t.value === '' ? '' : Number(t.value)) });
      render();
    }
  });
  el.addEventListener('click', async (e) => {
    if (el.dataset.vista !== 'running') return;
    const sec = e.target.closest('[data-seccion]');
    if (sec) { seccion = sec.dataset.seccion; render(); window.scrollTo(0, 0); return; }
    const ir = e.target.closest('[data-ir]');
    if (ir) { seccion = ir.dataset.ir; render(); window.scrollTo(0, 0); return; }
    const sem = e.target.closest('[data-semana]');
    if (sem) { semanaIdx += Number(sem.dataset.semana); render(); return; }

    const plegable = e.target.closest('.r-plegable-cab');
    if (plegable) {
      const caja = plegable.parentElement;
      const id = caja.dataset.plegable;
      const ab = !abiertas.has(id);
      ab ? abiertas.add(id) : abiertas.delete(id);
      caja.classList.toggle('abierta', ab);
      plegable.setAttribute('aria-expanded', String(ab));
      return;
    }

    const reg = e.target.closest('[data-registrar]');
    if (reg) {
      const id = reg.dataset.registrar;
      const existente = rs.registroDeSesion(id);
      if (existente) return abrirRegistro(existente, id);
      const s = buscarSesion(id);
      return abrirRegistro({ id: idNuevo('run'), fecha: s ? s.fecha : iso(new Date()), tipo: s && s.tipo !== 'fuerza' ? s.tipo : 'gimnasio', titulo: s ? s.titulo : '', minutos: s && s.duracion, km: s && s.km }, id);
    }

    const fila = e.target.closest('.r-sesion');
    if (fila) {
      const id = fila.dataset.sesion;
      if (e.target.closest('.check')) {
        if (!fila.querySelector('button.check')) return;
        const hecha = !rs.sesionHecha(id);
        rs.marcarSesion(id, hecha ? (rs.registroDeSesion(id) ? rs.registroDeSesion(id).id : true) : null);
        fila.classList.toggle('hecha', hecha);
        fila.querySelector('.check').setAttribute('aria-checked', String(hecha));
        if (hecha) {
          fila.classList.add('acaba-de');
          setTimeout(() => fila.classList.remove('acaba-de'), 900);
          mostrarToast('Sesión hecha', 'Registrar', () => fila.querySelector('[data-registrar]') && fila.querySelector('[data-registrar]').click());
        }
        return;
      }
      if (e.target.closest('.fila-cuerpo') && !e.target.closest('button')) {
        const ab = !abiertas.has(id);
        ab ? abiertas.add(id) : abiertas.delete(id);
        fila.classList.toggle('abierta', ab);
        fila.querySelector('.fila-cuerpo').setAttribute('aria-expanded', String(ab));
      }
      return;
    }

    const item = e.target.closest('[data-reg]');
    if (item) {
      const r = rs.registros().find((x) => x.id === item.dataset.reg);
      if (r) abrirRegistro(r);
      return;
    }

    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'nuevo') abrirRegistro({ id: idNuevo('run'), fecha: iso(new Date()), tipo: 'rodaje' });
    else if (a === 'copiar-resumen') copiar(textoResumen(), 'Resumen');
    else if (a === 'copiar-auditoria') {
      const txt = textoAuditoria(rs.contenido());
      if (!txt.includes('\n- ')) { await confirmar({ titulo: 'Aún no hay respuestas', texto: 'Escribe al menos una respuesta del bloque 1.', ok: 'Entendido', cancelar: '' }); return; }
      copiar(txt, 'Respuestas');
    } else if (a === 'zonas-defecto') {
      rs.restablecerZonas();
      render();
      mostrarToast('Zonas restablecidas');
    }
  });
}

function buscarSesion(id) {
  for (const s of (rs.contenido().plan.semanas || [])) {
    for (const d of s.dias || []) {
      const x = (d.sesiones || []).find((y) => y.id === id);
      if (x) return { ...x, fecha: d.fecha };
    }
  }
  return null;
}
