// Modèle de projet, vérifications, calculs et rendu SVG des feuilles. Pur (pas de DOM), donc testable sous Node.
import { symbol } from './symbols.js';
import { _, t } from './i18n.js';

export interface Device { id: string; kind: string; count: number; label: string; room: string }
/** phase : '' (réseau 2 × 230 V), 'L1'… (phase-neutre, 3N × 400 V), 'L1-L2'… (entre phases, 3 × 230 V), '3P' ou '3P+N' (triphasé). power en W, 0 si inconnue. */
export interface Circuit { kind: 'circuit'; name: string; curve: string; breaker: number; ka: number; cable: string; phase: string; power: number; devices: Device[] }
/** sensitivity 0 = interrupteur général sans différentiel (tête d'un tableau divisionnaire). tripMa / tripMs : mesures de l'essai. */
export interface Rcd { kind: 'rcd'; rating: number; sensitivity: number; type: string; poles: string; tripMa: string; tripMs: string; children: (Rcd | Circuit)[] }
/** Tableau divisionnaire, alimenté par un point « tableau » (feed = id du Device). */
export interface Board { name: string; feed: string; root: Rcd }
/** Un point reporté sur un plan ; id = id du Device. Coordonnées en unités du plan. */
export interface Mark { id: string; x: number; y: number }
/** Élément dessiné sur un plan. pts = [x1, y1, x2, y2…] en unités du plan. */
export interface Shape { t: 'wall' | 'door' | 'window' | 'text' | 'dim' | 'stairs' | 'line'; pts: number[]; s?: string }
/** image = '' pour un plan dessiné ; cm = centimètres réels par unité (0 = échelle inconnue) ; board = position du tableau principal. */
export interface Plan { name: string; image: string; w: number; h: number; cm: number; board: number[]; marks: Mark[]; shapes: Shape[] }
export interface Measures { earth: string; insulation: string; continuity: string; instrument: string; notes: string }
export interface Project {
  title: string; client: string; address: string; inspector: string; date: string; network: string;
  installer: string; installerAddress: string; installerPhone: string; installerEmail: string; installerVat: string;
  /** Logo de l'installateur (data URL) ou ''. */
  logo: string;
  mainBreaker: number; root: Rcd; boards: Board[]; plans: Plan[];
  /** Liaisons de commande entre points (interrupteur → point lumineux), par id de Device. */
  links: [string, string][];
  measures: Measures;
}

/** Réseaux gérés et phases possibles pour un circuit sur chacun. */
export const PHASES: Record<string, string[]> = {
  '2 × 230 V': [''],
  '3 × 230 V': ['L1-L2', 'L2-L3', 'L3-L1', '3P'],
  '3N × 400 V': ['L1', 'L2', 'L3', '3P+N', '3P'],
};
export const phasesOf = (p: Project) => PHASES[p.network] ?? [''];
export const isTri = (p: Project) => phasesOf(p).length > 1;
const triPhase = (p: Project) => phasesOf(p).includes('3P+N') ? '3P+N' : isTri(p) ? '3P' : '';
/** Pôles du disjoncteur, déduits de la phase. */
export const poles = (c: Circuit) => c.phase === '3P+N' ? '4P' : c.phase === '3P' ? '3P' : /^L\d$/.test(c.phase) ? '1P+N' : '2P';

const circuitsOf = (r: Rcd): Circuit[] => r.children.flatMap(c => c.kind === 'rcd' ? circuitsOf(c) : [c]);
const rcdsOf = (r: Rcd): Rcd[] => [r, ...r.children.flatMap(c => c.kind === 'rcd' ? rcdsOf(c) : [])];
/** Tableau principal puis tableaux divisionnaires. */
export const allBoards = (p: Project): Board[] => [{ name: t('Tableau principal'), feed: '', root: p.root }, ...p.boards];
const allRcds = (p: Project) => allBoards(p).flatMap(b => rcdsOf(b.root));

/** Change de réseau et ramène les phases / pôles devenus impossibles sur une valeur valable. */
export function setNetwork(p: Project, network: string) {
  p.network = network;
  const ok = phasesOf(p);
  for (const c of letters(p).keys())
    if (!ok.includes(c.phase)) c.phase = c.phase.startsWith('3P') && ok.includes('3P') ? '3P' : ok[0];
  for (const r of allRcds(p)) if (!isTri(p)) r.poles = '2P';
  if (isTri(p)) p.root.poles = '4P';
}

/** Courant prévu par phase (A) d'après les puissances saisies ; null sur un réseau 2 × 230 V. */
export function phaseLoads(p: Project): Record<string, number> | null {
  if (!isTri(p)) return null;
  const I: Record<string, number> = { L1: 0, L2: 0, L3: 0 };
  const U = p.network === '3N × 400 V' ? 400 : 230;
  for (const c of letters(p).keys()) {
    const P = +c.power || 0;
    if (c.phase.startsWith('3P')) for (const k in I) I[k] += P / (Math.sqrt(3) * U);
    else for (const k of c.phase.split('-')) if (k in I) I[k] += P / 230;
  }
  return I;
}

const TEXT_FIELDS = ['client', 'address', 'inspector', 'date', 'network', 'installer', 'installerAddress', 'installerPhone', 'installerEmail', 'installerVat', 'logo'] as const;
const MEASURES = ['earth', 'insulation', 'continuity', 'instrument', 'notes'] as const;

export const newDevice = (kind = 'prise', label = '', count = 1, room = ''): Device => ({ id: crypto.randomUUID(), kind, count, label, room });
export const newCircuit = (name = '', breaker = 20, cable = 'XVB 3G2,5', devices: Device[] = [], phase = '', power = 0): Circuit =>
  ({ kind: 'circuit', name, curve: 'C', breaker, ka: 3, cable, phase, power, devices });
export const newRcd = (poles = '2P', sensitivity = 30, rating = 40): Rcd =>
  ({ kind: 'rcd', rating, sensitivity, type: 'A', poles, tripMa: '', tripMs: '', children: [] });
/** Copie d'un circuit avec de nouveaux identifiants de points. */
export const cloneCircuit = (c: Circuit): Circuit => ({ ...structuredClone(c), devices: c.devices.map(d => ({ ...d, id: crypto.randomUUID() })) });

