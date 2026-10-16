// Arranque de la app y navegación por pestañas.
import * as store from './store.js';
import { iso } from './schedule.js';
import { icono } from './icons.js';
import { ocultarToast } from './ui.js';
import { renderHoy, eventosHoy, diaActual } from './vistas/hoy.js';
import { renderSemana, eventosSemana, reiniciarSemana } from './vistas/semana.js';
import { renderTareas, eventosTareas } from './vistas/tareas.js';
import { renderAjustes, eventosAjustes } from './vistas/ajustes.js';
import { renderRunning, eventosRunning } from './vistas/running.js';
import * as running from './running-store.js';

const PESTANAS = [
  ['hoy', 'Hoy', renderHoy],
  ['semana', 'Semana', renderSemana],
  ['tareas', 'Tareas', renderTareas],
  ['running', 'Running', renderRunning],
  ['ajustes', 'Ajustes', renderAjustes],
];
const scrolls = {};
let actual = 'hoy';
let vista;

function mostrar(id, { restaurar = false } = {}) {
  scrolls[actual] = window.scrollY;
  actual = id;
  vista.dataset.vista = id;
  ocultarToast();
  if (id === 'semana' && !restaurar) reiniciarSemana();
  const [, , render] = PESTANAS.find((p) => p[0] === id);
  render(vista);
  vista.setAttribute('aria-label', PESTANAS.find((p) => p[0] === id)[1]);
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-current', t.dataset.tab === id ? 'page' : 'false'));
  if (id !== 'semana') window.scrollTo(0, 0);
}

function construirShell() {
  document.getElementById('raiz').innerHTML = `
    <div class="barra-estado"></div>
    <main class="vista" id="vista"></main>
    <nav class="tabbar" aria-label="Secciones">
      ${PESTANAS.map(([id, nombre]) => `<button type="button" class="tab" data-tab="${id}" aria-current="${id === 'hoy' ? 'page' : 'false'}">${icono(id, 26)}<span>${nombre}</span></button>`).join('')}
    </nav>`;
  vista = document.getElementById('vista');
  document.querySelector('.tabbar').addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    if (t.dataset.tab === actual) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (actual === 'semana') reiniciarSemana(), renderSemana(vista);
      return;
    }
    mostrar(t.dataset.tab);
  });
  eventosHoy(vista);
  eventosSemana(vista);
  eventosTareas(vista);
  eventosAjustes(vista);
  eventosRunning(vista);
}

async function cargarRutina() {
  const r = await fetch('data/rutina.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('No se pudo cargar la rutina');
  return r.json();
}

// El plan de running es opcional: si falla, el resto de la app funciona igual.
async function cargarRunning() {
  try {
    const r = await fetch('data/running.json', { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch (e) {
    return null;
  }
}

// Si la app queda abierta y cambia el día, vuelve a pintar Hoy.
function vigilarCambioDeDia() {
  const revisar = () => {
    if (actual === 'hoy' && diaActual() && diaActual() !== iso(new Date())) renderHoy(vista);
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisar(); });
  window.addEventListener('focus', revisar);
  setInterval(revisar, 60000);
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const tenia = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register('sw.js').catch(() => {});
  let recargado = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tenia || recargado) return; // primera instalación: no hace falta recargar
    recargado = true;
    location.reload();
  });
}

async function iniciar() {
  try {
    const [rutina, plan] = await Promise.all([cargarRutina(), cargarRunning()]);
    await store.iniciar(rutina);
    running.iniciar(plan);
    construirShell();
    mostrar('hoy');
    vigilarCambioDeDia();
    registrarServiceWorker();
  } catch (e) {
    document.getElementById('raiz').innerHTML = `<main class="vista"><div class="vacio"><p>No se pudo abrir la app.</p><p style="margin-top:8px;font-size:14px">${String(e.message || e)}</p></div></main>`;
  }
}

iniciar();
