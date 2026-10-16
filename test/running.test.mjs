// Comprueba los cálculos de running (ritmos, VDOT, zonas y carga) y la estructura de data/running.json.
// Uso: node test/running.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { leerTiempo, formatoTiempo, vdot, tiempoEquivalente, zonasRitmo, zonasFC, resumenCarga } from '../js/running-calc.js';
import { iso, addDays, parse } from '../js/schedule.js';

// Tiempos
assert.equal(leerTiempo('41:00'), 2460);
assert.equal(leerTiempo('1:02:30'), 3750);
assert.equal(leerTiempo('abc'), null);
assert.equal(leerTiempo(''), null);
assert.equal(formatoTiempo(2460), '41:00');
assert.equal(formatoTiempo(3750), '1:02:30');

// VDOT: valores de referencia de las tablas de Daniels (5K 19:57 ≈ 50; 10K 41:21 ≈ 50).
assert.ok(Math.abs(vdot(5000, leerTiempo('19:57')) - 50) < 0.3);
assert.ok(Math.abs(vdot(10000, leerTiempo('41:21')) - 50) < 0.3);
// El tiempo equivalente deshace el VDOT.
const vd = vdot(10000, 2460);
assert.ok(Math.abs(tiempoEquivalente(vd, 10000) - 2460) < 1);

// Zonas de ritmo ordenadas de lento a rápido y coherentes con la marca.
const z = zonasRitmo(10000, 2460);
const centro = (x) => (x.desde + x.hasta) / 2;
const orden = ['E', 'M', 'T', '10K', 'I', 'R'].map((id) => centro(z.zonas.find((x) => x.id === id)));
for (let i = 1; i < orden.length; i++) assert.ok(orden[i] < orden[i - 1], 'zonas de ritmo ordenadas');
assert.ok(Math.abs(centro(z.zonas.find((x) => x.id === '10K')) - 246) < 1, 'ritmo 10K = marca / 10');
for (const x of z.zonas) assert.ok(x.desde <= x.hasta, `rango ${x.id}`);

// Zonas de FC contiguas, sin huecos.
const fc = zonasFC(168, 188);
for (let i = 1; i < fc.length; i++) assert.equal(fc[i].min, fc[i - 1].max + 1);
assert.equal(fc[4].min, 168);
assert.equal(fc[4].max, 188);

// Carga: 4 semanas idénticas → relación aguda:crónica = 1.
const hoy = parse('2026-10-16');
const regs = [];
for (let i = 1; i < 28; i += 2) regs.push({ fecha: iso(addDays(hoy, -i)), tipo: 'rodaje', minutos: 40, km: 8, rpe: 4 });
const r = resumenCarga(regs, hoy);
assert.equal(r.semanas.length, 4);
assert.ok(r.semanas.every((s) => s.sesiones >= 3));
assert.ok(r.ratio > 0.8 && r.ratio < 1.25, `ratio ${r.ratio}`);
// Con poco historial no se calcula la relación.
assert.equal(resumenCarga(regs.slice(0, 3), hoy).ratio, null);
// El pádel suma carga pero no kilómetros.
const conPadel = resumenCarga([{ fecha: '2026-10-16', tipo: 'padel', minutos: 90, rpe: 7, km: 0 }], hoy);
assert.equal(conPadel.semanas[3].km, 0);
assert.equal(conPadel.aguda, 630);

// Estructura de data/running.json
const datos = JSON.parse(readFileSync(fileURLToPath(new URL('../data/running.json', import.meta.url)), 'utf8'));
assert.ok(leerTiempo(datos.perfil.zonas.marca));
const ids = datos.auditoria.flatMap((b) => b.preguntas.map((p) => p.id));
assert.equal(new Set(ids).size, ids.length, 'ids de preguntas únicos');
const sesionesPlan = (datos.plan.semanas || []).flatMap((s) => s.dias.flatMap((d) => d.sesiones));
const idsPlan = sesionesPlan.map((s) => s.id);
assert.equal(new Set(idsPlan).size, idsPlan.length, 'ids de sesiones del plan únicos');
for (const s of datos.plan.semanas || []) {
  assert.equal(parse(s.lunes).getDay(), 1, `${s.lunes} es lunes`);
  for (const d of s.dias) assert.ok(d.fecha >= s.lunes && d.fecha <= iso(addDays(parse(s.lunes), 6)), `${d.fecha} dentro de su semana`);
}
for (const s of datos.guia.sesiones) {
  for (const m of Object.values(s).join(' ').matchAll(/\{([^}]+)\}/g)) assert.ok(['E', 'M', 'T', '10K', 'I', 'R'].includes(m[1]), `marcador ${m[1]}`);
}

console.log(`VDOT 10K 41:00 = ${vd.toFixed(1)} · ${ids.length} preguntas · ${datos.plan.semanas.length} semanas de plan`);
console.log('OK');
