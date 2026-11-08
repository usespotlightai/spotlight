import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  nativeTheme,
  screen,
  session,
  shell,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import { type Command, tabMenu } from './commands';
import { withContextMenu } from './context-menu';
import { saveDownloadsToDownloads } from './downloads';
import { FRAME_CSS, TRAFFIC_LIGHTS } from './frame';
import {
  authorizable,
  deepLinkIn,
  isOrigin,
  navigationOf,
  pageOf,
  SCHEME,
} from './links';
import {
  openAtLoginOnFirstRun,
  opensAtLogin,
  setOpensAtLogin,
} from './login-item';
import { ErrorReporting } from './reporting';
import { SettingsFile } from './settings';
import {
  DEFAULT_SIZE,
  MINIMUM_SIZE,
  restorable,
  WindowStateFile,
} from './window-state';

const UPDATE_EVERY_MS = 4 * 60 * 60 * 1000;
const MAX_BADGE = 99;

let main: BrowserWindow | null = null;
let connect: BrowserWindow | null = null;
let quitting = false;
let pendingLink: string | null = null;

const APP_ID = 'ai.usespotlight.desktop';

app.setPath('userData', join(app.getPath('appData'), APP_ID));

const reporting = new ErrorReporting(app.getPath('userData'));
reporting.start();

const settings = new SettingsFile(app.getPath('userData'));
const windowState = new WindowStateFile(app.getPath('userData'));
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

  void main.loadURL(page).catch(ignored);
  shown(main);
};

const REMEMBER_AFTER_MS = 500;
const ABORTED = -3;

const ignored = () => undefined;

const fromOffline = (frame: { url: string } | null): boolean =>
  (frame?.url ?? '').startsWith(
    pathToFileURL(join(__dirname, 'offline.html')).href,
  );

const remember = (window: BrowserWindow) => {
  if (window.isDestroyed()) {
    return;
  }

  windowState.write({
    bounds: window.getNormalBounds(),
    maximized: window.isMaximized(),
    fullScreen: window.isFullScreen(),
  });
};

const rememberPlaceOf = (window: BrowserWindow) => {
  let pending: NodeJS.Timeout | undefined;
  const soon = () => {
    clearTimeout(pending);
    pending = setTimeout(() => remember(window), REMEMBER_AFTER_MS);
  };

  window.on('resize', soon);
  window.on('move', soon);

  for (const change of [
    'maximize',
    'unmaximize',
    'enter-full-screen',
    'leave-full-screen',
  ] as const) {
    window.on(change as 'maximize', () => remember(window));
  }

  window.on('closed', () => clearTimeout(pending));
};