export function newProject(): Project {
  const d = newDevice, c = newCircuit;
  const sw = d('interrupteur', '', 1, 'Séjour'), lamp1 = d('lumiere', '', 1, 'Séjour'), lamp2 = d('lumiere', '', 1, 'Cuisine');
  return {
    ...Object.fromEntries(TEXT_FIELDS.map(k => [k, ''])) as Record<typeof TEXT_FIELDS[number], string>,
    title: t('Nouveau projet'), date: new Date().toISOString().slice(0, 10), network: '3N × 400 V', mainBreaker: 40,
    plans: [], boards: [], links: [[sw.id, lamp1.id], [sw.id, lamp2.id]],
    measures: Object.fromEntries(MEASURES.map(k => [k, ''])) as unknown as Measures,
    root: {
      ...newRcd('4P', 300), children: [
        c(t('Éclairage'), 16, 'XVB 3G1,5', [sw, lamp1, lamp2], 'L1', 500),
        c(t('Prises'), 20, 'XVB 3G2,5', [d('prise', '', 2, 'Séjour'), d('prise', '', 1, 'Séjour'), d('prise', 'TV', 3, 'Séjour')], 'L2', 3000),
        c(t('Taque'), 16, 'XVB 5G2,5', [d('taque', '', 1, 'Cuisine')], '3P+N', 7400),
        c(t('Photovoltaïque'), 20, 'XVB 3G2,5', [d('onduleur'), d('sectionneur_dc'), d('pv', '10 × 400 Wc')], 'L3'),
        { ...newRcd('4P'), children: [
          c(t('Salle de bain'), 20, 'XVB 3G2,5', [d('prise_etanche', '', 1, 'Salle de bain'), d('lumiere', '', 1, 'Salle de bain')], 'L3', 2000),
          c(t('Lave-linge'), 20, 'XVB 3G2,5', [d('lave_linge', '', 1, 'Buanderie')], 'L1', 2300),
        ] },
      ],
    },
  };
}

/** Circuits types : nom affiché, puis fabrique adaptée au réseau du projet. */
export const TEMPLATES: [string, (p: Project) => Circuit][] = [
  [_('Éclairage'), p => newCircuit(t('Éclairage'), 16, 'XVB 3G1,5', [newDevice('interrupteur'), newDevice('lumiere')], phasesOf(p)[0], 500)],
  [_('Prises'), p => newCircuit(t('Prises'), 20, 'XVB 3G2,5', [newDevice('prise'), newDevice('prise'), newDevice('prise')], phasesOf(p)[0], 2300)],
  [_('Prises cuisine'), p => newCircuit(t('Prises cuisine'), 20, 'XVB 3G2,5', [1, 2, 3, 4].map(() => newDevice('prise')), phasesOf(p)[0], 3000)],
  [_('Taque'), p => triPhase(p)
    ? newCircuit(t('Taque'), 16, triPhase(p) === '3P+N' ? 'XVB 5G2,5' : 'XVB 4G2,5', [newDevice('taque')], triPhase(p), 7400)
    : newCircuit(t('Taque'), 32, 'XVB 3G6', [newDevice('taque')], '', 7400)],
  [_('Four'), p => newCircuit(t('Four'), 20, 'XVB 3G2,5', [newDevice('four')], phasesOf(p)[0], 3500)],
  [_('Lave-linge'), p => newCircuit(t('Lave-linge'), 20, 'XVB 3G2,5', [newDevice('lave_linge')], phasesOf(p)[0], 2300)],
  [_('Sèche-linge'), p => newCircuit(t('Sèche-linge'), 20, 'XVB 3G2,5', [newDevice('seche_linge')], phasesOf(p)[0], 2500)],
  [_('Lave-vaisselle'), p => newCircuit(t('Lave-vaisselle'), 20, 'XVB 3G2,5', [newDevice('lave_vaisselle')], phasesOf(p)[0], 2300)],
  [_('Chauffe-eau'), p => newCircuit(t('Chauffe-eau'), 20, 'XVB 3G2,5', [newDevice('chauffe_eau')], phasesOf(p)[0], 2400)],
  [_('Borne de recharge VE'), p => triPhase(p) === '3P+N'
    ? newCircuit(t('Borne de recharge VE'), 16, 'XVB 5G4', [newDevice('borne_ve')], '3P+N', 11000)
    : newCircuit(t('Borne de recharge VE'), 32, 'XVB 3G6', [newDevice('borne_ve')], phasesOf(p)[0], 7400)],
  [_('Photovoltaïque'), p => newCircuit(t('Photovoltaïque'), 20, 'XVB 3G2,5', [newDevice('onduleur'), newDevice('sectionneur_dc'), newDevice('pv')], phasesOf(p)[0])],
  [_('Pompe à chaleur'), p => triPhase(p)
    ? newCircuit(t('Pompe à chaleur'), 16, triPhase(p) === '3P+N' ? 'XVB 5G2,5' : 'XVB 4G2,5', [newDevice('pac')], triPhase(p), 6000)
    : newCircuit(t('Pompe à chaleur'), 20, 'XVB 3G2,5', [newDevice('pac')], '', 3500)],
  [_('Ventilation (VMC)'), p => newCircuit(t('Ventilation (VMC)'), 16, 'XVB 3G1,5', [newDevice('vmc')], phasesOf(p)[0], 100)],
  [_('Volets'), p => newCircuit(t('Volets'), 16, 'XVB 3G1,5', [newDevice('volet'), newDevice('volet')], phasesOf(p)[0], 300)],
  [_('Tableau divisionnaire'), p => triPhase(p) === '3P+N'
    ? newCircuit(t('Tableau divisionnaire'), 25, 'XVB 5G6', [newDevice('tableau')], '3P+N')
    : newCircuit(t('Tableau divisionnaire'), 32, 'XVB 3G6', [newDevice('tableau')], phasesOf(p)[0])],
];

