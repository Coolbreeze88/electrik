// Interface (processus renderer) : éditeur à gauche ; unifilaire, plans, matériel et mesures à droite.
import {
  allBoards, bom, cableRuns, check, cloneCircuit, esc, formatLoads, isTri, labelSheets, letters, newBlankPlan, newCircuit, newDevice, newProject,
  newRcd, parseProject, phaseLoads, PHASES, phasesOf, PH, points, poles, prune, PW, renderSheets, ROOMS, setNetwork, TEMPLATES, toCsv, wallT,
  type Circuit, type Plan, type Project, type Rcd, type Shape,
} from './schema.js';
import { SYMBOLS, symbol } from './symbols.js';
import { _, getLang, setLang, t, type Lang } from './i18n.js';
import { dxfToPlan } from './dxf.js';

declare global {
  interface Window {
    api: {
      save(json: string, path?: string): Promise<string | null>;
      open(): Promise<{ path: string; json: string } | null>;
      pdf(name: string): Promise<boolean>;
      saveText(name: string, content: string, ext: string): Promise<boolean>;
      autosave(json: string | null): Promise<void>;
      recover(): Promise<{ json: string; date: string } | null>;
      parseDxf(text: string): Promise<{ entities: any[]; header: Record<string, any> }>;
      setLang(lang: Lang): void;
    };
  }
}

const UNI = -1, BOM = -2, MEAS = -3; // vues spéciales ; 0 et plus = index du plan

let project: Project = newProject();
let filePath: string | undefined;
let dirty = false;
let view = UNI;
let selected: string | undefined; // point à reporter sur le plan
let tool = 'points'; // outil actif sur le plan
let pending: number[] = []; // clics en cours (mur, pièce, porte, fenêtre, cote…)
let history: string[] = []; // états précédents [dessins du plan affiché, liaisons] (Ctrl+Z)
let linkFrom: string | undefined; // premier point d'une liaison en cours
let drag: { id: string; g: SVGGElement; scale: string; at?: [number, number] } | undefined; // point déplacé
let shapeDrag: { i: number; g: SVGGElement; from: [number, number]; d?: [number, number] } | undefined; // élément dessiné déplacé
let dragged = false; // ignore le clic qui suit la fin d'un glisser
let zoom = { z: 1, cx: PW / 2, cy: PH / 2 }; // vue du plan à l'écran (unités de feuille)
let pan: { x: number; y: number; cx: number; cy: number } | undefined;
let space = false; // Espace enfoncé : glisser déplace la vue

const TOOLS = [['points', _('Points')], ['link', _('Liaison')], ['wall', _('Mur')], ['room', _('Pièce')], ['door', _('Porte')], ['window', _('Fenêtre')],
  ['stairs', _('Escalier')], ['text', _('Texte')], ['dim', _('Cote')], ['move', _('Déplacer')], ['erase', _('Gomme')], ['scale', _('Échelle')], ['board', _('Tableau')]];
const HINTS: Record<string, string> = {
  points: _('Cliquez sur un point de la liste puis sur le plan pour le poser. Faites glisser un symbole pour le déplacer, clic droit pour le retirer.'),
  link: _("Cliquez sur un interrupteur puis sur le point lumineux qu'il commande (répétez pour chaque point). La Gomme supprime une liaison."),
  wall: _('Cliquez chaque angle du mur. Double-clic, Entrée ou clic droit pour terminer.'),
  room: _('Cliquez deux coins opposés de la pièce.'),
  door: _("Cliquez la charnière puis l'autre côté de l'ouverture. L'ordre des clics choisit le sens d'ouverture."),
  window: _('Cliquez les deux extrémités de la fenêtre.'),
  stairs: _("Cliquez deux coins opposés de l'escalier ; la flèche monte dans le sens du plus long côté."),
  text: _('Tapez le texte puis cliquez sur le plan pour le placer.'),
  dim: _('Cliquez les deux extrémités de la cote.'),
  move: _('Faites glisser un mur, une porte, une fenêtre, un texte ou une cote pour le déplacer.'),
  erase: _('Cliquez sur un mur, une porte, une fenêtre, un texte ou une liaison pour le supprimer.'),
  scale: _("Tapez la longueur réelle (m) dans le champ texte, puis cliquez les deux extrémités d'une distance connue."),
  board: _("Cliquez à l'endroit du tableau : les longueurs de câble sont mesurées depuis ce point."),
};
const TWO_CLICKS = ['room', 'door', 'window', 'stairs', 'dim', 'scale'];

const $ = (id: string) => document.getElementById(id)!;
const editor = $('editor'), loads = $('loads'), tabs = $('tabs'), viewHead = $('view-head'), viewBody = $('view-body'), warnings = $('warnings'), fileLabel = $('file');
const get = (keys: string[]): any => keys.reduce((o: any, k) => o[k], project);

const txt = (path: string, label: string, v: string, attrs = '') =>
  `<label>${label} <input data-path="${path}" value="${esc(v)}" ${attrs}></label>`;
