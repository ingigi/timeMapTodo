const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: (storageKey, options) => ipcRenderer.invoke('load-data', { storageKey, options }),
  saveData: (data, storageKey) => ipcRenderer.invoke('save-data', { data, storageKey }),
  signInWithGoogleExternal: (clientId, clientSecret) => ipcRenderer.invoke('google-oauth-sign-in', { clientId, clientSecret }),
  saveGoogleCalendarToken: (payload) => ipcRenderer.invoke('google-calendar-save-token', payload),
  refreshGoogleCalendarToken: (payload) => ipcRenderer.invoke('google-calendar-refresh-token', payload),
  isDesktopApp: true,
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window-toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  onAppResumed: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = () => callback();
    ipcRenderer.on('app-resumed', listener);

    return () => {
      ipcRenderer.removeListener('app-resumed', listener);
    };
  },
});
