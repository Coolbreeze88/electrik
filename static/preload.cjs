const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  save: (json, path) => ipcRenderer.invoke('save', json, path),
  open: () => ipcRenderer.invoke('open'),
  pdf: name => ipcRenderer.invoke('pdf', name),
  saveText: (name, content, ext) => ipcRenderer.invoke('saveText', name, content, ext),
  autosave: json => ipcRenderer.invoke('autosave', json),
  recover: () => ipcRenderer.invoke('recover'),
  parseDxf: text => ipcRenderer.invoke('parseDxf', text),
  setLang: lang => ipcRenderer.send('lang', lang),
});
