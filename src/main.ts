import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import DxfParserModule from 'dxf-parser';
import updater from 'electron-updater';

// Textes des boîtes de dialogue natives, selon la langue choisie dans l'interface.
const TEXTS = {
  fr: { project: 'Projet Electrik', leave: 'Quitter sans enregistrer', cancel: 'Annuler', unsaved: 'Des modifications ne sont pas enregistrées.' },
  nl: { project: 'Electrik-project', leave: 'Afsluiten zonder opslaan', cancel: 'Annuleren', unsaved: 'Er zijn niet-opgeslagen wijzigingen.' },
};
let tx = TEXTS.fr;
const filters = () => [{ name: tx.project, extensions: ['elk'] }];
const autosaveFile = () => path.join(app.getPath('userData'), 'autosave.json');

Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1400, height: 900, title: 'Electrik', icon: path.join(import.meta.dirname, '../static/icon.png'),
    webPreferences: { preload: path.join(import.meta.dirname, '../static/preload.cjs') },
  });
  win.loadFile(path.join(import.meta.dirname, '../static/index.html'));

  win.webContents.on('will-prevent-unload', e => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question', buttons: [tx.leave, tx.cancel], defaultId: 1, cancelId: 1, message: tx.unsaved,
    });
    if (choice === 0) e.preventDefault();
  });

  ipcMain.on('lang', (_e, l: keyof typeof TEXTS) => { tx = TEXTS[l] ?? TEXTS.fr; });

  ipcMain.handle('save', async (_e, json: string, file?: string) => {
    file ||= (await dialog.showSaveDialog(win, { filters: filters() })).filePath;
    if (!file) return null;
    await writeFile(file, json, 'utf8');
    return file;
  });

  ipcMain.handle('open', async () => {
    const r = await dialog.showOpenDialog(win, { filters: filters(), properties: ['openFile'] });
    if (r.canceled) return null;
    return { path: r.filePaths[0], json: await readFile(r.filePaths[0], 'utf8') };
  });

  ipcMain.handle('pdf', async (_e, name: string) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: `${name}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (!r.filePath) return false;
    // Le cadre de chaque feuille contient déjà ses marges.
    await writeFile(r.filePath, await win.webContents.printToPDF({ landscape: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } }));
    return true;
  });

  ipcMain.handle('saveText', async (_e, name: string, content: string, ext: string) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (!r.filePath) return false;
    await writeFile(r.filePath, content, 'utf8');
    return true;
  });

  // Sauvegarde automatique : un seul fichier dans le dossier de l'application, effacé dès qu'on enregistre.
  ipcMain.handle('autosave', async (_e, json: string | null) => {
    if (json === null) await rm(autosaveFile(), { force: true });
    else await writeFile(autosaveFile(), json, 'utf8');
  });
  ipcMain.handle('recover', async () => {
    try {
      return { json: await readFile(autosaveFile(), 'utf8'), date: (await stat(autosaveFile())).mtime.toISOString() };
    } catch {
      return null;
    }
  });

  // dxf-parser n'existe qu'en module CommonJS pour Node : la lecture se fait ici, la conversion dans l'interface.
  ipcMain.handle('parseDxf', (_e, text: string) => {
    const DxfParser = (DxfParserModule as any).default ?? DxfParserModule;
    const dxf = new DxfParser().parseSync(text);
    return { entities: dxf?.entities ?? [], header: { $INSUNITS: dxf?.header?.$INSUNITS } };
  });

  // Mises à jour depuis les releases GitHub (inactif tant que "publish" n'est pas configuré dans package.json).
  // La version Microsoft Store est mise à jour par le Store.
  if (app.isPackaged && !process.windowsStore) updater.autoUpdater.checkForUpdatesAndNotify().catch(() => {});
});

app.on('window-all-closed', () => app.quit());
