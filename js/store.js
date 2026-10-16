// Estado de la app: se guarda solo en el propio dispositivo (localStorage).
// La rutina base viene de data/rutina.json; aquí solo se guardan las diferencias del usuario
// (ediciones, tareas nuevas, tareas eliminadas), el progreso y los ajustes.

import { iso, lunesDe, addDays } from './schedule.js';
import * as running from './running-store.js';

const CLAVE = 'rutina-hogar:v1';
const listeners = new Set();

let base = null; // rutina.json
let estado = null;
let memoria = null; // por si localStorage no está disponible

const nuevoEstado = () => ({
  v: 1,
  ajustes: {
    camaBaja: false,
    semanaAuto: true,
    semanaAncla: { lunes: iso(lunesDe(new Date())), tipo: 'A' },
    inicio: iso(new Date()),
  },
  hechas: {},
  ediciones: {},
  eliminadas: [],
  nuevas: [],
  colNuevas: [],
});

function leer() {
  try {
    const txt = localStorage.getItem(CLAVE);
    if (txt) return JSON.parse(txt);
  } catch (e) { /* almacenamiento bloqueado */ }
  return memoria;
}

function normalizar(e) {
  const n = nuevoEstado();
  const r = { ...n, ...e, ajustes: { ...n.ajustes, ...(e.ajustes || {}) } };
  r.ajustes.semanaAncla = { ...n.ajustes.semanaAncla, ...(r.ajustes.semanaAncla || {}) };
  for (const k of ['hechas', 'ediciones']) if (!r[k] || typeof r[k] !== 'object') r[k] = {};
  for (const k of ['eliminadas', 'nuevas', 'colNuevas']) if (!Array.isArray(r[k])) r[k] = [];
  return r;
}

// Quita marcas muy antiguas para que el almacenamiento no crezca sin fin.
function podar(e) {
  const limite = iso(addDays(new Date(), -800));
  for (const [k, v] of Object.entries(e.hechas)) if (typeof v !== 'string' || v < limite) delete e.hechas[k];
}

export async function iniciar(rutina) {
  base = rutina;
  const guardado = leer();
  estado = normalizar(guardado || {});
  podar(estado);
  guardar(false);
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) { /* no pasa nada */ }
}

function guardar(avisar = true) {
  memoria = estado;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch (e) { /* sin espacio o bloqueado: seguimos en memoria */ }
  if (avisar) listeners.forEach((f) => f());
}

export const suscribir = (f) => { listeners.add(f); return () => listeners.delete(f); };

export const ajustes = () => estado.ajustes;
export const categorias = () => base.categorias;

export function cambiarAjustes(parcial) {
  estado.ajustes = { ...estado.ajustes, ...parcial };
  guardar();
}

// --- Modelo efectivo: base + ediciones del usuario -------------------------------------------
export function modelo() {
  const eliminadas = new Set(estado.eliminadas);
  const aplicar = (t) => (estado.ediciones[t.id] ? { ...estado.ediciones[t.id], id: t.id } : t);
  const tareas = base.tareas.filter((t) => !eliminadas.has(t.id)).map(aplicar).concat(estado.nuevas);
  const coladas = base.coladas.filter((c) => !eliminadas.has(c.id)).map(aplicar).concat(estado.colNuevas);
  return { tareas, coladas };
}

export function guardarTarea(t) {
  const esColada = 'dia' in t && !('frecuencia' in t);
  const listaNuevas = esColada ? estado.colNuevas : estado.nuevas;
  const idx = listaNuevas.findIndex((x) => x.id === t.id);
  if (idx >= 0) listaNuevas[idx] = t;
  else if (base.tareas.some((x) => x.id === t.id) || base.coladas.some((x) => x.id === t.id)) estado.ediciones[t.id] = t;
  else listaNuevas.push(t);
  guardar();
}

export function eliminarTarea(id) {
  for (const k of ['nuevas', 'colNuevas']) estado[k] = estado[k].filter((x) => x.id !== id);
  delete estado.ediciones[id];
  if (base.tareas.some((x) => x.id === id) || base.coladas.some((x) => x.id === id)) {
    if (!estado.eliminadas.includes(id)) estado.eliminadas.push(id);
  }
  guardar();
}

export const idNuevo = (prefijo) => `${prefijo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// --- Progreso -----------------------------------------------------------------------------------
export const estaHecha = (clave) => Boolean(estado.hechas[clave]);
export const fechaHecha = (clave) => estado.hechas[clave] || null;

export function marcar(clave, fecha = iso(new Date()), avisar = false) {
  estado.hechas[clave] = fecha;
  guardar(avisar);
}
export function desmarcar(clave, avisar = false) {
  delete estado.hechas[clave];
  guardar(avisar);
}

// --- Copia de seguridad y restablecer --------------------------------------------------------------
export function exportar() {
  return JSON.stringify({ app: 'rutina-hogar', exportado: new Date().toISOString(), datos: estado, running: running.exportar() }, null, 2);
}

export function importar(texto) {
  const obj = JSON.parse(texto);
  if (!obj || obj.app !== 'rutina-hogar' || !obj.datos || obj.datos.v !== 1) throw new Error('El archivo no es una copia de esta app.');
  estado = normalizar(obj.datos);
  podar(estado);
  guardar();
  if (obj.running) running.importar(obj.running);
}

export function restablecerTareas() {
  estado.ediciones = {};
  estado.eliminadas = [];
  estado.nuevas = [];
  estado.colNuevas = [];
  guardar();
}

export function borrarTodo() {
  estado = nuevoEstado();
  guardar();
}