/** Pièces proposées à la saisie. */
export const ROOMS = [_('Séjour'), _('Cuisine'), _('Salle de bain'), _('Chambre'), _('WC'), _('Hall'), _('Buanderie'), _('Garage'), _('Bureau'), _('Grenier'), _('Cave'), _('Extérieur')];

// 2770 × 1575 cm remplit exactement la zone de dessin A4 à l'échelle 1:100.
export const newBlankPlan = (name: string): Plan => ({ name, image: '', w: 2770, h: 1575, cm: 1, board: [], marks: [], shapes: [] });
/** Épaisseur des murs : 20 cm sur un plan à l'échelle connue, proportionnelle à l'image sinon. */
export const wallT = (pl: Plan) => pl.image ? (pl.cm ? 20 / pl.cm : pl.w / 140) : 20;

const IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const SHAPES = ['wall', 'door', 'window', 'text', 'dim', 'stairs', 'line'];
const numbers = (a: any) => Array.isArray(a) && a.every(Number.isFinite);
const validPlan = (pl: any) => (pl?.image === '' || IMAGE.test(pl?.image)) && Number.isFinite(pl.w) && Number.isFinite(pl.h) &&
  Array.isArray(pl.marks) && Array.isArray(pl.shapes ??= []) && numbers(pl.board ??= []) && Number.isFinite(pl.cm ??= pl.image ? 0 : 1) &&
  pl.shapes.every((s: any) => SHAPES.includes(s?.t) && numbers(s.pts));
const validRcd = (r: any): boolean => r?.kind === 'rcd' && Array.isArray(r.children) &&
  r.children.every((c: any) => c?.kind === 'rcd' ? validRcd(c) : c?.kind === 'circuit' && Array.isArray(c.devices));

/** Lit un fichier .elk (non fiable) et complète les champs absents des anciennes versions. */
export function parseProject(json: string): Project {
  const p = JSON.parse(json);
  p.boards ??= [];
  if (typeof p?.title !== 'string' || !validRcd(p.root) || !Array.isArray(p.boards) || !p.boards.every((b: any) => validRcd(b?.root)))
    throw new Error('Fichier Electrik invalide');
  for (const b of p.boards) { b.name = String(b.name ?? ''); b.feed = String(b.feed ?? ''); }
  p.plans ??= [];
  if (!Array.isArray(p.plans) || !p.plans.every(validPlan)) throw new Error('Plan invalide');
  for (const k of TEXT_FIELDS) p[k] ??= '';
  if (p.logo && !IMAGE.test(p.logo)) throw new Error('Logo invalide');
  p.links ??= [];
  if (!Array.isArray(p.links) || !p.links.every((l: any) => Array.isArray(l) && l.length === 2 && l.every(s => typeof s === 'string')))
    throw new Error('Liaisons invalides');
  p.measures = { ...Object.fromEntries(MEASURES.map(k => [k, ''])), ...p.measures };
  if (!PHASES[p.network]) p.network = '2 × 230 V'; // anciennes versions : texte libre
  for (const c of letters(p).keys()) { c.curve ??= 'C'; c.ka ??= 3; c.phase ??= phasesOf(p)[0]; c.power ??= 0; }
  for (const r of allRcds(p)) { r.poles ??= isTri(p) ? '4P' : '2P'; r.tripMa ??= ''; r.tripMs ??= ''; }
  for (const [, , d] of points(p)) { d.id ??= crypto.randomUUID(); d.room ??= ''; }
  return p;
}

/** 0 → A, 25 → Z, 26 → AA */
export function letter(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}

/** Lettre de chaque circuit, dans l'ordre du schéma, tableau principal puis divisionnaires. */
export const letters = (p: Project) => new Map(allBoards(p).flatMap(b => circuitsOf(b.root)).map((c, i) => [c, letter(i)]));

/** Tous les points numérotés : [numéro (A1…), circuit, point]. */
export function points(p: Project): [string, Circuit, Device][] {
  return [...letters(p)].flatMap(([c, n]) => c.devices.map((d, i): [string, Circuit, Device] => [`${n}${i + 1}`, c, d]));
}

/** Supprime les reports de plan, liaisons et alimentations dont le point n'existe plus. */
export function prune(p: Project) {
  const ids = new Set(points(p).map(([, , d]) => d.id));
  for (const pl of p.plans) pl.marks = pl.marks.filter(m => ids.has(m.id));
  p.links = p.links.filter(l => l.every(id => ids.has(id)));
  for (const b of p.boards) if (!ids.has(b.feed)) b.feed = '';
}

/** Plus petite sensibilité différentielle en amont de chaque circuit (Infinity si aucune), tableaux divisionnaires compris. */
export function protection(p: Project): Map<Circuit, number> {
  const res = new Map<Circuit, number>();
  const walk = (r: Rcd, min: number) => {
    const m = r.sensitivity > 0 ? Math.min(min, r.sensitivity) : min;
    for (const c of r.children) if (c.kind === 'rcd') walk(c, m); else res.set(c, m);
  };
  walk(p.root, Infinity);
  const owner = new Map(points(p).map(([, c, d]) => [d.id, c]));
  for (const b of p.boards) walk(b.root, res.get(owner.get(b.feed)!) ?? Infinity);
  return res;
}

const section = (c: Circuit) => Number(/G\s*(\d+(?:[.,]\d+)?)/i.exec(c.cable)?.[1]?.replace(',', '.')) || 0;

/** Chute de tension (%) d'un circuit de m mètres : courant d'après la puissance, sinon le calibre ; cuivre ρ = 0,0225 Ω·mm²/m. */
export function voltageDrop(p: Project, c: Circuit, m: number): number {
  const S = section(c);
  if (!S) return 0;
  const tri = c.phase.startsWith('3P'), U = tri && p.network === '3N × 400 V' ? 400 : 230;
  const I = c.power > 0 ? c.power / (tri ? Math.sqrt(3) * U : 230) : c.breaker;
  return (tri ? Math.sqrt(3) : 2) * 0.0225 * m * I / S / U * 100;
}

