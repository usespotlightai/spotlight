import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopBridge } from './bridges';

contextBridge.exposeInMainWorld('spotlightDesktop', {
  platform: process.platform,
  extraWindow: process.argv.includes('--spotlight-extra-window'),
  setBadge: (count: number) => ipcRenderer.send('spotlight:badge', count),
  show: () => ipcRenderer.send('spotlight:show'),
  authorize: (url: string) => ipcRenderer.send('spotlight:authorize', url),
  openWindow: (path: string) => ipcRenderer.send('spotlight:open-window', path),
  setTheme: (theme: string) => ipcRenderer.send('spotlight:theme', theme),
  close: () => ipcRenderer.send('spotlight:close'),
  changeAddress: () => ipcRenderer.send('spotlight:change-address'),
  openNotificationSettings: () =>
    ipcRenderer.send('spotlight:notification-settings'),
  onCommand: (listener: (command: string) => void) => {
    const heard = (_event: unknown, command: string) => listener(command);
    ipcRenderer.on('spotlight:command', heard);

    return () => {
      ipcRenderer.off('spotlight:command', heard);
    };
  },
} satisfies DesktopBridge);
