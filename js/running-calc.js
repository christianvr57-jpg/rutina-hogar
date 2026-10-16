// Cálculos de running puros (sin DOM): ritmos, VDOT, zonas y carga de entrenamiento.
// Ritmos en segundos por km; tiempos de carrera en segundos.
import { addDays, iso, parse, diasEntre } from './schedule.js';

const pad = (n) => String(n).padStart(2, '0');

// "41:00" | "1:02:30" → segundos. Devuelve null si no es válido.
export function leerTiempo(txt) {
  const partes = String(txt ?? '').trim().split(':').map((p) => p.trim());
  if (!partes.length || partes.length > 3 || partes.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const s = partes.map(Number).reduce((acc, n) => acc * 60 + n, 0);
  return s > 0 ? s : null;
}

export function formatoTiempo(seg) {
  const s = Math.round(seg);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// Ritmo (s/km) → "4:15"
export const formatoRitmo = (spk) => formatoTiempo(spk);

// --- VDOT (Daniels y Gilbert, 1979) ------------------------------------------------------------
// Coste de oxígeno a una velocidad v (m/min) y fracción del VO2max sostenible durante t minutos.
const costeO2 = (v) => -4.6 + 0.182258 * v + 0.000104 * v * v;
const fraccionSostenible = (t) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);

export function vdot(distanciaM, tiempoSeg) {
  const t = tiempoSeg / 60;
  return costeO2(distanciaM / t) / fraccionSostenible(t);
}

// Velocidad (m/min) a la que el coste de O2 es `vo2`.
function velocidadPara(vo2) {
  const a = 0.000104, b = 0.182258, c = -4.6 - vo2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}
// Ritmo (s/km) correspondiente a un porcentaje del VDOT.
export const ritmoAPorcentaje = (vd, pct) => 60000 / velocidadPara(vd * pct);

// Tiempo equivalente en otra distancia para el mismo VDOT (búsqueda binaria).
export function tiempoEquivalente(vd, distanciaM) {
  let lo = distanciaM / 400 * 60, hi = distanciaM / 50 * 60; // entre 24 y 3,3 km/h… holgado
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (vdot(distanciaM, mid) > vd) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Zonas de ritmo a partir de una marca. Porcentajes del VDOT habituales en la metodología de Daniels.
export function zonasRitmo(distanciaM, tiempoSeg) {
  const vd = vdot(distanciaM, tiempoSeg);
  const r = (pct) => ritmoAPorcentaje(vd, pct);
  const r10k = tiempoEquivalente(vd, 10000) / 10;
  const r5k = tiempoEquivalente(vd, 5000) / 5;
  return {
    vdot: vd,
    zonas: [
      { id: 'E', nombre: 'Fácil / rodaje', desde: r(0.70), hasta: r(0.62), uso: 'Rodajes, tiradas largas y calentamientos. La mayor parte del volumen.' },
      { id: 'M', nombre: 'Ritmo maratón / aeróbico alto', desde: r(0.80), hasta: r(0.76), uso: 'Final de tiradas largas y progresivos. Con moderación.' },
      { id: 'T', nombre: 'Umbral', desde: r(0.89), hasta: r(0.86), uso: 'Tempo continuo de 20-30 min o intervalos largos (cruise intervals).' },
      { id: '10K', nombre: 'Ritmo 10K', desde: r10k - 3, hasta: r10k + 3, uso: 'Repeticiones específicas (1-3 km) en la fase de ritmo de carrera.' },
      { id: 'I', nombre: 'VO2max / intervalos', desde: r5k - 8, hasta: r5k - 2, uso: 'Repeticiones de 3-5 min con recuperación similar o algo menor.' },
      { id: 'R', nombre: 'Repeticiones / economía', desde: r5k - 18, hasta: r5k - 10, uso: 'Repeticiones de 200-400 m con recuperación completa; rectas.' },
    ],
  };
}

// Zonas de frecuencia cardíaca sobre la FC de umbral (porcentajes de Friel para carrera).
export function zonasFC(fcUmbral, fcMax) {
  const techo = (p) => Math.round(fcUmbral * p);
  const zonas = [
    { id: 'Z1', nombre: 'Recuperación', max: techo(0.84), uso: 'Regenerativos y calentamientos.' },
    { id: 'Z2', nombre: 'Aeróbico', max: techo(0.89), uso: 'Techo de los rodajes fáciles.' },
    { id: 'Z3', nombre: 'Tempo', max: techo(0.94), uso: 'Zona "gris": útil en dosis, no como rodaje habitual.' },
    { id: 'Z4', nombre: 'Subumbral – umbral', max: Math.round(fcUmbral) - 1, uso: 'Tempos e intervalos de umbral.' },
    { id: 'Z5', nombre: 'Por encima del umbral', max: fcMax || null, uso: 'Ritmo 10K al final, VO2max. La FC llega tarde: guíate por ritmo.' },
  ];
  zonas.forEach((z, i) => { z.min = i ? zonas[i - 1].max + 1 : 0; });
  return zonas;
}

// --- Carga (sRPE de Foster: minutos × RPE 0-10) ----------------------------------------------------
export const cargaSesion = (s) => (Number(s.minutos) || 0) * (Number(s.rpe) || 0);
const esCarrera = (s) => ['rodaje', 'calidad', 'tirada', 'competicion'].includes(s.tipo);

// Resumen de los últimos 28 días hasta `hasta` (incluido). registros = [{ fecha, tipo, minutos, km, rpe, ... }]
export function resumenCarga(registros, hasta = new Date()) {
  const fin = iso(hasta);
  const inicio28 = iso(addDays(hasta, -27));
  const dentro = registros.filter((r) => r.fecha >= inicio28 && r.fecha <= fin);
  const porDia = new Array(28).fill(0);
  const semanas = [0, 1, 2, 3].map((i) => ({
    desde: iso(addDays(hasta, -27 + i * 7)), hasta: iso(addDays(hasta, -21 + i * 7)), km: 0, minutosCarrera: 0, sesiones: 0, carga: 0,
  }));
  for (const r of dentro) {
    const i = 27 - diasEntre(parse(r.fecha), hasta);
    if (i < 0 || i > 27) continue;
    porDia[i] += cargaSesion(r);
    const s = semanas[Math.floor(i / 7)];
    s.carga += cargaSesion(r);
    s.sesiones += 1;
    if (esCarrera(r)) { s.km += Number(r.km) || 0; s.minutosCarrera += Number(r.minutos) || 0; }
  }
  const aguda = semanas[3].carga;
  const cronica = semanas.reduce((a, s) => a + s.carga, 0) / 4;
  const ultimos7 = porDia.slice(21);
  const media = ultimos7.reduce((a, b) => a + b, 0) / 7;
  const sd = Math.sqrt(ultimos7.reduce((a, b) => a + (b - media) ** 2, 0) / 7);
  // Con menos de 4 semanas registradas, la relación aguda:crónica no significa nada.
  const primera = registros.length ? registros.map((r) => r.fecha).sort()[0] : null;
  const historial = primera ? diasEntre(parse(primera), hasta) + 1 : 0;
  return {
    semanas,
    aguda,
    cronica,
    ratio: historial >= 28 && cronica > 0 ? aguda / cronica : null,
    monotonia: sd > 0 ? media / sd : null,
    historialDias: historial,
  };
}

// Ritmo medio de una sesión (s/km) o null.
export function ritmoMedio(r) {
  const km = Number(r.km), min = Number(r.minutos);
  return km > 0 && min > 0 ? (min * 60) / km : null;
}