/** Longueur de câble (m) et chute de tension (%) des circuits dont le tableau et les points sont sur un même plan à l'échelle. */
export function cableRuns(p: Project): Map<Circuit, { m: number; drop: number }> {
  const res = new Map<Circuit, { m: number; drop: number }>();
  allBoards(p).forEach((b, bi) => {
    for (const pl of p.plans) {
      if (!pl.cm) continue;
      const feed = bi ? pl.marks.find(m => m.id === b.feed) : undefined;
      const origin = bi ? (feed && [feed.x, feed.y]) : pl.board.length === 2 && pl.board;
      if (!origin) continue;
      for (const c of circuitsOf(b.root)) {
        const marks = c.devices.map(d => pl.marks.find(m => m.id === d.id)).filter(m => m) as Mark[];
        if (res.has(c) || !marks.length) continue;
        let [x, y] = origin, units = 0;
        for (const m of marks) { units += Math.abs(m.x - x) + Math.abs(m.y - y); [x, y] = [m.x, m.y]; }
        // shortcut: tracé en L le long des murs + 1,5 m de montée/descente par point, pas de calcul de chemin réel.
        const m = units * pl.cm / 100 + 1.5 * marks.length;
        res.set(c, { m, drop: voltageDrop(p, c, m) });
      }
    }
  });
  return res;
}

// shortcut: section → calibre max simplifié (RGIE/AREI, cuivre), à compléter avec les modes de pose.
const MAX_BREAKER: Record<string, number> = { '1.5': 16, '2.5': 20, '4': 25, '6': 40, '10': 63 };
const WET_ROOM = /bain|douche|badkamer/i;
const WET_APPLIANCES = ['lave_linge', 'seche_linge', 'lave_vaisselle'];
const rcdName = (r: Rcd) => `${r.rating} A ${r.sensitivity} mA`;
const num = (s: string) => Number(String(s).replace(',', '.'));

export function check(p: Project): string[] {
  const w: string[] = [];
  const ok = phasesOf(p), prot = protection(p), runs = cableRuns(p);
  for (const [c, n] of letters(p)) {
    if (!ok.includes(c.phase)) w.push(t('Circuit {n} : phase « {ph} » impossible sur un réseau {net}', { n, ph: c.phase, net: p.network }));
    const cond = Number(/(\d+)\s*G/i.exec(c.cable)?.[1]);
    const need = c.phase === '3P+N' ? 5 : c.phase === '3P' ? 4 : 3;
    if (cond && cond < need) w.push(t('Circuit {n} : câble {c} insuffisant en {p} ({k} conducteurs, terre comprise)', { n, c: c.cable, p: poles(c), k: need }));
    if (c.devices.some(d => d.kind === 'prise_tri') && !c.phase.startsWith('3P')) w.push(t('Circuit {n} : prise triphasée sur un circuit monophasé', { n }));
    const s = section(c), max = MAX_BREAKER[String(s)];
    if (max && c.breaker > max) w.push(t('Circuit {n} : disjoncteur {a} A trop élevé pour {s} mm² (max {m} A)', { n, a: c.breaker, s, m: max }));
    const prises = c.devices.filter(d => d.kind.startsWith('prise')).length;
    if (prises > 8) w.push(t('Circuit {n} : {k} points de prises (max 8)', { n, k: prises }));
    if (c.devices.some(d => d.kind === 'onduleur') && c.devices.some(d => !['onduleur', 'sectionneur_dc', 'pv', 'optimiseur', 'parafoudre'].includes(d.kind)))
      w.push(t("Circuit {n} : l'onduleur doit être sur un circuit dédié", { n }));
    if ((prot.get(c) ?? Infinity) > 30) c.devices.forEach((d, i) => {
      if (WET_ROOM.test(d.room)) w.push(t('Point {pt} ({room}) sans différentiel 30 mA', { pt: `${n}${i + 1}`, room: t(d.room) }));
      else if (WET_APPLIANCES.includes(d.kind)) w.push(t('Point {pt} ({kind}) sans différentiel 30 mA', { pt: `${n}${i + 1}`, kind: t(symbol(d.kind).label) }));
    });
    const run = runs.get(c);
    // shortcut: limite indicative de 5 %, à confirmer selon l'usage (éclairage, moteurs…).
    if (run && run.drop > 5) w.push(t('Circuit {n} : chute de tension estimée {v} % (> 5 %)', { n, v: run.drop.toFixed(1) }));
  }
  for (const r of allRcds(p)) {
    if (r.poles === '2P' && circuitsOf(r).some(c => c.phase.startsWith('3P')))
      w.push(t("Différentiel {a} A {s} mA : 2P en amont d'un circuit triphasé (4P nécessaire)", { a: r.rating, s: r.sensitivity }));
    if (r.sensitivity && r.tripMa && num(r.tripMa) > r.sensitivity) w.push(t('Différentiel {r} : déclenche à {v} mA (> {s} mA)', { r: rcdName(r), v: r.tripMa, s: r.sensitivity }));
    if (r.sensitivity && r.tripMs && num(r.tripMs) > 300) w.push(t('Différentiel {r} : temps de déclenchement {v} ms (> 300 ms)', { r: rcdName(r), v: r.tripMs }));
  }
  for (const b of p.boards) if (!b.feed) w.push(t("{name} : point d'alimentation non choisi", { name: b.name }));
  if (p.measures.earth && num(p.measures.earth) > 30) w.push(t('Prise de terre {v} Ω (> 30 Ω)', { v: p.measures.earth }));
  const I = phaseLoads(p);
  if (I) {
    const v = Object.values(I), max = Math.max(...v), min = Math.min(...v);
    // shortcut: seuil indicatif (30 % d'écart dès 10 A), sans foisonnement ni simultanéité.
    if (max >= 10 && max - min > 0.3 * max) w.push(t('Phases déséquilibrées : {v}', { v: formatLoads(I) }));
  }
  if (p.plans.length) {
    const placed = new Set(p.plans.flatMap(pl => pl.marks.map(m => m.id)));
    const missing = points(p).filter(([, , d]) => !placed.has(d.id)).map(([n]) => n);
    if (missing.length) w.push(t('{k} point(s) pas encore reporté(s) sur un plan : {v}', { k: missing.length, v: missing.join(', ') }));
  }
  return w;
}