const num = (path: string, label: string, v: number | string, unit: string) =>
  `<label>${label} <input type="number" min="0" step="any" data-path="${path}" value="${esc(v)}"> ${unit}</label>`;
const btn = (act: string, path: string, label: string, title = label) =>
  `<button data-act="${act}" data-path="${path}" title="${title}">${label}</button>`;
const select = (path: string, options: string[][], v: string) => `<select data-path="${path}">${options.map(([k, l]) =>
  `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(l || '—')}</option>`).join('')}</select>`;

const groups = Object.entries(SYMBOLS).reduce<Record<string, [string, string][]>>((acc, [k, s]) => {
  (acc[s.group] ??= []).push([k, s.label]);
  return acc;
}, {});
const kindSelect = (path: string, kind: string) => `<select data-path="${path}" aria-label="${t('Type de point')}">${Object.entries(groups).map(([gr, items]) =>
  `<optgroup label="${t(gr)}">${items.map(([k, l]) => `<option value="${k}"${k === kind ? ' selected' : ''}>${t(l)}</option>`).join('')}</optgroup>`).join('')}</select>`;

function editCircuit(c: Circuit, p: string, n: string): string {
  const devices = c.devices.map((d, i) => `<li>
      <b>${n}${i + 1}</b> ${kindSelect(`${p}.devices.${i}.kind`, d.kind)}
      ${num(`${p}.devices.${i}.count`, '×', d.count, '')}
      ${txt(`${p}.devices.${i}.label`, '', d.label, `placeholder="${t('Nom')}"`)}
      ${txt(`${p}.devices.${i}.room`, '', d.room, `list="rooms" class="room" placeholder="${t('Pièce')}"`)}
      ${btn('remove', `${p}.devices.${i}`, '✕', t('Supprimer le point'))}
    </li>`).join('');
  return `<fieldset class="circuit"><legend>${t('Circuit {n}', { n })} ${btn('up', p, '↑', t('Monter'))}${btn('down', p, '↓', t('Descendre'))}${btn('dup', p, '⧉', t('Dupliquer le circuit'))}${btn('remove', p, '✕', t('Supprimer le circuit'))}</legend>
    ${txt(`${p}.name`, t('Nom'), c.name)} ${txt(`${p}.cable`, t('Câble'), c.cable)}<br>
    <label>${t('Disjoncteur')} <input class="short" data-path="${p}.curve" value="${esc(c.curve)}" aria-label="${t('Courbe')}"></label>
    ${num(`${p}.breaker`, '', c.breaker, 'A')} ${num(`${p}.ka`, '', c.ka, 'kA')} <span class="hint">${poles(c)}</span><br>
    ${isTri(project) ? `<label>${t('Phase')} ${select(`${p}.phase`, phasesOf(project).map(v => [v, v]), c.phase)}</label>` : ''}
    ${num(`${p}.power`, t('Puissance'), c.power, 'W')}
    <ol>${devices}</ol>${btn('device', p, t('+ Point'))}</fieldset>`;
}

function editRcd(r: Rcd, p: string, L: Map<Circuit, string>, head: '' | 'main' | 'sub'): string {
  const children = r.children.map((c, i) =>
    c.kind === 'rcd' ? editRcd(c, `${p}.children.${i}`, L, '') : editCircuit(c, `${p}.children.${i}`, L.get(c)!)).join('');
  const legend = head === 'main' ? t('Différentiel général') : head === 'sub' ? t('Différentiel') : `${t('Différentiel')} ${btn('remove', p, '✕', t('Supprimer le différentiel'))}`;
  return `<fieldset class="rcd"><legend>${legend}</legend>
    ${num(`${p}.rating`, t('Calibre'), r.rating, 'A')} ${num(`${p}.sensitivity`, t('Sensibilité'), r.sensitivity, 'mA')}
    ${head === 'sub' ? `<span class="hint">${t('0 = sans différentiel')}</span>` : ''}
    <label>${t('Type')} <input class="short" data-path="${p}.type" value="${esc(r.type)}"></label>
    ${select(`${p}.poles`, [['2P', '2P'], ['4P', '4P']], r.poles)}
    ${children}${btn('circuit', p, t('+ Circuit'))}
    <select data-tpl="${p}"><option value="">${t('+ Circuit type…')}</option>${TEMPLATES.map(([name], i) => `<option value="${i}">${t(name)}</option>`).join('')}</select>
    ${head ? btn('rcd', p, t('+ Différentiel')) : ''}</fieldset>`;
}

function editBoards(L: Map<Circuit, string>): string {
  const feeds = [['', '—'], ...points(project).filter(([, , d]) => d.kind === 'tableau').map(([n, , d]) => [d.id, `${n} ${d.label}`])];
  return project.boards.map((b, i) => `<fieldset class="board"><legend>${t('Tableau {name}', { name: esc(b.name) })} ${btn('remove', `boards.${i}`, '✕', t('Supprimer le tableau'))}</legend>
    ${txt(`boards.${i}.name`, t('Nom'), b.name)} <label>${t('Alimenté par')} ${select(`boards.${i}.feed`, feeds, b.feed)}</label>
    ${editRcd(b.root, `boards.${i}.root`, L, 'sub')}</fieldset>`).join('');
}

