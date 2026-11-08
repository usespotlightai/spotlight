import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('spotlightConnect', {
  current: (): Promise<string> => ipcRenderer.invoke('spotlight:address'),
  save: (address: string): Promise<boolean> =>
    ipcRenderer.invoke('spotlight:connect', address),
  cancel: () => ipcRenderer.send('spotlight:connect-cancel'),
});