export const formatLoads = (I: Record<string, number>) => Object.entries(I).map(([k, a]) => `${k} ${a.toFixed(1)} A`).join(' · ');

/** Largeur en modules DIN de 18 mm. */
const modulesOf = (polesLabel: string) => ({ '1P+N': 1, '2P': 2, '3P': 3, '4P': 4 } as Record<string, number>)[polesLabel] ?? 2;

/** Liste de matériel : [catégorie, désignation, quantité, unité]. */
export function bom(p: Project): string[][] {
  const rows = new Map<string, number>();
  const add = (cat: string, item: string, unit: string, n = 1) => {
    const k = [cat, item, unit].join('\0');
    rows.set(k, (rows.get(k) ?? 0) + n);
  };
  const runs = cableRuns(p);
  let modules = 0;
  for (const r of allRcds(p)) {
    if (r.sensitivity) add(t('Différentiels'), `${r.rating} A ${r.sensitivity} mA ${t('Type')} ${r.type} ${r.poles}`, t('pc'));
    else add(t('Interrupteurs généraux'), `${r.rating} A ${r.poles}`, t('pc'));
    modules += modulesOf(r.poles);
  }
  for (const c of letters(p).keys()) {
    add(t('Disjoncteurs'), `${c.curve}${c.breaker}A ${poles(c)} ${c.ka} kA`, t('pc'));
    modules += modulesOf(poles(c));
    const run = runs.get(c);
    if (run) add(t('Câbles'), c.cable, t('m'), run.m);
    else add(t('Câbles'), `${c.cable} (${t('longueur à mesurer')})`, t('circuit(s)'));
    for (const d of c.devices) add(t('Points'), t(symbol(d.kind).label), t('pc'), d.count || 1);
  }
  add(t('Tableau'), t('Modules DIN (18 mm)'), t('modules'), modules);
  const order = [t('Différentiels'), t('Interrupteurs généraux'), t('Disjoncteurs'), t('Câbles'), t('Points'), t('Tableau')];
  return [...rows].map(([k, n]) => { const [cat, item, unit] = k.split('\0'); return [cat, item, String(Math.ceil(n)), unit]; })
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]) || a[1].localeCompare(b[1]));
}

