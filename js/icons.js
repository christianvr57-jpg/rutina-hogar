// Iconos de trazo (24×24), al estilo de los símbolos de iOS.
const TRAZOS = {
  hoy: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  semana: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01"/>',
  tareas: '<path d="M10 6.5h10.5M10 12h10.5M10 17.5h10.5M3.5 6.6l1.4 1.4 2.6-2.8M3.5 12.1l1.4 1.4 2.6-2.8M3.5 17.6l1.4 1.4 2.6-2.8"/>',
  running: '<circle cx="15.5" cy="4.6" r="1.9"/><path d="M5 11.2l3.4-3 4.3.4 3 3.6 3.3 1.1M12.7 8.6 10.4 14l3.6 2.6-1.2 4.9M10.4 14l-2.2 3.3-4.2.6"/>',
  ajustes: '<path d="M3.5 7h9M17 7h3.5M3.5 17H8M12.5 17h8"/><circle cx="14.8" cy="7" r="2.3"/><circle cx="10.2" cy="17" r="2.3"/>',

  ropa: '<path d="M8.2 3.5 3 6.3l1.9 4 2.6-1.1v11.3h9V9.2l2.6 1.1 1.9-4-5.2-2.8c-.5 1.6-1.9 2.5-3.8 2.5s-3.3-.9-3.8-2.5z"/>',
  cocina: '<path d="M4 11.5h16v5a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5zM2.5 11.5h19M9 7.8c0-1.6 1.2-1.6 1.2-3.2M14 7.8c0-1.6 1.2-1.6 1.2-3.2"/>',
  bano: '<path d="M12 3.2s6 6.3 6 10.6a6 6 0 0 1-12 0c0-4.3 6-10.6 6-10.6z"/><path d="M9.3 14.3a2.8 2.8 0 0 0 2 2.4"/>',
  suelos: '<path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  bebe: '<circle cx="12" cy="12.5" r="8.5"/><path d="M9 11.4v.4M15 11.4v.4M8.8 15.2c.9 1.3 2 1.9 3.2 1.9s2.3-.6 3.2-1.9M12 4c-.2 1.5.8 2.3 2 2.2"/>',
  casa: '<path d="M3.5 11.2 12 3.8l8.5 7.4M5.5 9.8v10.7h13V9.8M10 20.5v-5.8h4v5.8"/>',
  lavadora: '<rect x="4.5" y="3" width="15" height="18" rx="3"/><path d="M4.5 7.7h15M8 5.3h.01M11 5.3h.01"/><circle cx="12" cy="14.2" r="4"/><path d="M9.8 14.6c1-.9 1.6.9 2.6 0s1-.9 1.8-.3"/>',

  manana: '<path d="M12 4v3M5.6 8.4l1.8 1.8M18.4 8.4l-1.8 1.8M2.8 16.5h18.4M7 16.5a5 5 0 0 1 10 0M8 20h8"/>',
  dia: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  fija: '<path d="M8.5 3.5h7l-1.2 6 3.2 3.2H6.5l3.2-3.2zM12 12.7v7.8"/>',
  noche: '<path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/>',
  periodicas: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15.2l2 2 4-4.2"/>',

  check: '<path d="M5.5 12.6l4.2 4.2L18.5 7.6"/>',
  chevron: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  chevronIzq: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  chevronAbajo: '<path d="M5.5 9.5 12 16l6.5-6.5"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  papelera: '<path d="M4 7h16M9.5 7V4.5h5V7M6.2 7l.9 13h9.8l.9-13M10 11v6M14 11v6"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.3V12l3 2"/>',
  descargar: '<path d="M12 3.5v11M7.5 10.3 12 14.8l4.5-4.5M5 20h14"/>',
  subir: '<path d="M12 14.8v-11M7.5 8 12 3.5 16.5 8M5 20h14"/>',
  reiniciar: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4.5v4.6h4.6"/>',
  cama: '<path d="M3 18.5v-11M3 14h18v4.5M21 14v-2.7a2.3 2.3 0 0 0-2.3-2.3H11v5"/><circle cx="7" cy="11" r="1.7"/>',
  pulso: '<path d="M3 12.5h4l2.2-5 3.6 10 2.4-6.2 1.3 1.2H21"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.9h.01"/>',
};

export function icono(nombre, tam = 22, clases = '') {
  const t = TRAZOS[nombre] || '';
  return `<svg class="ico ${clases}" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`;
}
