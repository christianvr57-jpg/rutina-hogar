// Estado de la sección Running: se guarda solo en este dispositivo (localStorage), aparte de las tareas.
// El contenido del entrenador (perfil, plan, guía) viene de data/running.json; aquí van tus datos:
// respuestas de la auditoría, ajustes de zonas, registro de sesiones y sesiones del plan hechas.

const CLAVE = 'rutina-hogar:running:v1';

let base = null; // running.json
let estado = null;
let memoria = null;

const nuevoEstado = () => ({ v: 1, respuestas: {}, zonas: {}, registros: [], hechas: {} });

function normalizar(e) {
  const r = { ...nuevoEstado(), ...(e || {}) };
  for (const k of ['respuestas', 'zonas', 'hechas']) if (!r[k] || typeof r[k] !== 'object' || Array.isArray(r[k])) r[k] = {};
  if (!Array.isArray(r.registros)) r.registros = [];
  return r;
}

function leer() {
  try {
    const txt = localStorage.getItem(CLAVE);
    if (txt) return JSON.parse(txt);
  } catch (e) { /* almacenamiento bloqueado */ }
  return memoria;
}

function guardar() {
  memoria = estado;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch (e) { /* seguimos en memoria */ }
}

export function iniciar(datos) {
  base = datos;
  estado = normalizar(leer());
}

export const contenido = () => base;
export const disponible = () => Boolean(base);

// --- Auditoría ---------------------------------------------------------------------------------
export const respuesta = (id) => estado.respuestas[id] || '';
export function responder(id, valor) {
  if (valor) estado.respuestas[id] = valor;
  else delete estado.respuestas[id];
  guardar();
}

// --- Zonas: valores propios o, si no hay, los del perfil -----------------------------------------
export function datosZonas() {
  const p = (base && base.perfil && base.perfil.zonas) || {};
  return { ...p, ...estado.zonas };
}
export function cambiarZonas(parcial) {
  estado.zonas = { ...estado.zonas, ...parcial };
  for (const [k, v] of Object.entries(estado.zonas)) if (v === '' || v == null) delete estado.zonas[k];
  guardar();
}
export function restablecerZonas() {
  estado.zonas = {};
  guardar();
}

// --- Registro de sesiones ----------------------------------------------------------------------
export const registros = () => [...estado.registros].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
export function guardarRegistro(r) {
  const i = estado.registros.findIndex((x) => x.id === r.id);
  if (i >= 0) estado.registros[i] = r;
  else estado.registros.push(r);
  guardar();
}
export function eliminarRegistro(id) {
  estado.registros = estado.registros.filter((x) => x.id !== id);
  for (const [k, v] of Object.entries(estado.hechas)) if (v === id) estado.hechas[k] = true;
  guardar();
}

// --- Sesiones del plan marcadas como hechas (valor: true o id del registro asociado) ---------------
export const sesionHecha = (id) => Boolean(estado.hechas[id]);
export const registroDeSesion = (id) => estado.registros.find((r) => r.id === estado.hechas[id]) || null;
export function marcarSesion(id, valor) {
  if (valor) estado.hechas[id] = valor;
  else delete estado.hechas[id];
  guardar();
}

// --- Copia de seguridad (va dentro de la copia general de la app) --------------------------------
export const exportar = () => estado;
export function importar(datos) {
  estado = normalizar(datos);
  guardar();
}
export function borrarTodo() {
  estado = nuevoEstado();
  guardar();
}