/** CSV pour Excel (séparateur ;, BOM UTF-8). */
export const toCsv = (rows: string[][]) => '﻿' + rows.map(r => r.map(v => /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(';')).join('\r\n');

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

const BREAKER = '<path d="M0 0H10L28 -10M30 0H40M27 -3l6 6M33 -3l-6 6"/>';
const RCD = '<path d="M0 0H10L28 -10M30 0H40"/><ellipse cx="20" cy="9" rx="9" ry="4"/>';
const SWITCH = '<path d="M0 0H10L28 -10M30 0H40M30 -4V4"/>';
const g = (x: number, y: number, body: string, tr = '') => `<g transform="translate(${+x} ${+y})${tr}">${body}</g>`;
const text = (x: number, y: number, s: unknown, cls = '') => `<text x="${+x}" y="${+y}" class="${cls}">${esc(s)}</text>`;
const line = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${+x1}" y1="${+y1}" x2="${+x2}" y2="${+y2}"/>`;

// Feuille A4 paysage en unités de 0,25 mm : cadre, zone de dessin (A*) et cartouche (C*).
export const PW = 1188, PH = 840;
const AX = 40, AY = 40, AW = PW - 80, AH = 630, CY = AY + AH, CH = PH - 40 - CY;

/** Coupe un texte en lignes d'au plus n caractères. */
function wrap(s: string, n: number, max = 2): string[] {
  const lines = [''];
  for (const w of String(s ?? '').split(/\s+/)) {
    if (lines.at(-1) && (lines.at(-1) + ' ' + w).length > n) lines.push('');
    lines[lines.length - 1] = (lines.at(-1) + ' ' + w).trim();
  }
  return lines.slice(0, max);
}

// Cases du cartouche : logo | installateur | installation | contrôle | titre.
const CART = [0, 150, 410, 640, 830, AW];

function cartouche(p: Project, sheet: string, folio: string): string {
  const L = (x: number, y: number, s: string, cls = '') => text(x, y, t(s).toUpperCase(), `ct-l ${cls}`);
  const V = (x: number, y: number, s: unknown, cls = '') => text(x, y, s, `ct-v ${cls}`);
  const [, xi, xa, xc, xt] = CART.map(x => x + 10);
  const contact = [p.installerPhone, p.installerEmail].filter(Boolean).join('  ·  ');
  return `<g class="cart"><rect class="ct-out" width="${AW}" height="${CH}"/>` + CART.slice(1, -1).map(x => line(x, 0, x, CH)).join('') +
    CART.slice(1, 4).map((x, i) => line(x, 96, CART[i + 2], 96)).join('') + line(xt - 10, 96, AW, 96) +
    (p.logo ? `<image href="${esc(p.logo)}" x="10" y="10" width="${CART[1] - 20}" height="${CH - 20}"/>` : L(CART[1] / 2, CH / 2 + 2, 'Logo', 'mid')) +
    L(xi, 16, 'Installateur') + V(xi, 32, p.installer, 'ct-b') +
    wrap(p.installerAddress, 48).map((s, i) => V(xi, 46 + i * 12, s)).join('') +
    V(xi, 72, contact) + V(xi, 84, p.installerVat ? t('TVA / BCE {v}', { v: p.installerVat }) : '') +
    L(xi, 108, 'Date') + L(xi + 110, 108, 'Signature') +
    L(xa, 16, "Adresse de l'installation") + wrap(p.address, 42).map((s, i) => V(xa, 32 + i * 12, s)).join('') +
    L(xa, 64, 'Propriétaire') + V(xa, 80, p.client) +
    L(xa, 108, 'Tension réseau') + V(xa, 121, p.network) +
    L(xc, 16, 'Organisme de contrôle') + V(xc, 32, p.inspector, 'ct-b') +
    L(xc, 108, 'Date') + L(xc + 90, 108, 'Signature') +
    V(xt, 30, p.title, 'ct-t') + V(xt, 48, sheet) +
    L(xt, 108, 'Date') + V(xt, 121, p.date) + L(xt + 130, 108, 'Folio') + V(xt + 130, 121, folio) + '</g>';
}

/** Cadre avec repères (1…22 / A…J) et cartouche autour du corps de la feuille. */
function frame(p: Project, sheet: string, folio: string, body: string, cls = ''): string {
  const out = [`<rect class="thin" x="20" y="20" width="${PW - 40}" height="${PH - 40}"/>`, `<rect class="frame" x="40" y="40" width="${AW}" height="${PH - 80}"/>`];
  const cw = AW / 22, rh = (PH - 80) / 10;
  for (let i = 0; i < 22; i++) {
    const x = 40 + i * cw;
    if (i) out.push(`<g class="thin">${line(x, 20, x, 40)}${line(x, PH - 40, x, PH - 20)}</g>`);
    out.push(text(x + cw / 2, 33, i + 1, 'ref mid'), text(x + cw / 2, PH - 27, i + 1, 'ref mid'));
  }
  for (let i = 0; i < 10; i++) {
    const y = 40 + i * rh;
    if (i) out.push(`<g class="thin">${line(20, y, 40, y)}${line(PW - 40, y, PW - 20, y)}</g>`);
    out.push(text(30, y + rh / 2 + 3, letter(i), 'ref mid'), text(PW - 30, y + rh / 2 + 3, letter(i), 'ref mid'));
  }
  out.push(body, g(AX, CY, cartouche(p, sheet, folio)));
  return page(out.join(''), cls);
}

const page = (body: string, cls = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" class="sheet ${cls}" viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}">${body}</svg>`;

// Unifilaire vertical : alimentation en bas (YS), barres des différentiels (BUS), un circuit par colonne.
const CW = 56, YS = 560, BUS = 480, FIRST = BUS - 140, TOP = 20;

/** Dessin complet d'un tableau (aussi large que nécessaire) + positions où l'on peut couper entre deux colonnes. */
function unifilaire(p: Project, b: Board, main: boolean): { body: string; cuts: number[] } {
  const L = letters(p);
  const out: string[] = [], cuts: number[] = [];
  const all = circuitsOf(b.root);
  const maxDev = Math.max(1, ...all.map(c => c.devices.length));
  const dy = maxDev > 1 ? Math.min(36, (FIRST - TOP) / (maxDev - 1)) : 36;
  const r = b.root;
  const head = (rcd: Rcd) => rcd.sensitivity ? RCD : SWITCH;
  const headText = (rcd: Rcd) => rcd.sensitivity ? [`Diff ${rcd.rating} A ${rcd.poles}`, `Δ ${rcd.sensitivity} mA`, `${t('Type')} ${rcd.type}`] : [t('Général {a} A', { a: rcd.rating }), rcd.poles, ''];

  // Alimentation : terre et compteur (tableau principal) ou point d'alimentation (divisionnaire), puis tête du tableau.
  if (main) out.push(line(14, YS, 40, YS), g(14, YS, symbol('terre').svg), line(14, YS, 14, YS + 10),
    `<rect x="40" y="${YS - 14}" width="56" height="28"/>`, line(40, YS, 96, YS), text(68, YS - 3, 'kWh', 'small mid'), text(68, YS + 11, `${p.mainBreaker} A`, 'small mid'),
    line(96, YS, 120, YS),
    // Un trait oblique par conducteur actif : 2 (2 × 230 V), 3 (3 × 230 V), 4 (3N × 400 V).
    `<path d="${Array.from({ length: p.network === '3N × 400 V' ? 4 : isTri(p) ? 3 : 2 }, (_x, i) => `M${101 + i * 5} ${YS + 4}L${105 + i * 5} ${YS - 4}`).join('')}"/>`);
  else {
    const feed = points(p).find(([, , d]) => d.id === b.feed)?.[0] ?? '?';
    out.push(line(14, YS, 120, YS), text(14, YS - 8, t('Alimenté par {pt}', { pt: feed }), 'small'));
  }
  out.push(g(120, YS, head(r)), ...headText(r).map((s, i) => text(140, YS + 28 + i * 10, s, 'small mid')));

  const column = (c: Circuit, x: number) => {
    const n = L.get(c)!;
    const top = c.devices.length ? FIRST - (c.devices.length - 1) * dy : FIRST;
    out.push(g(x, BUS, BREAKER, ' rotate(-90)'), line(x, BUS - 40, x, top),
      text(x + 5, BUS - 22, `${c.curve}${c.breaker}A`, 'small'), text(x + 5, BUS - 12, `${c.ka}kA`, 'small'),
      text(x + 5, BUS - 32, poles(c), 'small'),
      text(x, BUS + 16, n, 'bold mid'), c.phase && !c.phase.startsWith('3P') ? text(x, BUS + 27, c.phase, 'small mid') : '',
      `<text class="small" transform="translate(${x - 4} ${BUS - 48}) rotate(-90)">${esc(c.cable)}</text>`);
    c.devices.forEach((d, i) => {
      const y = FIRST - i * dy;
      out.push(`<g class="rot" transform="translate(${x} ${y}) rotate(-90)"><path d="M0 0V10"/>${symbol(d.kind).svg}</g>`,
        text(x - 4, y + 3, i + 1, 'small end'), d.count > 1 ? text(x + 24, y - 9, `×${d.count}`, 'small') : '');
    });
    cuts.push(x + CW / 2);
  };

  // Un segment = une barre alimentée soit directement (circuits de la tête), soit par un différentiel.
  let x = 170, lastRiser = 170;
  const segment = (circuits: Circuit[], rcd?: Rcd) => {
    const riser = lastRiser = x + 12, first = x + 36;
    if (rcd) out.push(g(riser, YS, head(rcd), ' rotate(-90)'), line(riser, YS - 40, riser, BUS),
      ...headText(rcd).map((s, i) => text(riser - 14, YS - 34 + i * 10, s, 'small end')));
    else out.push(line(riser, YS, riser, BUS));
    circuits.forEach((c, i) => column(c, first + i * CW));
    const last = first + Math.max(0, circuits.length - 1) * CW;
    out.push(line(riser, BUS, last, BUS));
    x = last + CW / 2;
  };
  let run: Circuit[] = [];
  for (const c of r.children) {
    if (c.kind === 'circuit') { run.push(c); continue; }
    if (run.length) segment(run);
    run = [];
    // shortcut: un différentiel imbriqué dans un 30 mA est dessiné au même niveau, rare en résidentiel.
    segment(circuitsOf(c), c);
  }
  if (run.length || !r.children.length) segment(run);
  out.push(line(160, YS, lastRiser, YS));
  cuts.push(x);
  return { body: out.join(''), cuts };
}

/** Coupe le dessin en feuilles, chaque coupure tombant entre deux colonnes. */
function unifilairePages(p: Project, b: Board, main: boolean): string[] {
  const { body, cuts } = unifilaire(p, b, main);
  const end = Math.max(...cuts), pages: string[] = [];
  for (let s = 0; s < end;) {
    const fit = cuts.filter(c => c > s && c - s <= AW);
    const e = fit.length ? Math.max(...fit) : s + AW;
    pages.push(`<svg x="${AX}" y="${AY}" width="${e - s}" height="${AH}" viewBox="${s} 0 ${e - s} ${AH}">${body}</svg>`);
    s = e;
  }
  return pages;
}

const fmtM = (m: number) => `${m.toFixed(2).replace('.', ',')} m`;

function shapes(pl: Plan): string {
  const T = wallT(pl);
  return `<g class="shapes" stroke-width="${T / 6}">` + pl.shapes.map((s, i) => {
    const p = s.pts.map(Number);
    const [ax, ay, bx, by] = p, L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L;
    let body: string;
    if (s.t === 'wall') body = `<polyline points="${p.join(' ')}" stroke-width="${T}"/>`;
    else if (s.t === 'line') body = `<polyline points="${p.join(' ')}" stroke-width="${T / 8}"/>`;
    else if (s.t === 'text') body = `<text class="mid" transform="translate(${ax} ${ay}) scale(${T / 5})">${esc(s.s)}</text>`;
    else if (s.t === 'dim') {
      // Cote : ligne avec traits obliques aux extrémités et longueur réelle au milieu.
      const o = T * 0.6, label = pl.cm ? fmtM(L * pl.cm / 100) : '?';
      const angle = Math.atan2(by - ay, bx - ax) * 180 / Math.PI, up = angle > 90 || angle < -90 ? angle + 180 : angle;
      body = `<path d="M${ax} ${ay}L${bx} ${by}M${ax - o} ${ay + o}L${ax + o} ${ay - o}M${bx - o} ${by + o}L${bx + o} ${by - o}"/>` +
        `<text class="mid" transform="translate(${(ax + bx) / 2 - nx * T} ${(ay + by) / 2 - ny * T}) rotate(${up}) scale(${T / 6})">${esc(label)}</text>`;
    } else if (s.t === 'stairs') {
      // Escalier : marches de 25 cm perpendiculaires au plus long côté, flèche de montée au milieu.
      const x1 = Math.min(ax, bx), y1 = Math.min(ay, by), w = Math.abs(bx - ax), h = Math.abs(by - ay);
      const step = pl.cm ? 25 / pl.cm : Math.max(w, h) / 12, horiz = w >= h;
      let d = '';
      for (let k = step; k < (horiz ? w : h); k += step) d += horiz ? `M${x1 + k} ${y1}V${y1 + h}` : `M${x1} ${y1 + k}H${x1 + w}`;
      const [sx, sy, ex, ey] = horiz ? [x1, y1 + h / 2, x1 + w, y1 + h / 2] : [x1 + w / 2, y1 + h, x1 + w / 2, y1];
      const a = T * 0.8, [ux, uy] = horiz ? [1, 0] : [0, -1];
      body = `<rect x="${x1}" y="${y1}" width="${w}" height="${h}"/><path d="${d}"/>` +
        `<path d="M${sx} ${sy}L${ex} ${ey}M${ex - ux * a - uy * a} ${ey - uy * a + ux * a}L${ex} ${ey}L${ex - ux * a + uy * a} ${ey - uy * a - ux * a}"/>`;
    } else {
      // Porte et fenêtre : on « efface » le mur sous l'ouverture a→b, puis on dessine le symbole.
      body = `<polyline class="mask" points="${ax} ${ay} ${bx} ${by}" stroke-width="${T * 1.15}"/>`;
      if (s.t === 'door') body += `<path d="M${ax} ${ay}L${ax + nx * L} ${ay + ny * L}A${L} ${L} 0 0 0 ${bx} ${by}"/>`;
      else {
        const ox = nx * T / 2, oy = ny * T / 2;
        body += `<path d="M${ax + ox} ${ay + oy}L${bx + ox} ${by + oy}M${ax - ox} ${ay - oy}L${bx - ox} ${by - oy}M${ax} ${ay}L${bx} ${by}` +
          `M${ax + ox} ${ay + oy}L${ax - ox} ${ay - oy}M${bx + ox} ${by + oy}L${bx - ox} ${by - oy}"/>`;
      }
    }
    return `<g data-shape="${i}">${body}</g>`;
  }).join('') + '</g>';
}