const createMain = () => {
  const saved = restorable(
    windowState.read(),
    screen.getAllDisplays().map((each) => each.workArea),
  );
  const window = new BrowserWindow({
    ...(saved?.bounds ?? DEFAULT_SIZE),
    minWidth: MINIMUM_SIZE.width,
    minHeight: MINIMUM_SIZE.height,
    title: 'Spotlight',
    titleBarStyle: 'hidden',
    trafficLightPosition: TRAFFIC_LIGHTS,
    backgroundColor: '#00000000',
    vibrancy: 'sidebar',
    visualEffectState: 'followWindow',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  withContextMenu(window.webContents);

  window.webContents.on(
    'did-fail-load',
    (_event, code, _description, url, isMainFrame) => {
      if (
        isMainFrame &&
        code !== ABORTED &&
        navigationOf(url, origin) === 'inside'
      ) {
        void window
          .loadFile(join(__dirname, 'offline.html'), {
            query: { page: url },
          })
          .catch(ignored);
      }
    },
  );

  window.once('ready-to-show', () => {
    if (saved?.maximized) {
      window.maximize();
    }

    window.show();

    if (saved?.fullScreen) {
      window.setFullScreen(true);
    }
  });

  rememberPlaceOf(window);

  window.webContents.on('dom-ready', () => {
    if (navigationOf(window.webContents.getURL(), origin) !== 'blocked') {
      void window.webContents.insertCSS(FRAME_CSS).catch(ignored);
    }
  });

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
    remember(window);

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
  void window.loadURL((link && pageOf(link, origin)) ?? origin).catch(ignored);
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
      void main.loadURL(to).catch(ignored);
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
  void window.loadURL(url).catch(ignored);
};

const CONNECT_WIDTH = 440;
const CONNECT_SHADOW = 48;
const CONNECT_FROM_TOP = 0.28;

const fitConnect = (window: BrowserWindow, height: number) => {
  const area = main?.getBounds() ?? window.getBounds();
  const x = Math.round(
    area.x + (area.width - CONNECT_WIDTH) / 2 - CONNECT_SHADOW,
  );
  const y = Math.round(
    area.y + area.height * CONNECT_FROM_TOP - height / 2 - CONNECT_SHADOW,
  );

  window.setBounds({
    x,
    y,
    width: CONNECT_WIDTH + 2 * CONNECT_SHADOW,
    height: height + 2 * CONNECT_SHADOW,
  });

  if (!window.isVisible()) {
    window.show();
  }
};

const openConnect = () => {
  if (connect) {
    shown(connect);
    return;
  }

  connect = new BrowserWindow({
    width: CONNECT_WIDTH + 2 * CONNECT_SHADOW,
    height: 300,
    useContentSize: true,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: 'Spotlight address',
    parent: main ?? undefined,
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
  void connect.loadFile(join(__dirname, 'connect.html')).catch(ignored);
};

const sendCommand = (command: Command) => {
  if (!main) {
    createMain();
  }

  if (main) {
    shown(main);
    main.webContents.send('spotlight:command', command);
  }
};

const menu = (): MenuItemConstructorOptions[] => [
  {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      {
        label: 'Settings…',
        accelerator: 'CmdOrCtrl+,',
        click: () => sendCommand('settings'),
      },
      { label: 'Spotlight Address…', click: openConnect },
      {
        label: 'Open at Login',
        type: 'checkbox',
        checked: opensAtLogin(),
        click: (item) => setOpensAtLogin(item.checked),
      },
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
  tabMenu(sendCommand),
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' },
    ],
  },
];

const NOTIFICATION_SETTINGS =
  'x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=ai.usespotlight.desktop';

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

  ipcMain.on('spotlight:theme', (event, theme: unknown) => {
    if (
      fromSpotlight(event.senderFrame) &&
      (theme === 'light' || theme === 'dark' || theme === 'system')
    ) {
      nativeTheme.themeSource = theme;
    }
  });

  ipcMain.on('spotlight:change-address', (event) => {
    if (fromOffline(event.senderFrame)) {
      openConnect();
    }
  });

  ipcMain.on('spotlight:close', (event) => {
    if (fromSpotlight(event.senderFrame) && main) {
      main.close();
    }
  });

  ipcMain.on('spotlight:notification-settings', (event) => {
    if (fromSpotlight(event.senderFrame)) {
      void shell.openExternal(NOTIFICATION_SETTINGS);
    }
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
    void main?.loadURL(origin).catch(ignored);
    return true;
  });

  ipcMain.on('spotlight:connect-fit', (event, height: unknown) => {
    if (
      connect &&
      fromConnect(event.sender) &&
      typeof height === 'number' &&
      height > 0 &&
      height < 600
    ) {
      fitConnect(connect, Math.ceil(height));
    }
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

    void reporting.refresh(origin);
    openAtLoginOnFirstRun(app.getPath('userData'));
    saveDownloadsToDownloads(session.defaultSession);
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu()));
    createMain();

    if (app.isPackaged) {
      checkForUpdates();
      setInterval(checkForUpdates, UPDATE_EVERY_MS);
    }
  });
}