/** Chemins de tous les différentiels (pour la saisie des essais). */
function rcdPaths(): [string, Rcd][] {
  const res: [string, Rcd][] = [];
  const walk = (r: Rcd, path: string) => {
    res.push([path, r]);
    r.children.forEach((c, i) => { if (c.kind === 'rcd') walk(c, `${path}.children.${i}`); });
  };
  walk(project.root, 'root');
  project.boards.forEach((b, i) => walk(b.root, `boards.${i}.root`));
  return res;
}

function drawTabs() {
  const tab = (v: number, label: string) => `<button data-view="${v}" class="${view === v ? 'on' : ''}">${esc(label)}</button>`;
  tabs.innerHTML = [tab(UNI, t('Schéma unifilaire')), ...project.plans.map((pl, i) => tab(i, pl.name)), tab(BOM, t('Matériel')), tab(MEAS, t('Mesures')),
    `<button data-cmd="blankPlan">${t('+ Plan vierge')}</button>`, `<button data-cmd="addPlan">${t('+ Importer un plan')}</button>`].join('');
}

function drawView() {
  drawTabs();
  if (view === BOM) return drawBom();
  const sheets = renderSheets(project, tool === 'link' ? linkFrom : selected);
  if (view === MEAS) {
    viewBody.innerHTML = `<div class="pages">${sheets.measures.join('')}</div>`;
    return;
  }
  if (view === UNI) { viewBody.innerHTML = `<div class="pages">${sheets.uni.join('')}</div>`; return; }
  const pl = project.plans[view];
  const placed = new Set(project.plans.flatMap(p => p.marks.map(m => m.id)));
  const all = points(project);
  const left = all.filter(([, , d]) => !placed.has(d.id)).length;
  viewBody.innerHTML = `<div class="plan-img">${sheets.plans[view]}</div>
    <div class="palette"><p>${t('{a}/{b} points reportés', { a: `<b>${all.length - left}</b>`, b: all.length })}${left ? '' : ' ✓'}</p>
    <p class="hint">${t(HINTS.points)}</p>
    <ul>${all.map(([n, , d]) => `<li data-id="${esc(d.id)}" class="${placed.has(d.id) ? 'done' : ''}${d.id === selected ? ' sel' : ''}">
      ${placed.has(d.id) ? '✓' : '○'} <b>${n}</b> ${t(symbol(d.kind).label)} ${esc(d.label)} <span class="hint">${esc(d.room)}</span></li>`).join('')}</ul></div>`;
  // Aides de dessin, uniquement à l'écran : grille de 1 m sur un plan à l'échelle, aperçu du tracé en cours.
  const svg = viewBody.querySelector<SVGSVGElement>('svg.plan')!, area = svg.querySelector('.plan-area')!;
  if (!pl.image && pl.cm) {
    const step = 100 / pl.cm;
    let d = '';
    for (let x = step; x < pl.w; x += step) d += `M${x} 0V${pl.h}`;
    for (let y = step; y < pl.h; y += step) d += `M0 ${y}H${pl.w}`;
    area.insertAdjacentHTML('afterbegin', `<path class="grid" d="${d}"/>`);
  }
  area.insertAdjacentHTML('beforeend', `<polyline class="preview" stroke-width="${wallT(pl) / 3}" points="${pending.join(' ')}"/>`);
  applyZoom(svg);
}

function drawBom() {
  const rows = bom(project), runs = cableRuns(project), L = letters(project);
  const byRoom = new Map<string, string[]>();
  for (const [n, , d] of points(project)) {
    const k = d.room || t('Sans pièce');
    byRoom.set(k, [...(byRoom.get(k) ?? []), `${n} ${t(symbol(d.kind).label)}${d.count > 1 ? ` ×${d.count}` : ''}`]);
  }
  viewBody.innerHTML = `<div class="report">
    <h3>${t('Liste de matériel')}</h3>
    <table><thead><tr><th>${t('Catégorie')}</th><th>${t('Désignation')}</th><th>${t('Quantité')}</th><th>${t('Unité')}</th></tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td${i === 2 ? ' class="num"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <h3>${t('Longueurs et chutes de tension')}</h3>
    ${runs.size ? `<table><thead><tr><th>${t('Circuit {n}', { n: '' })}</th><th>${t('Câble')}</th><th>${t('Longueur')}</th><th>${t('Chute de tension')}</th></tr></thead>
      <tbody>${[...runs].map(([c, r]) => `<tr class="${r.drop > 5 ? 'bad' : ''}"><td>${L.get(c)} ${esc(c.name)}</td><td>${esc(c.cable)}</td>
        <td class="num">${r.m.toFixed(1)} m</td><td class="num">${r.drop.toFixed(1)} %</td></tr>`).join('')}</tbody></table>`
      : `<p class="hint">${t("Placez le tableau et les points sur un plan à l'échelle pour calculer les longueurs.")}</p>`}
    <h3>${t('Points par pièce')}</h3>
    ${[...byRoom].map(([room, pts]) => `<p><b>${esc(room)}</b> : ${pts.map(esc).join(', ')}</p>`).join('')}</div>`;
}