/** Facteur unités du plan → unités de la feuille. */
const planFit = (pl: Plan) => Math.min(AW / pl.w, AH / pl.h);

function planBody(p: Project, pl: Plan, selected?: string): string {
  const f = planFit(pl), k = 0.8 / f, T = wallT(pl);
  const nums = new Map(points(p).map(([n, , d]) => [d.id, { n, d }]));
  // Liaisons de commande : courbe en pointillés entre deux points reportés sur ce plan.
  const pos = new Map(pl.marks.map(m => [m.id, m]));
  const links = p.links.map(([a, b], i) => {
    const A = pos.get(a), B = pos.get(b);
    if (!A || !B) return '';
    const dx = +B.x - +A.x, dy = +B.y - +A.y;
    const d = `M${+A.x} ${+A.y}Q${(+A.x + +B.x) / 2 - dy * 0.2} ${(+A.y + +B.y) / 2 + dx * 0.2} ${+B.x} ${+B.y}`;
    return `<g data-link="${i}"><path class="link-hit" d="${d}" stroke-width="${T * 1.5}"/><path class="link" d="${d}" stroke-dasharray="${T} ${T / 2}"/></g>`;
  }).join('');
  const marks = pl.marks.map(m => {
    const it = nums.get(m.id);
    return it ? `<g class="mark${m.id === selected ? ' sel' : ''}" data-id="${esc(m.id)}" transform="translate(${+m.x} ${+m.y}) scale(${k})">` +
      `<rect class="hit" x="-16" y="-16" width="32" height="32"/>${g(0, -20, symbol(it.d.kind).svg)}${text(15, -10, it.n, 'bold')}</g>` : '';
  }).join('');
  const board = pl.board.length === 2 ? g(pl.board[0], pl.board[1], `<rect x="-20" y="-10" width="40" height="20"/><path class="fill" d="M-20 10L20 -10L20 10Z"/>${text(24, 4, t('Tableau'), 'bold')}`, ` scale(${k})`) : '';
  return `<g class="plan-area" transform="translate(${AX + (AW - pl.w * f) / 2} ${AY + (AH - pl.h * f) / 2}) scale(${f})">` +
    (pl.image ? `<image href="${esc(pl.image)}" width="${+pl.w}" height="${+pl.h}"/>` : '') + shapes(pl) +
    `<g class="links" stroke-width="${T / 5}">${links}</g>` + board + marks + '</g>';
}

