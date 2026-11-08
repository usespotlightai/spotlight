import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  nativeTheme,
  session,
  shell,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import {
  authorizable,
  deepLinkIn,
  isOrigin,
  navigationOf,
  pageOf,
  SCHEME,
} from './links';
import { SettingsFile } from './settings';

const UPDATE_EVERY_MS = 4 * 60 * 60 * 1000;
const MAX_BADGE = 99;
const TRAFFIC_LIGHTS = { x: 20, y: 15 };

let main: BrowserWindow | null = null;
let connect: BrowserWindow | null = null;
let quitting = false;
let pendingLink: string | null = null;

const APP_ID = 'ai.usespotlight.desktop';

app.setPath('userData', join(app.getPath('appData'), APP_ID));

const settings = new SettingsFile(app.getPath('userData'));
let origin = settings.origin();

const checkForUpdates = () => {
  autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
    console.warn('Spotlight could not check for updates', error);
  });
};

const shown = (window: BrowserWindow) => {
  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
};

const opened = (url: string) => {
  switch (navigationOf(url, origin)) {
    case 'inside':
    case 'sign-in':
      return true;
    case 'outside':
      void shell.openExternal(url);
      return false;
    default:
      return false;
  }
};

const followLink = (link: string) => {
  const page = pageOf(link, origin);

  if (!page) {
    return;
  }

  if (!main) {
    pendingLink = link;
    return;
  }

  void main.loadURL(page);
  shown(main);
};

const createMain = () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 480,
    title: 'Spotlight',
    titleBarStyle: 'hidden',
    trafficLightPosition: TRAFFIC_LIGHTS,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d0d0e' : '#efeff1',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (navigationOf(url, origin) !== 'blocked') {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!opened(url)) {
      event.preventDefault();
    }
  });

  window.webContents.on('will-redirect', (event) => {
    if (event.isMainFrame && !opened(event.url)) {
      event.preventDefault();
    }
  });

  window.on('close', (event) => {
    if (!quitting && process.platform === 'darwin') {
      event.preventDefault();
      window.hide();
    }
  });

  window.on('closed', () => {
    main = null;
  });

  main = window;

  const link = pendingLink;
  pendingLink = null;
  void window.loadURL((link && pageOf(link, origin)) ?? origin);
};

let authorizing: BrowserWindow | null = null;

const authorize = (url: string) => {
  authorizing?.close();

  const window = new BrowserWindow({
    width: 560,
    height: 760,
    title: 'Connect',
    parent: main ?? undefined,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  const returned = (event: Electron.Event, to: string) => {
    if (!isOrigin(to, origin)) {
      return;
    }

    event.preventDefault();
    window.close();
    if (main) {
      void main.loadURL(to);
      shown(main);
    }
  };

  window.webContents.on('will-navigate', (event) => {
    if (navigationOf(event.url, origin) === 'blocked') {
      event.preventDefault();
      return;
    }

    returned(event, event.url);
  });
  window.webContents.on('will-redirect', (event) => {
    if (event.isMainFrame) {
      returned(event, event.url);
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.on('closed', () => {
    if (authorizing === window) {
      authorizing = null;
    }
  });

  authorizing = window;
  void window.loadURL(url);
};

const openConnect = () => {
  if (connect) {
    shown(connect);
    return;
  }

  connect = new BrowserWindow({
    width: 440,
    height: 230,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Spotlight address',
    parent: main ?? undefined,
    modal: main !== null,
    webPreferences: {
      preload: join(__dirname, 'connect-preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  connect.webContents.on('will-navigate', (event) => event.preventDefault());
  connect.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  connect.on('closed', () => {
    connect = null;
  });
  void connect.loadFile(join(__dirname, 'connect.html'));
};

const menu = (): MenuItemConstructorOptions[] => [
  {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { label: 'Spotlight Address…', click: openConnect },
      {
        label: 'Check for Updates…',
        enabled: app.isPackaged,
        click: checkForUpdates,
      },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  { role: 'editMenu' },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
  {
    label: 'History',
    submenu: [
      {
        label: 'Back',
        accelerator: 'CmdOrCtrl+[',
        click: () => main?.webContents.navigationHistory.goBack(),
      },
      {
        label: 'Forward',
        accelerator: 'CmdOrCtrl+]',
        click: () => main?.webContents.navigationHistory.goForward(),
      },
    ],
  },
  { role: 'windowMenu' },
];

const fromSpotlight = (frame: { url: string } | null): boolean =>
  frame !== null && navigationOf(frame.url, origin) === 'inside';

const fromConnect = (sender: Electron.WebContents): boolean =>
  connect !== null && sender === connect.webContents;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient(SCHEME);
  }

  app.on('open-url', (event, url) => {
    event.preventDefault();
    followLink(url);
  });

  app.on('second-instance', (_event, argv) => {
    const link = deepLinkIn(argv);

    if (link) {
      followLink(link);
    } else if (main) {
      shown(main);
    }
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('activate', () => {
    if (main) {
      shown(main);
    } else {
      createMain();
    }
  });

  ipcMain.on('spotlight:badge', (event, count: unknown) => {
    if (!fromSpotlight(event.senderFrame) || typeof count !== 'number') {
      return;
    }

    app.setBadgeCount(Math.max(0, Math.min(MAX_BADGE, Math.floor(count))));
  });

  ipcMain.on('spotlight:show', (event) => {
    if (fromSpotlight(event.senderFrame) && main) {
      shown(main);
    }
  });

  ipcMain.on('spotlight:authorize', (event, url: unknown) => {
    if (
      fromSpotlight(event.senderFrame) &&
      typeof url === 'string' &&
      authorizable(url)
    ) {
      authorize(url);
    }
  });

  ipcMain.handle('spotlight:address', (event) =>
    fromConnect(event.sender) ? origin : null,
  );

  ipcMain.handle('spotlight:connect', (event, address: unknown) => {
    if (!fromConnect(event.sender)) {
      return false;
    }

    const saved = typeof address === 'string' ? settings.save(address) : null;

    if (!saved) {
      return false;
    }

    origin = saved;
    connect?.close();
    void main?.loadURL(origin);
    return true;
  });

  ipcMain.on('spotlight:connect-cancel', (event) => {
    if (fromConnect(event.sender)) {
      connect?.close();
    }
  });

  void app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler(
      (_contents, permission, grant, details) =>
        grant(
          permission === 'notifications' &&
            isOrigin(details.requestingUrl, origin),
        ),
    );
    session.defaultSession.setPermissionCheckHandler(
      (_contents, permission, requestingOrigin) =>
        permission === 'notifications' && requestingOrigin === origin,
    );

    Menu.setApplicationMenu(Menu.buildFromTemplate(menu()));
    createMain();

    if (app.isPackaged) {
      checkForUpdates();
      setInterval(checkForUpdates, UPDATE_EVERY_MS);
    }
  });
}