function drawHead() {
  if (view === UNI) { viewHead.innerHTML = ''; return; }
  if (view === BOM) {
    viewHead.innerHTML = `<div class="tools"><button data-cmd="exportBom">${t('Exporter (Excel / CSV)')}</button>
      <button data-cmd="labels">${t('Étiquettes du tableau (PDF)')}</button></div>`;
    return;
  }
  if (view === MEAS) {
    const m = (k: string, label: string, unit = '') => `<label>${t(label)} <input data-path="measures.${k}" value="${esc((project.measures as any)[k])}" ${unit ? 'class="short2"' : ''}> ${unit}</label>`;
    viewHead.innerHTML = `<div class="measures">
      ${m('earth', 'Résistance de dispersion de la prise de terre', 'Ω')} ${m('insulation', "Résistance d'isolement", 'MΩ')}
      ${m('continuity', 'Continuité des liaisons équipotentielles')} ${m('instrument', 'Appareil de mesure')}<br>
      <b>${t('Essai des différentiels')}</b> :
      ${rcdPaths().filter(([, r]) => r.sensitivity).map(([path, r]) => `<span class="rcd-test">${r.rating} A ${r.sensitivity} mA :
        <input class="short2" data-path="${path}.tripMa" value="${esc(r.tripMa)}" aria-label="${t('Courant de déclenchement')}"> mA
        <input class="short2" data-path="${path}.tripMs" value="${esc(r.tripMs)}" aria-label="${t('Temps de déclenchement')}"> ms</span>`).join('')}<br>
      ${m('notes', 'Remarques')}</div>`;
    return;
  }
  viewHead.innerHTML = `<div class="tools">${TOOLS.map(([k, l]) => `<button data-tool="${k}" class="${tool === k ? 'on' : ''}">${t(l)}</button>`).join('')}
      <input id="plan-text" placeholder="${t('Texte à placer')}" aria-label="${t('Texte à placer')}">
      <button data-cmd="undo" title="Ctrl+Z">${t('Annuler')}</button> <button data-cmd="zoomReset">${t('Zoom 100 %')}</button>
      <span class="sep"></span>${txt(`plans.${view}.name`, t('Nom du plan'), project.plans[view].name)}
      ${btn('remove', `plans.${view}`, t('Supprimer ce plan'))}</div>
    <p class="hint"><span id="tool-hint">${t(HINTS[tool])}</span> · ${t('Molette : zoom · bouton du milieu ou Espace + glisser : déplacer la vue.')}</p>`;
}