/** Échelle d'impression du plan (1:n), 0 si inconnue. Une unité de feuille vaut 0,25 mm. */
export const planScale = (pl: Plan) => pl.cm ? Math.round(pl.cm * 40 / planFit(pl)) : 0;

/** Fiche de mesures pour l'organisme de contrôle. */
function measuresBody(p: Project): string {
  const m = p.measures, out: string[] = [];
  let y = AY + 40;
  const row = (label: string, value: string, limit = '') => {
    out.push(text(AX + 20, y, label), text(AX + 520, y, value || '…………', 'bold'), text(AX + 760, y, limit, 'small'), line(AX + 20, y + 8, AX + AW - 20, y + 8));
    y += 30;
  };
  out.push(text(AX + 20, y, t('Fiche de mesures'), 'ct-t'), text(AX + 520, y, t('Valeur mesurée'), 'ct-l'), text(AX + 760, y, t('Limite indicative'), 'ct-l'));
  y += 34;
  row(t('Résistance de dispersion de la prise de terre'), m.earth && `${m.earth} Ω`, '≤ 30 Ω');
  row(t("Résistance d'isolement"), m.insulation && `${m.insulation} MΩ`);
  row(t('Continuité des liaisons équipotentielles'), m.continuity);
  y += 10;
  out.push(text(AX + 20, y, t('Essai des différentiels'), 'bold'));
  y += 26;
  for (const r of allRcds(p).filter(r => r.sensitivity))
    row(t('Différentiel {r}', { r: `${rcdName(r)} ${r.type} ${r.poles}` }), [r.tripMa && `${r.tripMa} mA`, r.tripMs && `${r.tripMs} ms`].filter(Boolean).join(' · '), `≤ ${r.sensitivity} mA · ≤ 300 ms`);
  y += 10;
  row(t('Appareil de mesure'), m.instrument);
  wrap(m.notes, 120, 4).forEach((s, i) => out.push(text(AX + 20, y + 10 + i * 16, i ? s : `${t('Remarques')} : ${s}`)));
  return out.join('');
}

/** Toutes les feuilles A4 du projet, numérotées en folios : unifilaires, plans, puis mesures si elles sont remplies. */
export function renderSheets(p: Project, selected?: string): { uni: string[]; plans: string[]; measures: string[] } {
  const boards = allBoards(p);
  const uni = boards.flatMap((b, i) => unifilairePages(p, b, !i).map(body => [i ? `${t('Schéma unifilaire')} – ${b.name}` : t('Schéma unifilaire'), body]));
  const hasMeasures = Object.values(p.measures).some(Boolean) || allRcds(p).some(r => r.tripMa || r.tripMs);
  const total = uni.length + p.plans.length + (hasMeasures ? 1 : 0);
  return {
    uni: uni.map(([name, body], i) => frame(p, name, `${i + 1}/${total}`, body)),
    plans: p.plans.map((pl, i) => frame(p, `${t('Plan de position')} – ${pl.name}${planScale(pl) ? ` (1:${planScale(pl)})` : ''}`,
      `${uni.length + i + 1}/${total}`, planBody(p, pl, selected), 'plan')),
    measures: hasMeasures ? [frame(p, t('Fiche de mesures'), `${total}/${total}`, measuresBody(p))] : [],
  };
}

/** Étiquettes à découper pour les rangées DIN du tableau (18 mm par module, 13 modules par rangée). */
export function labelSheets(p: Project): string[] {
  const MOD = 72, H = 60, ROW_W = 13 * MOD, L = letters(p);
  return allBoards(p).map(b => {
    const items: { w: number; lines: string[] }[] = [];
    const head = (r: Rcd) => items.push({ w: modulesOf(r.poles), lines: r.sensitivity ? [`Diff ${r.sensitivity} mA`, `${r.rating} A`] : [t('Général {a} A', { a: r.rating }), r.poles] });
    const walk = (r: Rcd) => {
      head(r);
      for (const c of r.children) if (c.kind === 'rcd') walk(c);
        else items.push({ w: modulesOf(poles(c)), lines: [L.get(c)!, ...wrap(c.name, modulesOf(poles(c)) * 10, 2), `${c.curve}${c.breaker} A`] });
    };
    walk(b.root);
    const out = [text(AX, AY + 10, t('Étiquettes du tableau – {name}', { name: b.name }), 'ct-t')];
    let x = 0, y = AY + 40;
    for (const it of items) {
      const w = it.w * MOD;
      if (x + w > ROW_W) { x = 0; y += H + 20; }
      out.push(`<rect class="label" x="${AX + x}" y="${y}" width="${w}" height="${H}"/>`,
        ...it.lines.map((s, i) => text(AX + x + w / 2, y + 16 + i * 13, s, i ? 'small mid' : 'bold mid')));
      x += w;
    }
    return page(out.join(''));
  });
}
