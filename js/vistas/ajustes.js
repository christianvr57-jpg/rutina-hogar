// Vista AJUSTES: semana A/B, cama baja, copia de seguridad y restablecer.
import { ajustes, cambiarAjustes, exportar, importar, restablecerTareas, borrarTodo } from '../store.js';
import { borrarTodo as borrarRunning } from '../running-store.js';
import { iso, lunesDe, addDays, tipoSemana } from '../schedule.js';
import { icono } from '../icons.js';
import { confirmar, mostrarToast, abrirHoja } from '../ui.js';

let raiz = null;
const esStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

export function renderAjustes(el) {
  raiz = el;
  const aj = ajustes();
  const hoy = new Date();
  const tipoActual = tipoSemana(hoy, aj);
  const tipoSiguiente = tipoSemana(addDays(hoy, 7), aj);
  el.innerHTML = `
    <header class="cabecera"><div><h1>Ajustes</h1></div></header>
    ${esStandalone() ? '' : `<div class="aviso-instalar">${icono('info', 22)}<div><b>Instálala en el iPhone.</b> En Safari pulsa Compartir y luego «Añadir a pantalla de inicio». Así se abre a pantalla completa y sin conexión.</div></div>`}

    <div class="tit-lista">Semana A / B</div>
    <div class="lista">
      <div class="campo"><div class="et">Alternar automáticamente<small>Cada lunes cambia entre A (sábanas) y B (blancos)</small></div>
        <label class="interruptor"><input type="checkbox" data-aj="semanaAuto"${aj.semanaAuto ? ' checked' : ''}><span></span></label></div>
      <div class="campo col"><span class="et">${aj.semanaAuto ? 'Esta semana es' : 'Semana fija'}</span>
        <div class="segmentado" data-aj-tipo>
          <button type="button" data-v="A" aria-pressed="${tipoActual === 'A'}">A · Sábanas</button>
          <button type="button" data-v="B" aria-pressed="${tipoActual === 'B'}">B · Blancos</button>
        </div></div>
    </div>
    <p class="pie">${aj.semanaAuto ? `La semana que viene será la ${tipoSiguiente}. Si no coincide con la realidad, cambia la de esta semana y el resto se ajusta solo.` : 'Con la alternancia desactivada, todas las semanas serán de este tipo.'}</p>

    <div class="tit-lista">Bebé</div>
    <div class="lista">
      <div class="campo"><div class="et">Cama baja del niño<small>Activa el aspirado del suelo de su habitación cada dos días, porque duerme a ras de suelo</small></div>
        <label class="interruptor"><input type="checkbox" data-aj="camaBaja"${aj.camaBaja ? ' checked' : ''}><span></span></label></div>
    </div>

    <div class="tit-lista">Copia de seguridad</div>
    <div class="lista">
      <button type="button" class="boton-fila" data-a="exportar">${icono('subir', 22)}Exportar copia (JSON)</button>
      <button type="button" class="boton-fila" data-a="importar">${icono('descargar', 22)}Importar copia…</button>
      <button type="button" class="boton-fila" data-a="copiar">${icono('subir', 22)}Copiar copia al portapapeles</button>
      <button type="button" class="boton-fila" data-a="pegar">${icono('descargar', 22)}Importar desde el portapapeles</button>
    </div>
    <input type="file" id="archivo" accept="application/json,.json" hidden>
    <p class="pie">Tu progreso, tus cambios y tus datos de running viven solo en este iPhone. Guarda una copia de vez en cuando, sobre todo antes de cambiar de móvil o borrar los datos de Safari.</p>

    <div class="tit-lista">Restablecer</div>
    <div class="lista">
      <button type="button" class="boton-fila" data-a="rutina">${icono('reiniciar', 22)}Restablecer tareas a la rutina original</button>
      <button type="button" class="boton-fila peligro" data-a="running">${icono('papelera', 22)}Borrar datos de running</button>
      <button type="button" class="boton-fila peligro" data-a="todo">${icono('papelera', 22)}Borrar progreso y ajustes</button>
    </div>

    <div class="version">Rutina del hogar · versión 1.1<br>Los datos se guardan en este dispositivo. Sin cuentas, sin servidor.</div>`;
}

