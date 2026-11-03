import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  bom, cableRuns, check, cloneCircuit, labelSheets, letter, letters, newBlankPlan, newDevice, newRcd, phaseLoads, poles, protection, setNetwork,
  newProject, parseProject, points, prune, renderSheets, TEMPLATES, toCsv, voltageDrop, type Circuit,
} from './schema.js';
import { NL, setLang, t } from './i18n.js';
import { SYMBOLS } from './symbols.js';
import { dxfToPlan } from './dxf.js';

const IMG = 'data:image/png;base64,iVBORw0KGgo=';

test('lettres des circuits', () => {
  assert.deepEqual([0, 25, 26, 27, 701, 702].map(letter), ['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
});

test('numérotation des points', () => {
  const nums = points(newProject()).map(([n]) => n);
  assert.deepEqual(nums.slice(0, 5), ['A1', 'A2', 'A3', 'B1', 'B2']);
});

test('vérifications RGIE', () => {
  const p = newProject();
  assert.deepEqual(check(p), []);
  const c = p.root.children[0] as Circuit;
  c.breaker = 25;
  c.devices = Array.from({ length: 9 }, () => newDevice('prise'));
  (p.root.children[3] as Circuit).devices.push(newDevice('lumiere'));
  assert.deepEqual(check(p), [
    'Circuit A : disjoncteur 25 A trop élevé pour 1.5 mm² (max 16 A)',
    'Circuit A : 9 points de prises (max 8)',
    "Circuit D : l'onduleur doit être sur un circuit dédié",
  ]);
});

test('report sur plan : points manquants et suppression', () => {
  const p = newProject();
  const all = points(p);
  p.plans.push({ name: 'Rez', image: IMG, w: 800, h: 600, cm: 0, board: [], marks: all.slice(1).map(([, , d]) => ({ id: d.id, x: 10, y: 10 })), shapes: [] });
  assert.match(check(p).at(-1)!, /^1 point\(s\) pas encore reporté\(s\) sur un plan : A1$/);
  (p.root.children[1] as Circuit).devices = [];
  prune(p);
  assert.equal(p.plans[0].marks.length, all.length - 1 - 3);
  const { plans } = renderSheets(p);
  assert.ok(plans[0].includes('Plan de position – Rez') && plans[0].includes('>2/2<'));
});

test('plan dessiné : murs, porte, fenêtre, texte', () => {
  const p = newProject();
  const pl = newBlankPlan('Étage');
  pl.shapes.push({ t: 'wall', pts: [0, 0, 500, 0, 500, 400] }, { t: 'door', pts: [100, 0, 190, 0] },
    { t: 'window', pts: [500, 100, 500, 220] }, { t: 'text', pts: [250, 200], s: 'Chambre <1>' });
  p.plans.push(pl);
  const [svg] = renderSheets(p).plans;
  assert.ok(svg.includes('Plan de position – Étage (1:100)'));
  assert.equal(svg.match(/data-shape=/g)?.length, 4);
  assert.ok(svg.includes('points="0 0 500 0 500 400"') && svg.includes('Chambre &#60;1&#62;') && !svg.includes('<image'));
  // Porte de 90 cm : battant perpendiculaire puis arc jusqu'à l'autre bord de l'ouverture.
  assert.ok(svg.includes('M100 0L100 90A90 90 0 0 0 190 0'));
  assert.deepEqual(parseProject(JSON.stringify(p)).plans[0].shapes, pl.shapes);
});

test('triphasé : pôles, changement de réseau, répartition et vérifications', () => {
  const p = newProject();
  const [light, sockets, hob] = p.root.children as Circuit[];
  assert.deepEqual([light, sockets, hob].map(poles), ['1P+N', '1P+N', '4P']);
  const I = phaseLoads(p)!;
  assert.equal(I.L1.toFixed(2), (500 / 230 + 2300 / 230 + 7400 / (Math.sqrt(3) * 400)).toFixed(2));
  assert.deepEqual(check(p), []);

  hob.cable = 'XVB 3G2,5';
  sockets.devices.push(newDevice('prise_tri'));
  sockets.power = 20000;
  assert.deepEqual(check(p), [
    'Circuit B : prise triphasée sur un circuit monophasé',
    'Circuit C : câble XVB 3G2,5 insuffisant en 4P (5 conducteurs, terre comprise)',
    `Phases déséquilibrées : ${Object.entries(phaseLoads(p)!).map(([k, a]) => `${k} ${a.toFixed(1)} A`).join(' · ')}`,
  ]);

  setNetwork(p, '3 × 230 V');
  assert.deepEqual([light.phase, hob.phase, poles(light), poles(hob)], ['L1-L2', '3P', '2P', '3P']);
  setNetwork(p, '2 × 230 V');
  assert.ok(letters(p).size && [...letters(p).keys()].every(c => c.phase === '' && poles(c) === '2P'));
  assert.equal(phaseLoads(p), null);
  hob.phase = '3P+N';
  assert.ok(check(p).some(w => w.startsWith('Circuit C : phase « 3P+N » impossible')));

  // Unifilaire : pôles affichés et un trait par conducteur actif (4 en 3N × 400 V).
  const tri = newProject();
  const [svg] = renderSheets(tri).uni;
  assert.ok(svg.includes('>1P+N<') && svg.includes('>4P<') && svg.includes('>L2<') && svg.includes('Diff 40 A 4P'));
  assert.equal(/<path d="(M\d+ \d+L\d+ \d+)+"\/>/.exec(svg)![0].match(/M/g)!.length, 4);
});

test('liaisons interrupteur → points lumineux', () => {
  const p = newProject();
  const [sw, l1, l2] = (p.root.children[0] as Circuit).devices;
  const pl = newBlankPlan('Rez');
  pl.marks = [{ id: sw.id, x: 100, y: 100 }, { id: l1.id, x: 400, y: 100 }];
  p.plans.push(pl);
  const [svg] = renderSheets(p).plans;
  assert.equal(svg.match(/data-link=/g)?.length, 1, 'seule la liaison dont les deux points sont sur ce plan est dessinée');
  assert.deepEqual(parseProject(JSON.stringify(p)).links, p.links);
  (p.root.children[0] as Circuit).devices = [sw, l1];
  prune(p);
  assert.deepEqual(p.links, [[sw.id, l1.id]]);
  assert.ok(l2);
});

test('cartouche : coordonnées installateur et logo', () => {
  const p = newProject();
  Object.assign(p, { installer: 'Élec SRL', installerAddress: 'Rue des Fils 12, 4000 Liège', installerPhone: '04 123 45 67', installerEmail: 'info@elec.be', installerVat: 'BE0123.456.789', logo: IMG });
  const [svg] = renderSheets(p).uni;
  for (const s of ['Élec SRL', 'Rue des Fils 12, 4000 Liège', '04 123 45 67  ·  info@elec.be', 'TVA / BCE BE0123.456.789', `href="${IMG}"`]) assert.ok(svg.includes(s), s);
  assert.throws(() => parseProject(JSON.stringify({ ...p, logo: 'javascript:alert(1)' })));
});

test('le rendu échappe le texte utilisateur', () => {
  const p = newProject();
  p.title = '<script>';
  const [svg] = renderSheets(p).uni;
  assert.ok(svg.startsWith('<svg') && !svg.includes('<script>'));
});

test('unifilaire découpé en feuilles A4 entre deux colonnes', () => {
  const p = newProject();
  const one = renderSheets(p).uni;
  assert.equal(one.length, 1, '6 circuits tiennent sur une feuille');
  assert.ok(one[0].includes('>Schéma unifilaire<') && one[0].includes('>1/1<') && one[0].includes('>C20A<'));
  for (let i = 0; i < 20; i++) p.root.children.push({ ...(p.root.children[1] as Circuit) });
  const pages = renderSheets(p).uni;
  assert.equal(pages.length, 2);
  assert.ok(pages[1].includes('>2/2<'));
});

test('ouverture de fichier validée', () => {
  assert.throws(() => parseProject('{}'));
  assert.throws(() => parseProject('{"title":"x","root":{"kind":"rcd","children":[{"kind":"circuit"}]}}'));
  const bad = { ...newProject(), plans: [{ name: 'x', image: 'data:image/png;base64,"><script>', w: 1, h: 1, marks: [] }] };
  assert.throws(() => parseProject(JSON.stringify(bad)));
  const p = newProject();
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  // anciens fichiers : champs absents complétés
  const old = JSON.parse(JSON.stringify(p));
  delete old.plans; delete old.client; delete old.root.children[0].devices[0].id; delete old.root.children[0].curve;
  const fixed = parseProject(JSON.stringify(old));
  const c0 = fixed.root.children[0] as Circuit;
  assert.ok(fixed.plans && fixed.client === '' && c0.devices[0].id && c0.curve === 'C');
  assert.throws(() => parseProject(JSON.stringify({ ...p, boards: [{ name: 'x', root: { kind: 'circuit' } }] })));
});

test('modèles de circuits, duplication', () => {
  const p = newProject();
  for (const [name, make] of TEMPLATES) {
    const c = make(p);
    assert.ok(c.devices.length && phasesOfOk(p, c), name);
  }
  const hob = TEMPLATES.find(([n]) => n === 'Taque')![1];
  assert.equal(hob(p).phase, '3P+N');
  setNetwork(p, '2 × 230 V');
  assert.deepEqual([hob(p).phase, hob(p).cable, hob(p).breaker], ['', 'XVB 3G6', 32]);
  const a = p.root.children[0] as Circuit, b = cloneCircuit(a);
  assert.ok(b.devices.every((d, i) => d.id !== a.devices[i].id && d.kind === a.devices[i].kind));
});
// Un circuit seul déséquilibre forcément les phases : on ignore cette alerte-là.
const phasesOfOk = (p: ReturnType<typeof newProject>, c: Circuit) =>
  check({ ...p, root: { ...newRcd('4P', 30), children: [c] }, boards: [], links: [] }).filter(w => !w.startsWith('Phases')).length === 0;

test('tableau divisionnaire : lettres suivies, protection héritée, feuille dédiée', () => {
  const p = newProject();
  const feeder = TEMPLATES.find(([n]) => n === 'Tableau divisionnaire')![1](p);
  p.root.children.push(feeder);
  const sub = { name: 'Garage', feed: feeder.devices[0].id, root: { ...newRcd('2P', 0, 25), children: [{ ...TEMPLATES[1][1](p), power: 0 }] } };
  p.boards.push(sub);
  const L = letters(p);
  assert.equal(L.get(feeder), 'G');
  assert.equal(L.get(sub.root.children[0] as Circuit), 'H');
  assert.equal(protection(p).get(sub.root.children[0] as Circuit), 300, 'protégé par le 300 mA du tableau principal');
  const uni = renderSheets(p).uni;
  assert.equal(uni.length, 2);
  assert.ok(uni[1].includes('Schéma unifilaire – Garage') && uni[1].includes('Alimenté par G1') && uni[1].includes('Général 25 A'));
  assert.deepEqual(check(p), []);
  sub.feed = '';
  assert.ok(check(p).includes("Garage : point d'alimentation non choisi"));
  assert.deepEqual(parseProject(JSON.stringify(p)).boards[0].root, sub.root);
});

test('pièces : salle de bain et appareils sous 30 mA', () => {
  const p = newProject();
  const sockets = p.root.children[1] as Circuit;
  sockets.devices[0].room = 'Salle de bain';
  sockets.devices.push(newDevice('lave_vaisselle'));
  assert.deepEqual(check(p), ['Point B1 (Salle de bain) sans différentiel 30 mA', 'Point B4 (Lave-vaisselle) sans différentiel 30 mA']);
});

test('longueurs de câble, chute de tension et matériel', () => {
  const p = newProject();
  const light = p.root.children[0] as Circuit;
  const pl = newBlankPlan('Rez');
  pl.board = [0, 0];
  pl.marks = light.devices.map((d, i) => ({ id: d.id, x: 300 * (i + 1), y: 400 }));
  p.plans.push(pl);
  // 900 cm en X + 400 cm en Y = 13 m, plus 1,5 m par point.
  const run = cableRuns(p).get(light)!;
  assert.equal(run.m, 13 + 4.5);
  assert.equal(run.drop.toFixed(3), (2 * 0.0225 * 17.5 * (500 / 230) / 1.5 / 230 * 100).toFixed(3));
  assert.ok(!check(p).some(w => w.includes('chute de tension')));
  // 3000 W et dernier point à l'autre bout de la maison : 46,5 m → environ 7,9 %.
  light.power = 3000;
  pl.marks[2] = { ...pl.marks[2], x: 2700, y: 1500 };
  assert.equal(cableRuns(p).get(light)!.m, 46.5);
  assert.ok(voltageDrop(p, light, 46.5) > 5 && check(p).some(w => w.startsWith('Circuit A : chute de tension estimée 7.9 %')));

  const rows = bom(newProject());
  const find = (item: string) => rows.find(r => r[1] === item);
  assert.deepEqual(find('C20A 1P+N 3 kA')?.slice(2), ['4', 'pc']);
  assert.deepEqual(find('40 A 300 mA Type A 4P')?.slice(2), ['1', 'pc']);
  assert.deepEqual(find('Prise avec terre')?.slice(2), ['6', 'pc'], 'compte les prises doubles et triples');
  assert.deepEqual(find('Modules DIN (18 mm)')?.slice(2), ['17', 'modules']);
  assert.equal(toCsv([['a;b', 'c"d']]), '﻿"a;b";"c""d"');
});

test('plan : cotes, escalier, échelle, tableau et import DXF', () => {
  const p = newProject();
  const pl = newBlankPlan('Rez');
  pl.shapes.push({ t: 'dim', pts: [0, 0, 345, 0] }, { t: 'stairs', pts: [0, 0, 300, 100] });
  pl.board = [10, 10];
  p.plans.push(pl);
  const [svg] = renderSheets(p).plans;
  assert.ok(svg.includes('3,45 m') && svg.includes('>Tableau<'));
  assert.equal((svg.match(/M\d+ 0V100/g) ?? []).length, 11, 'marches de 25 cm');

  const dxf = dxfToPlan({ header: { $INSUNITS: 4 }, entities: [
    { type: 'LWPOLYLINE', shape: true, vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 3000 }, { x: 0, y: 3000 }] },
    { type: 'TEXT', startPoint: { x: 2500, y: 1500 }, text: 'Séjour' },
    { type: 'ARC', center: { x: 0, y: 0 }, radius: 900, startAngle: 0, endAngle: Math.PI / 2 },
  ] }, 'Archi');
  assert.deepEqual([dxf.w, dxf.h, dxf.cm], [600, 400, 1], '5 × 3 m en mm + marges de 50 cm');
  assert.deepEqual(dxf.shapes[0].pts.slice(0, 4), [50, 350, 550, 350], 'Y retourné');
  assert.deepEqual(dxf.shapes[1], { t: 'text', pts: [300, 200], s: 'Séjour' });
  assert.throws(() => dxfToPlan({ entities: [] }, 'vide'));
});

