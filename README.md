# Rutina del hogar

App web instalable (PWA) para llevar las tareas de la casa día a día. Funciona sin conexión, sin cuentas y sin servidor: el progreso se guarda solo en el propio dispositivo.

## Estructura

| Ruta | Qué es |
|---|---|
| `data/rutina.json` | **Toda la rutina**: coladas, tareas diarias, semanales y periódicas. Se edita sin tocar el código. |
| `js/schedule.js` | Qué toca cada día (semana A/B, periodicidad, caducidad de lo no hecho). |
| `js/planner.js` | Reparto de las tareas periódicas por semanas y días. |
| `js/store.js` | Estado local (`localStorage`), ediciones del usuario, copia de seguridad. |
| `js/vistas/` | Hoy, Semana, Tareas, Running y Ajustes. |
| `data/running.json` | **Contenido del entrenador de running**: perfil, diagnóstico, auditoría, plan semanal y guía (sesiones, fuerza, nutrición). |
| `js/running-calc.js` | Ritmos, VDOT, zonas de ritmo y FC, carga (sRPE, aguda:crónica, monotonía). |
| `js/running-store.js` | Datos de running del usuario: respuestas, zonas propias, registro de sesiones. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Sin conexión e instalación en la pantalla de inicio. |
| `tools/` | Utilidades: servidor local, reparto de periódicas, generador de iconos. |
| `test/` | Comprobaciones de la lógica de calendario. |

## Desarrollo

```bash
node tools/servir.mjs          # http://localhost:8123 (sin caché)
node test/repartir.test.mjs    # informe y comprobaciones del calendario
node test/running.test.mjs     # cálculos de running y estructura de data/running.json
node tools/repartir.mjs        # recalcula el "plan" de las tareas periódicas
```

### Cambiar la rutina

Edita `data/rutina.json`. Cada tarea tiene `frecuencia` (`diaria`, `semanal`, `mensual`, `trimestral`, `semestral`, `anual`), `momento` (`manana`, `dia`, `fija`, `noche`), `categoria`, `minutos` y, si procede, `dias` (1 = lunes … 7 = domingo) o `plan` (`mes`, `semana`, `dia`). Para una tarea periódica nueva, déjala sin `plan` y ejecuta `node tools/repartir.mjs --solo-nuevas`.

### Plan de running

Cada semana se añade un objeto a `plan.semanas` de `data/running.json`:

```json
{ "id": "2026-W44", "lunes": "2026-10-26", "fase": "Base aeróbica · semana 1",
  "diagnostico": "…", "objetivo": "…", "porque": "…", "observar": ["…"], "modificar": ["…"],
  "dias": [{ "fecha": "2026-10-27", "sesiones": [{ "id": "2026-10-27-a", "tipo": "rodaje", "titulo": "Rodaje fácil",
    "duracion": 40, "km": 7, "zona": "Z1-Z2", "rpe": "3-4", "calentamiento": "…", "principal": "35 min a {E}",
    "recuperaciones": "…", "vuelta": "…", "objetivo": "…" }] }] }
```

`tipo`: `rodaje`, `calidad`, `tirada`, `competicion`, `fuerza`, `padel`, `natacion`, `descanso`. En los textos, `{E}`, `{M}`, `{T}`, `{10K}`, `{I}` y `{R}` se sustituyen por el rango de ritmo de las zonas del usuario.

Al publicar una versión con cambios, sube `VERSION` en `sw.js` para que los dispositivos refresquen la caché.

## Publicación

Se publica como sitio estático (GitHub Pages) desde la rama `main`, carpeta raíz. Necesita HTTPS para poder instalarse.