function setTool(tl: string) {
  tool = tl;
  pending = [];
  linkFrom = undefined;
  viewHead.querySelectorAll<HTMLElement>('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tl));
  $('tool-hint').textContent = t(HINTS[tl]);
  drawView();
}

function setView(v: number) {
  view = v;
  selected = undefined;
  pending = [];
  history = [];
  zoom = { z: 1, cx: PW / 2, cy: PH / 2 };
  draw(true);
}

function draw(full: boolean) {
  if (full) {
    const L = letters(project);
    editor.innerHTML = `<fieldset><legend>${t('Projet')}</legend>
      ${txt('title', t('Titre'), project.title)} ${txt('client', t('Propriétaire'), project.client)}
      ${txt('address', t('Adresse installation'), project.address)}
      ${txt('inspector', t('Organisme de contrôle'), project.inspector)}
      <label>${t('Date')} <input type="date" data-path="date" value="${esc(project.date)}"></label>
      <label>${t('Réseau')} <select data-net>${Object.keys(PHASES).map(n => `<option${n === project.network ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      ${num('mainBreaker', t('Disjoncteur de branchement'), project.mainBreaker, 'A')}</fieldset>
    <fieldset><legend>${t('Installateur (cartouche)')}</legend>
      ${txt('installer', t('Nom / société'), project.installer)} ${txt('installerAddress', t('Adresse'), project.installerAddress)}
      ${txt('installerPhone', t('Téléphone'), project.installerPhone)} ${txt('installerEmail', t('E-mail'), project.installerEmail)}
      ${txt('installerVat', t('TVA / BCE'), project.installerVat)}<br>
      ${t('Logo :')} ${project.logo ? `<img class="logo" src="${esc(project.logo)}" alt="Logo"> <button data-cmd="removeLogo">${t('Retirer')}</button>` : ''}
      <button data-cmd="chooseLogo">${project.logo ? t('Changer') : t('Choisir une image')}</button></fieldset>
    <h4>${t('Tableau principal')}</h4>
    ${editRcd(project.root, 'root', L, 'main')}
    ${editBoards(L)}`;
    const rooms = new Set([...ROOMS.map(r => t(r)), ...points(project).map(([, , d]) => d.room).filter(Boolean)]);
    $('rooms').innerHTML = [...rooms].map(r => `<option value="${esc(r)}">`).join('');
    drawHead();
  }
  drawView();
  warnings.innerHTML = check(project).map(w => `<li>${esc(w)}</li>`).join('');
  const I = phaseLoads(project);
  loads.textContent = I ? t('Répartition prévue : {v}', { v: formatLoads(I) }) : '';
  fileLabel.textContent = (filePath ?? t('Nouveau projet')) + (dirty ? ' *' : '');
}

function changed(full: boolean) {
  dirty = true;
  draw(full);
}

document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.net !== undefined) { setNetwork(project, el.value); return changed(true); }
  if (el.dataset.tpl !== undefined) return addTemplate(el.dataset.tpl, Number(el.value));
  if (!el.dataset.path) return;
  const keys = el.dataset.path.split('.');
  const last = keys.pop()!;
  get(keys)[last] = el.type === 'number' ? Number(el.value) : el.value;
  // Les pôles affichés dans l'éditeur dépendent de la phase ; le choix des différentiels à tester dépend des sensibilités.
  changed(last === 'phase' || last === 'kind' || (view === MEAS && last === 'sensitivity'));
});

function addTemplate(path: string, i: number) {
  const [name, make] = TEMPLATES[i];
  const c = make(project);
  get(path.split('.')).children.push(c);
  // Un circuit « tableau divisionnaire » crée aussi le tableau qu'il alimente.
  if (name === 'Tableau divisionnaire')
    project.boards.push({ name: `${t('Tableau divisionnaire')} ${project.boards.length + 1}`, feed: c.devices[0].id, root: newRcd(poles(c) === '4P' ? '4P' : '2P', 0, c.breaker) });
  changed(true);
}

document.addEventListener('click', e => {
  const tg = e.target as HTMLElement;
  const b = tg.closest('button');
  if (b?.dataset.cmd) return void commands[b.dataset.cmd]();
  if (b?.dataset.view) return setView(Number(b.dataset.view));
  if (b?.dataset.tool) return setTool(b.dataset.tool);
  const item = tg.closest<HTMLElement>('.palette li');
  if (item) {
    selected = item.dataset.id === selected ? undefined : item.dataset.id;
    return tool === 'points' ? drawView() : setTool('points');
  }
  const plan = tg.closest<SVGSVGElement>('svg.plan');
  if (plan && dragged) { dragged = false; return; }
  if (plan) return tool === 'points' ? placeOnPlan(plan, e, tg) : drawOnPlan(plan, e, tg);
  if (!b?.dataset.path) return;
  const keys = b.dataset.path.split('.');
  const node = get(keys), parent = get(keys.slice(0, -1)), i = Number(keys.at(-1));
  switch (b.dataset.act) {
    case 'circuit': node.children.push({ ...newCircuit(), phase: phasesOf(project)[0] }); break;
    case 'rcd': node.children.push(newRcd(isTri(project) ? '4P' : '2P')); break;
    case 'device': node.devices.push(newDevice()); break;
    case 'dup': parent.splice(i + 1, 0, cloneCircuit(node)); break;
    case 'up': case 'down': {
      const j = b.dataset.act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= parent.length) return;
      [parent[i], parent[j]] = [parent[j], parent[i]];
      break;
    }
    case 'remove':
      if (!('count' in node) && !confirm(t('Supprimer cet élément et tout son contenu ?'))) return;
      parent.splice(i, 1);
      prune(project);
      if (keys[0] === 'plans') { dirty = true; return setView(UNI); }
  }
  changed(true);
});

/** Point cliqué en unités du plan, aimanté tous les 10 cm sur un plan à l'échelle ; undefined hors du plan (cadre, cartouche). */
function planPoint(svg: SVGSVGElement, e: MouseEvent): [number, number] | undefined {
  const area = svg.querySelector<SVGGElement>('.plan-area')!;
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(area.getScreenCTM()!.inverse());
  const pl = project.plans[view];
  if (pt.x < 0 || pt.y < 0 || pt.x > pl.w || pt.y > pl.h) return;
  const s = pl.cm && !pl.image ? 10 / pl.cm : 1;
  return [Math.round(pt.x / s) * s, Math.round(pt.y / s) * s];
}

function placeOnPlan(svg: SVGSVGElement, e: MouseEvent, tg: HTMLElement) {
  const mark = tg.closest<SVGGElement>('.mark');
  if (!selected) {
    if (mark) { selected = mark.dataset.id; drawView(); }
    return;
  }
  const pt = planPoint(svg, e);
  if (!pt) return;
  const pl = project.plans[view];
  const isNew = !project.plans.some(p => p.marks.some(m => m.id === selected));
  for (const p of project.plans) p.marks = p.marks.filter(m => m.id !== selected);
  pl.marks.push({ id: selected, x: pt[0], y: pt[1] });
  // Première pose : on enchaîne sur le prochain point non reporté pour ne rien oublier.
  const placed = new Set(project.plans.flatMap(p => p.marks.map(m => m.id)));
  selected = isNew ? points(project).find(([, , d]) => !placed.has(d.id))?.[2].id : undefined;
  changed(false);
}

// Zoom et déplacement de la vue du plan : on ne change que le viewBox affiché, jamais les données.
function applyZoom(svg: SVGSVGElement) {
  const w = PW / zoom.z, h = PH / zoom.z;
  svg.setAttribute('viewBox', `${zoom.cx - w / 2} ${zoom.cy - h / 2} ${w} ${h}`);
}

document.addEventListener('wheel', e => {
  const svg = (e.target as Element).closest<SVGSVGElement>('svg.plan');
  if (!svg) return;
  e.preventDefault();
  const at = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
  const z = Math.min(12, Math.max(1, zoom.z * (e.deltaY < 0 ? 1.25 : 0.8)));
  zoom = z === 1 ? { z, cx: PW / 2, cy: PH / 2 } : { z, cx: at.x + (zoom.cx - at.x) * zoom.z / z, cy: at.y + (zoom.cy - at.y) * zoom.z / z };
  applyZoom(svg);
}, { passive: false });

document.addEventListener('mousedown', e => {
  const tg = e.target as Element, svg = tg.closest<SVGSVGElement>('svg.plan');
  if (!svg) return;
  if (e.button === 1 || (e.button === 0 && space)) {
    e.preventDefault();
    pan = { x: e.clientX, y: e.clientY, cx: zoom.cx, cy: zoom.cy };
    return;
  }
  if (e.button !== 0) return;
  const mark = tg.closest<SVGGElement>('.mark'), shape = tg.closest<SVGGElement>('[data-shape]');
  if (mark && tool === 'points') {
    // Glisser-déposer d'un point déjà posé : on ne déplace que le symbole pendant le geste.
    e.preventDefault();
    drag = { id: mark.dataset.id!, g: mark, scale: /scale\([^)]*\)/.exec(mark.getAttribute('transform')!)![0] };
  } else if (shape && tool === 'move') {
    const from = planPoint(svg, e);
    if (from) { e.preventDefault(); shapeDrag = { i: Number(shape.dataset.shape), g: shape, from }; }
  }
});

document.addEventListener('mouseup', () => {
  if (pan) { pan = undefined; return; }
  if (drag) {
    const { id, at } = drag;
    drag = undefined;
    if (!at) return;
    dragged = true;
    const m = project.plans[view].marks.find(m => m.id === id)!;
    [m.x, m.y] = at;
    return changed(false);
  }
  if (shapeDrag) {
    const { i, d } = shapeDrag;
    shapeDrag = undefined;
    if (!d) return;
    dragged = true;
    remember();
    const s = project.plans[view].shapes[i];
    s.pts = s.pts.map((v, k) => v + d[k % 2]);
    changed(false);
  }
});

const remember = () => history.push(JSON.stringify([project.plans[view].shapes, project.links]));

function addShape(s: Shape) {
  remember();
  project.plans[view].shapes.push(s);
  changed(false);
}

function drawOnPlan(svg: SVGSVGElement, e: MouseEvent, tg: HTMLElement) {
  const pl = project.plans[view];
  if (tool === 'erase') {
    const sh = tg.closest<SVGGElement>('[data-shape]'), ln = tg.closest<SVGGElement>('[data-link]');
    if (!sh && !ln) return;
    remember();
    if (ln) project.links.splice(Number(ln.dataset.link), 1);
    else pl.shapes.splice(Number(sh!.dataset.shape), 1);
    return changed(false);
  }
  if (tool === 'link') {
    const id = tg.closest<SVGGElement>('.mark')?.dataset.id;
    if (!id || !linkFrom) { linkFrom = id; return drawView(); }
    if (id !== linkFrom && !project.links.some(l => l.includes(id) && l.includes(linkFrom!))) {
      remember();
      project.links.push([linkFrom, id]);
      linkFrom = undefined;
      return changed(false);
    }
    linkFrom = undefined;
    return drawView();
  }
  if (tool === 'move') return;
  const p = planPoint(svg, e);
  if (!p) return;
  const text = ($('plan-text') as HTMLInputElement).value.trim();
  if (tool === 'board') { pl.board = p; return changed(false); }
  if (tool === 'text') return text ? addShape({ t: 'text', pts: p, s: text }) : alert(t("Tapez d'abord le texte à placer."));
  if (tool === 'scale' && !(Number(text.replace(',', '.')) > 0)) return alert(t('Tapez la longueur réelle en mètres dans le champ texte.'));
  if (tool === 'wall') { pending.push(...p); return drawView(); }
  if (!pending.length) { pending = p; return drawView(); }
  const [x1, y1] = pending, [x2, y2] = p;
  pending = [];
  if (tool === 'scale') {
    pl.cm = Number(text.replace(',', '.')) * 100 / (Math.hypot(x2 - x1, y2 - y1) || 1);
    return changed(true);
  }
  addShape(tool === 'room' ? { t: 'wall', pts: [x1, y1, x2, y1, x2, y2, x1, y2, x1, y1] } : { t: tool as Shape['t'], pts: [x1, y1, x2, y2] });
}

/** Termine le mur en cours (les doubles clics ajoutent des points en double, on les retire). */
function finishWall() {
  const pts: number[] = [];
  for (let i = 0; i < pending.length; i += 2)
    if (pending[i] !== pts.at(-2) || pending[i + 1] !== pts.at(-1)) pts.push(pending[i], pending[i + 1]);
  pending = [];
  if (pts.length >= 4) addShape({ t: 'wall', pts }); else drawView();
}

document.addEventListener('dblclick', () => { if (tool === 'wall' && pending.length) finishWall(); });

// Pendant un geste, on ne met à jour que l'élément concerné (aperçu, symbole, vue), pas tout le plan.
document.addEventListener('mousemove', e => {
  if (pan) {
    const svg = viewBody.querySelector<SVGSVGElement>('svg.plan');
    if (!svg) return;
    const k = svg.getScreenCTM()!.a;
    zoom.cx = pan.cx - (e.clientX - pan.x) / k;
    zoom.cy = pan.cy - (e.clientY - pan.y) / k;
    return applyZoom(svg);
  }
  if (drag) {
    const p = planPoint(drag.g.ownerSVGElement!, e);
    if (p) { drag.at = p; drag.g.setAttribute('transform', `translate(${p[0]} ${p[1]}) ${drag.scale}`); }
    return;
  }
  if (shapeDrag) {
    const p = planPoint(shapeDrag.g.ownerSVGElement!, e);
    if (p) { shapeDrag.d = [p[0] - shapeDrag.from[0], p[1] - shapeDrag.from[1]]; shapeDrag.g.setAttribute('transform', `translate(${shapeDrag.d.join(' ')})`); }
    return;
  }
  if (!pending.length || view < 0) return;
  const svg = (e.target as Element).closest<SVGSVGElement>('svg.plan');
  const p = svg && planPoint(svg, e);
  if (!p) return;
  const [x1, y1] = pending;
  const pts = tool === 'room' || tool === 'stairs' ? [x1, y1, p[0], y1, p[0], p[1], x1, p[1], x1, y1] : [...pending, ...p];
  svg.querySelector('.preview')!.setAttribute('points', pts.join(' '));
});

document.addEventListener('contextmenu', e => {
  if (view < 0) return;
  if (pending.length) { e.preventDefault(); return tool === 'wall' ? finishWall() : (pending = [], drawView()); }
  const mark = (e.target as Element).closest<SVGGElement>('.mark');
  if (!mark || tool !== 'points') return;
  e.preventDefault();
  const pl = project.plans[view];
  pl.marks = pl.marks.filter(m => m.id !== mark.dataset.id);
  changed(false);
});

function addPlan(pl: Plan) {
  project.plans.push(pl);
  dirty = true;
  tool = pl.image ? 'points' : 'wall';
  setView(project.plans.length - 1);
}

/** Chaque page du PDF devient un plan (image PNG d'environ 2400 px de large). */
async function importPdf(file: File, name: string) {
  const pdfjs: any = await import('../node_modules/pdfjs-dist/build/pdf.min.mjs' as string);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: Math.min(4, 2400 / page.getViewport({ scale: 1 }).width) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport, background: '#fff' }).promise;
    addPlan({ name: doc.numPages > 1 ? `${name} p.${i}` : name, image: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height, cm: 0, board: [], marks: [], shapes: [] });
  }
}

const planFile = $('plan-file') as HTMLInputElement;
planFile.addEventListener('change', () => {
  const file = planFile.files?.[0];
  planFile.value = '';
  if (!file) return;
  const name = file.name.replace(/\.[^.]+$/, '');
  if (file.type === 'application/pdf') return void importPdf(file, name).catch(() => alert(t('PDF illisible : {f}', { f: file.name })));
  if (/\.dxf$/i.test(file.name))
    return void file.text().then(window.api.parseDxf).then(dxf => addPlan(dxfToPlan(dxf, name))).catch(() => alert(t('DXF illisible : {f}', { f: file.name })));
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => addPlan({ name, image: reader.result as string, w: img.naturalWidth, h: img.naturalHeight, cm: 0, board: [], marks: [], shapes: [] });
    img.onerror = () => alert(t('Image illisible : {f}', { f: file.name }));
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
});

const logoFile = $('logo-file') as HTMLInputElement;
logoFile.addEventListener('change', () => {
  const file = logoFile.files?.[0];
  logoFile.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { project.logo = reader.result as string; changed(true); };
  reader.readAsDataURL(file);
});

/** Projet propre (enregistré, nouveau ou ouvert) : la sauvegarde automatique n'a plus lieu d'être. */
function clean(path: string | undefined) {
  filePath = path;
  dirty = false;
  window.api.autosave(null);
}

async function save(as = false) {
  const p = await window.api.save(JSON.stringify(project), as ? undefined : filePath);
  if (!p) return;
  clean(p);
  draw(false);
}

async function printPages(pages: string[], name: string) {
  $('print').innerHTML = pages.map(svg => `<div class="page">${svg}</div>`).join('');
  await window.api.pdf(name);
}

const commands: Record<string, () => unknown> = {
  new() {
    if (dirty && !confirm(t('Abandonner les modifications non enregistrées ?'))) return;
    project = newProject();
    clean(undefined);
    setView(UNI);
  },
  async open() {
    if (dirty && !confirm(t('Abandonner les modifications non enregistrées ?'))) return;
    const r = await window.api.open();
    if (!r) return;
    try {
      project = parseProject(r.json);
    } catch {
      return alert(t("Impossible d'ouvrir {f} : ce n'est pas un projet Electrik valide.", { f: r.path }));
    }
    clean(r.path);
    setView(UNI);
  },
  save: () => save(),
  saveAs: () => save(true),
  addPlan: () => planFile.click(),
  blankPlan: () => addPlan(newBlankPlan(t('Plan {n}', { n: project.plans.length + 1 }))),
  chooseLogo: () => logoFile.click(),
  removeLogo() { project.logo = ''; changed(true); },
  undo() {
    if (view < 0 || !history.length) return;
    [project.plans[view].shapes, project.links] = JSON.parse(history.pop()!);
    changed(false);
  },
  zoomReset() { zoom = { z: 1, cx: PW / 2, cy: PH / 2 }; drawView(); },
  help: () => ($('help') as HTMLDialogElement).showModal(),
  pdf() {
    const s = renderSheets(project);
    return printPages([...s.uni, ...s.plans, ...s.measures], project.title || 'schema');
  },
  labels: () => printPages(labelSheets(project), `${project.title || 'schema'} - ${t('Étiquettes du tableau (PDF)').replace(' (PDF)', '')}`),
  exportBom: () => window.api.saveText(`${project.title || 'schema'} - ${t('Matériel')}.csv`,
    toCsv([[t('Catégorie'), t('Désignation'), t('Quantité'), t('Unité')], ...bom(project)]), 'csv'),
};

addEventListener('keydown', e => {
  if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); save(e.shiftKey); }
  if (e.ctrlKey && e.key === 'o') { e.preventDefault(); commands.open(); }
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === ' ' && view >= 0) { e.preventDefault(); space = true; }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); commands.undo(); }
  if ((e.key === 'Enter' || e.key === 'Escape') && tool === 'wall' && pending.length) return finishWall();
  if (e.key === 'Escape' && pending.length) { pending = []; return drawView(); }
  if (e.key === 'Escape' && selected) { selected = undefined; drawView(); }
});
addEventListener('keyup', e => { if (e.key === ' ') space = false; });

// Le processus principal affiche la confirmation (événement will-prevent-unload).
addEventListener('beforeunload', e => { if (dirty) e.returnValue = false; });

// Sauvegarde automatique toutes les 20 s tant que des modifications ne sont pas enregistrées.
setInterval(() => { if (dirty) window.api.autosave(JSON.stringify({ path: filePath, project })); }, 20000);

// Langue : préférence de ce poste (localStorage), appliquée aux textes fixes de la page et à l'aide.
const langSelect = $('lang') as HTMLSelectElement;
function applyLang(l: Lang) {
  setLang(l);
  window.api.setLang(l);
  document.documentElement.lang = l;
  langSelect.value = l;
  document.querySelectorAll<HTMLElement>('[data-t]').forEach(el => { el.textContent = t(el.dataset.t!); });
  document.querySelectorAll<HTMLElement>('#help > div[lang]').forEach(el => { el.hidden = el.lang !== l; });
}
langSelect.addEventListener('change', () => {
  try { localStorage.setItem('lang', langSelect.value); } catch { /* préférence non conservée */ }
  applyLang(langSelect.value as Lang);
  draw(true);
});
let saved: string | null = null;
try { saved = localStorage.getItem('lang'); } catch { /* stockage indisponible */ }
applyLang(saved === 'nl' ? 'nl' : 'fr');
if (getLang() === 'nl') project = newProject(); // exemple créé dans la bonne langue

draw(true);

// Récupération d'un projet non enregistré (plantage, fermeture forcée).
window.api.recover().then(r => {
  if (!r) return;
  try {
    const saved = JSON.parse(r.json);
    if (!confirm(t('Un projet non enregistré du {d} a été retrouvé. Le récupérer ?', { d: new Date(r.date).toLocaleString(getLang()) }))) return window.api.autosave(null);
    project = parseProject(JSON.stringify(saved.project));
    filePath = saved.path ?? undefined;
    dirty = true;
    setView(UNI);
  } catch {
    window.api.autosave(null);
  }
});
