// Conversion d'un DXF (déjà lu par dxf-parser dans le processus principal) en plan dessiné, en centimètres.
import type { Plan, Shape } from './schema.js';

// $INSUNITS → centimètres par unité. 0 (non précisé) : on suppose des millimètres, l'usage courant des architectes.
const UNITS: Record<number, number> = { 0: 0.1, 1: 2.54, 2: 30.48, 4: 0.1, 5: 1, 6: 100 };

type Pt = { x: number; y: number };

/** Arc de cercle en polyligne (angles en radians, sens trigonométrique). */
function arc(c: Pt, r: number, a0: number, a1: number): number[] {
  if (a1 <= a0) a1 += 2 * Math.PI;
  const n = Math.max(8, Math.ceil((a1 - a0) / (Math.PI / 16)));
  return Array.from({ length: n + 1 }, (_, i) => [c.x + r * Math.cos(a0 + (a1 - a0) * i / n), c.y + r * Math.sin(a0 + (a1 - a0) * i / n)]).flat();
}

export function dxfToPlan(dxf: { entities?: any[]; header?: Record<string, any> }, name: string): Plan {
  const k = UNITS[dxf.header?.$INSUNITS ?? 0] ?? 0.1;
  const raw: { t: Shape['t']; pts: number[]; s?: string }[] = [];
  // shortcut: les blocs (INSERT), hachures et cotes DXF ne sont pas importés ; murs, lignes, arcs et textes suffisent à se repérer.
  for (const e of dxf.entities ?? []) {
    const v: Pt[] = e.vertices ?? [];
    if (e.type === 'LINE' && v.length >= 2) raw.push({ t: 'line', pts: [v[0].x, v[0].y, v[1].x, v[1].y] });
    else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && v.length >= 2)
      raw.push({ t: 'line', pts: [...v, ...(e.shape ? [v[0]] : [])].flatMap(p => [p.x, p.y]) });
    else if (e.type === 'CIRCLE') raw.push({ t: 'line', pts: arc(e.center, e.radius, 0, 2 * Math.PI) });
    else if (e.type === 'ARC') raw.push({ t: 'line', pts: arc(e.center, e.radius, e.startAngle, e.endAngle) });
    else if ((e.type === 'TEXT' || e.type === 'MTEXT') && e.text)
      raw.push({ t: 'text', pts: [(e.startPoint ?? e.position).x, (e.startPoint ?? e.position).y], s: String(e.text).replace(/\\P/g, ' ').replace(/\\[A-Za-z][^;]*;|[{}]/g, '') });
  }
  const xs = raw.flatMap(s => s.pts.filter((_, i) => i % 2 === 0)), ys = raw.flatMap(s => s.pts.filter((_, i) => i % 2 === 1));
  if (!xs.length) throw new Error('DXF vide');
  const x0 = Math.min(...xs), y1 = Math.max(...ys), margin = 50;
  const w = (Math.max(...xs) - x0) * k + 2 * margin, h = (y1 - Math.min(...ys)) * k + 2 * margin;
  // Le Y du DXF monte, celui du plan descend : on retourne la figure.
  const shapes = raw.map(s => ({ ...s, pts: s.pts.map((v, i) => Math.round((i % 2 ? (y1 - v) * k : (v - x0) * k) + margin)) }));
  return { name, image: '', w: Math.ceil(w), h: Math.ceil(h), cm: 1, board: [], marks: [], shapes };
}
