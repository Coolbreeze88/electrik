// Génère static/icon.png et les visuels du Microsoft Store (build/appx) depuis static/icon.svg.
// Lancer avec : npm run icons
import { app, BrowserWindow } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const svg = await readFile('static/icon.svg', 'utf8');
const BG = 'linear-gradient(135deg,#1e88e5,#0d2f6b)';

// [fichier, largeur, hauteur, taille de l'icône, fond, texte]
const icon = (file, n) => [file, n, n, n, null, false];
const tile = (file, w, h, s, text = false) => [file, w, h, s, BG, text];
const jobs = [icon('static/icon.png', 512)];
for (const sc of [100, 200]) {
  const k = sc / 100, a = name => `build/appx/${name}.scale-${sc}.png`;
  jobs.push(
    icon(a('StoreLogo'), 50 * k),
    icon(a('Square44x44Logo'), 44 * k),
    tile(a('Square150x150Logo'), 150 * k, 150 * k, 100 * k),
    tile(a('Wide310x150Logo'), 310 * k, 150 * k, 96 * k, true),
  );
}
// Icônes de la barre des tâches, sans plaque de couleur derrière.
for (const n of [16, 24, 32, 48, 256]) jobs.push(icon(`build/appx/Square44x44Logo.targetsize-${n}_altform-unplated.png`, n));

app.on('window-all-closed', () => {}); // ne pas quitter entre deux images
app.whenReady().then(async () => {
  await mkdir('build/appx', { recursive: true });
  for (const [file, w, h, s, bg, text] of jobs) {
    const win = new BrowserWindow({ width: w, height: h, show: false, frame: false, transparent: true, useContentSize: true });
    const body = `<body style="margin:0;width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;gap:${h / 12}px;background:${bg ?? 'transparent'};font:600 ${h / 5}px 'Segoe UI';color:#fff">`
      + svg.replace('<svg ', `<svg width="${s}" height="${s}" `) + (text ? 'Electrik' : '') + '</body>';
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(body));
    await new Promise(r => setTimeout(r, 200));
    await writeFile(file, (await win.capturePage({ x: 0, y: 0, width: w, height: h })).toPNG());
    win.destroy();
  }
  console.log(jobs.length, 'images');
  app.exit(0);
});
