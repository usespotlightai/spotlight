import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('spotlightDesktop', {
  platform: process.platform,
  setBadge: (count: number) => ipcRenderer.send('spotlight:badge', count),
  show: () => ipcRenderer.send('spotlight:show'),
  authorize: (url: string) => ipcRenderer.send('spotlight:authorize', url),
  setTheme: (theme: string) => ipcRenderer.send('spotlight:theme', theme),
});