test('mesures : fiche et vérifications', () => {
  const p = newProject();
  assert.equal(renderSheets(p).measures.length, 0, 'pas de fiche tant que rien n\'est mesuré');
  p.measures.earth = '45';
  p.root.tripMa = '320';
  p.root.tripMs = '120';
  const s = renderSheets(p);
  assert.ok(s.measures[0].includes('45 Ω') && s.measures[0].includes('320 mA · 120 ms') && s.measures[0].includes('>2/2<'));
  assert.deepEqual(check(p), ['Différentiel 40 A 300 mA : déclenche à 320 mA (> 300 mA)', 'Prise de terre 45 Ω (> 30 Ω)']);
});

test('étiquettes du tableau', () => {
  const [sheet] = labelSheets(newProject());
  assert.equal(sheet.match(/class="label"/g)?.length, 8, '2 différentiels + 6 circuits');
  assert.ok(sheet.includes('>Diff 300 mA<') && sheet.includes('>C16 A<') && sheet.includes('>Taque<'));
});

test('traduction NL : chaque texte de l\'interface est traduit', () => {
  const src = path.join(import.meta.dirname, '../src'), html = readFileSync(path.join(import.meta.dirname, '../static/index.html'), 'utf8');
  const keys = new Set<string>();
  for (const f of readdirSync(src).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const code = readFileSync(path.join(src, f), 'utf8');
    for (const m of code.matchAll(/\b[t_]\((['"])((?:\\.|(?!\1).)*)\1/g)) keys.add(m[2].replace(/\\'/g, "'"));
  }
  for (const m of html.matchAll(/data-t="([^"]+)"/g)) keys.add(m[1]);
  for (const s of Object.values(SYMBOLS)) keys.add(s.label).add(s.group);
  const missing = [...keys].filter(k => !(k in NL));
  assert.deepEqual(missing, []);
  setLang('nl');
  try {
    assert.equal(t('Circuit {n} : {k} points de prises (max 8)', { n: 'A', k: 9 }), 'Kring A: 9 stopcontactpunten (max 8)');
    assert.ok(renderSheets(newProject()).uni[0].includes('>Eendraadschema<'));
  } finally {
    setLang('fr');
  }
});
