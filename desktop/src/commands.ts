import type { MenuItemConstructorOptions } from 'electron';

export type Command =
  | 'new-tab'
  | 'close-tab'
  | 'next-tab'
  | 'previous-tab'
  | 'last-tab'
  | 'settings'
  | `tab-${number}`;

export const tabMenu = (
  send: (command: Command) => void,
): MenuItemConstructorOptions => ({
  label: 'Tab',
  submenu: [
    {
      label: 'New Tab',
      accelerator: 'CmdOrCtrl+T',
      click: () => send('new-tab'),
    },
    {
      label: 'Close Tab',
      accelerator: 'CmdOrCtrl+W',
      click: () => send('close-tab'),
    },
    { type: 'separator' },
    {
      label: 'Show Next Tab',
      accelerator: 'Ctrl+Tab',
      click: () => send('next-tab'),
    },
    {
      label: 'Show Previous Tab',
      accelerator: 'Ctrl+Shift+Tab',
      click: () => send('previous-tab'),
    },
    {
      label: 'Show Next Tab',
      accelerator: 'CmdOrCtrl+Shift+]',
      visible: false,
      acceleratorWorksWhenHidden: true,
      click: () => send('next-tab'),
    },
    {
      label: 'Show Previous Tab',
      accelerator: 'CmdOrCtrl+Shift+[',
      visible: false,
      acceleratorWorksWhenHidden: true,
      click: () => send('previous-tab'),
    },
    { type: 'separator' },
    ...Array.from(
      { length: 8 },
      (_, at): MenuItemConstructorOptions => ({
        label: `Tab ${at + 1}`,
        accelerator: `CmdOrCtrl+${at + 1}`,
        click: () => send(`tab-${at + 1}`),
      }),
    ),
    {
      label: 'Last Tab',
      accelerator: 'CmdOrCtrl+9',
      click: () => send('last-tab'),
    },
  ],
});
