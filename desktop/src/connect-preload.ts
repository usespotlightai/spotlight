import { contextBridge, ipcRenderer } from 'electron';
import type { ConnectBridge } from './bridges';

contextBridge.exposeInMainWorld('spotlightConnect', {
  current: () => ipcRenderer.invoke('spotlight:address'),
  save: (address) => ipcRenderer.invoke('spotlight:connect', address),
  cancel: () => ipcRenderer.send('spotlight:connect-cancel'),
  fit: (height) => ipcRenderer.send('spotlight:connect-fit', height),
} satisfies ConnectBridge);
