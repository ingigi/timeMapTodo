const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: (storageKey, options) => ipcRenderer.invoke('load-data', { storageKey, options }),
  saveData: (data, storageKey) => ipcRenderer.invoke('save-data', { data, storageKey }),
  signInWithGoogleExternal: (clientId, clientSecret) => ipcRenderer.invoke('google-oauth-sign-in', { clientId, clientSecret }),
});