async function exportarCopia() {
  const nombre = `rutina-hogar-${iso(new Date())}.json`;
  const texto = exportar();
  const archivo = new File([texto], nombre, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: 'Copia de Rutina del hogar' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  mostrarToast('Copia exportada');
}

async function aplicarImportacion(el, texto) {
  try {
    JSON.parse(texto);
    const ok = await confirmar({ titulo: '¿Importar esta copia?', texto: 'Sustituirá tu progreso, ajustes y cambios actuales.', ok: 'Importar', peligro: true });
    if (!ok) return;
    importar(texto);
    renderAjustes(el);
    mostrarToast('Copia importada');
  } catch (err) {
    await confirmar({ titulo: 'No se pudo importar', texto: err.message && err.message.startsWith('El archivo') ? err.message : 'El texto no es una copia válida.', ok: 'Entendido', cancelar: '' });
  }
}

function pegarManualmente(el) {
  abrirHoja({
    titulo: 'Importar copia',
    guardar: 'Importar',
    html: '<div class="lista"><div class="campo col"><span class="et">Pega aquí el contenido de la copia</span><textarea name="copia" rows="8" placeholder="{ &quot;app&quot;: &quot;rutina-hogar&quot;, … }"></textarea></div></div>',
    onGuardar: (h) => {
      const texto = h.querySelector('[name=copia]').value.trim();
      if (!texto) return false;
      setTimeout(() => aplicarImportacion(el, texto), 320);
      return true;
    },
  });
}

export function eventosAjustes(el) {
  el.addEventListener('change', async (e) => {
    if (el.dataset.vista !== 'ajustes') return;
    const t = e.target;
    if (t.dataset.aj) {
      cambiarAjustes({ [t.dataset.aj]: t.checked });
      renderAjustes(el);
    } else if (t.id === 'archivo' && t.files && t.files[0]) {
      const archivo = t.files[0];
      t.value = '';
      await aplicarImportacion(el, await archivo.text());
    }
  });
  el.addEventListener('click', async (e) => {
    if (el.dataset.vista !== 'ajustes') return;
    const seg = e.target.closest('[data-aj-tipo] button');
    if (seg) {
      const aj = ajustes();
      const tipo = seg.dataset.v;
      if (aj.semanaAuto) cambiarAjustes({ semanaAncla: { lunes: iso(lunesDe(new Date())), tipo } });
      else cambiarAjustes({ semanaAncla: { ...aj.semanaAncla, tipo } });
      renderAjustes(el);
      return;
    }
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'exportar') exportarCopia();
    else if (a === 'importar') el.querySelector('#archivo').click();
    else if (a === 'copiar') {
      try {
        await navigator.clipboard.writeText(exportar());
        mostrarToast('Copia en el portapapeles');
      } catch (err) {
        await confirmar({ titulo: 'No se pudo copiar', texto: 'Prueba con «Exportar copia».', ok: 'Entendido', cancelar: '' });
      }
    } else if (a === 'pegar') {
      let texto = '';
      try { texto = await navigator.clipboard.readText(); } catch (err) { /* sin permiso */ }
      if (texto && texto.includes('rutina-hogar')) await aplicarImportacion(el, texto);
      else pegarManualmente(el);
    }
    else if (a === 'rutina') {
      if (await confirmar({ titulo: '¿Restablecer las tareas?', texto: 'Se deshacen tus ediciones, altas y bajas. Tu progreso y ajustes se mantienen.', ok: 'Restablecer', peligro: true })) {
        restablecerTareas();
        renderAjustes(el);
        mostrarToast('Tareas restablecidas');
      }
    } else if (a === 'running') {
      if (await confirmar({ titulo: '¿Borrar los datos de running?', texto: 'Se borran tus respuestas de la auditoría, el registro de sesiones y tus zonas. El plan del entrenador se mantiene.', ok: 'Borrar', peligro: true })) {
        borrarRunning();
        mostrarToast('Datos de running borrados');
      }
    } else if (a === 'todo') {
      if (await confirmar({ titulo: '¿Borrar todo?', texto: 'Se borran el progreso, los ajustes y tus cambios en las tareas. No se puede deshacer.', ok: 'Borrar todo', peligro: true })) {
        borrarTodo();
        renderAjustes(el);
        mostrarToast('Todo restablecido');
      }
    }
  });
}
