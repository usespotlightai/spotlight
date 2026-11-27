import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  app,
  BrowserWindow,
  dialog,
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
  workspacePageOf,
} from './links';
import {
  openAtLoginOnFirstRun,
  opensAtLogin,
  setOpensAtLogin,
} from './login-item';
import { grants } from './permissions';
import { ErrorReporting } from './reporting';
import { SettingsFile } from './settings';
import { updateCheckOutcome, updateFeedOf } from './updates';
import {
  type Bounds,
  DEFAULT_SIZE,
  MINIMUM_SIZE,
  restorable,
  WindowStateFile,
} from './window-state';

const UPDATE_EVERY_MS = 4 * 60 * 60 * 1000;
const MAX_BADGE = 99;

let main: BrowserWindow | null = null;
const extras = new Set<BrowserWindow>();
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

const feed = updateFeedOf(app.getVersion());
if (feed) {
  autoUpdater.setFeedURL(feed);
}

const checkForUpdates = () => {
  autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
    // oxlint-disable-next-line no-console -- the main process logs to its terminal
    console.warn('Spotlight could not check for updates', error);
  });
};

const checkForUpdatesNow = async () => {
  const options = await updateCheckOutcome(autoUpdater, app.getVersion());
  const window = frontWindow();

  await (window
    ? dialog.showMessageBox(window, options)
    : dialog.showMessageBox(options));
};

const shown = (window: BrowserWindow) => {
  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
};

const isSpotlightWindow = (
  window: BrowserWindow | null,
): window is BrowserWindow =>
  window !== null && (window === main || extras.has(window));

const frontWindow = (): BrowserWindow | null => {
  const focused = BrowserWindow.getFocusedWindow();

  return isSpotlightWindow(focused) ? focused : main;
};

const spotlightWindows = (): BrowserWindow[] =>
  main ? [main, ...extras] : [...extras];

const opened = (url: string) => {
  switch (navigationOf(url, origin)) {
    case 'inside':
    case 'sign-in':
      return true;
    case 'outside':
      void shell.openExternal(url);
      return false;
    case 'blocked':
      return false;
  }
};

const followLink = (link: string) => {
  const page = pageOf(link, origin);

  if (page === null) {
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

  const rememberNow = () => remember(window);

  window.on('maximize', rememberNow);
  window.on('unmaximize', rememberNow);
  window.on('enter-full-screen', rememberNow);
  window.on('leave-full-screen', rememberNow);

  window.on('closed', () => clearTimeout(pending));
};

const EXTRA_WINDOW = '--spotlight-extra-window';
const CASCADE = 24;

const windowBackground = () =>
  nativeTheme.shouldUseDarkColors ? '#0d0d0e' : '#efeff1';

const workAreas = () => screen.getAllDisplays().map((each) => each.workArea);

const spotlightWindow = (
  bounds: Partial<Bounds> & typeof DEFAULT_SIZE,
  extra: boolean,
) => {
  const window = new BrowserWindow({
    ...bounds,
    minWidth: MINIMUM_SIZE.width,
    minHeight: MINIMUM_SIZE.height,
    title: 'Spotlight',
    titleBarStyle: 'hidden',
    trafficLightPosition: TRAFFIC_LIGHTS,
    backgroundColor: windowBackground(),
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      additionalArguments: extra ? [EXTRA_WINDOW] : [],
    },
  });

  withContextMenu(window.webContents);

  const followTheme = () => window.setBackgroundColor(windowBackground());
  nativeTheme.on('updated', followTheme);
  window.on('closed', () => nativeTheme.off('updated', followTheme));

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

  return window;
};

const createMain = () => {
  const saved = restorable(windowState.read(), workAreas());
  const window = spotlightWindow(saved?.bounds ?? DEFAULT_SIZE, false);

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
  void window
    .loadURL((link === null ? null : pageOf(link, origin)) ?? origin)
    .catch(ignored);
};

const openWindow = (page: string, from: BrowserWindow | null) => {
  const beside = from?.getNormalBounds();
  const cascaded =
    beside &&
    restorable(
      {
        bounds: { ...beside, x: beside.x + CASCADE, y: beside.y + CASCADE },
        maximized: false,
        fullScreen: false,
      },
      workAreas(),
    );
  const window = spotlightWindow(cascaded?.bounds ?? DEFAULT_SIZE, true);

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => extras.delete(window));

  extras.add(window);
  void window.loadURL(page).catch(ignored);
};

let authorizing: BrowserWindow | null = null;

const authorize = (url: string, from: BrowserWindow) => {
  authorizing?.close();

  const window = new BrowserWindow({
    width: 560,
    height: 760,
    title: 'Connect',
    parent: from,
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
    if (!from.isDestroyed()) {
      void from.loadURL(to).catch(ignored);
      shown(from);
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
  const area = (window.getParentWindow() ?? window).getBounds();
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
    parent: frontWindow() ?? undefined,
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
  if (!frontWindow()) {
    createMain();
  }

  const window = frontWindow();

  if (window) {
    shown(window);
    window.webContents.send('spotlight:command', command);
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
        click: () => void checkForUpdatesNow(),
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
        click: () => sendCommand('back'),
      },
      {
        label: 'Forward',
        accelerator: 'CmdOrCtrl+]',
        click: () => sendCommand('forward'),
      },
    ],
  },
  tabMenu(sendCommand),
  {
    label: 'Window',
    submenu: [
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+N',
        click: () => openWindow(origin, frontWindow()),
      },
      { type: 'separator' },
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

    const front = frontWindow();

    if (link !== null) {
      followLink(link);
    } else if (front) {
      shown(front);
    }
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('activate', (_event, hasVisibleWindows) => {
    if (main && (!hasVisibleWindows || !main.isVisible())) {
      shown(main);
    } else if (!main && !hasVisibleWindows) {
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
    const window = BrowserWindow.fromWebContents(event.sender);

    if (fromSpotlight(event.senderFrame) && isSpotlightWindow(window)) {
      window.close();
    }
  });

  ipcMain.on('spotlight:notification-settings', (event) => {
    if (fromSpotlight(event.senderFrame)) {
      void shell.openExternal(NOTIFICATION_SETTINGS);
    }
  });

  ipcMain.on('spotlight:show', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (fromSpotlight(event.senderFrame) && isSpotlightWindow(window)) {
      shown(window);
    }
  });

  ipcMain.on('spotlight:open-window', (event, path: unknown) => {
    const page =
      typeof path === 'string' ? workspacePageOf(path, origin) : null;

    if (fromSpotlight(event.senderFrame) && page !== null) {
      openWindow(page, BrowserWindow.fromWebContents(event.sender));
    }
  });

  ipcMain.on('spotlight:authorize', (event, url: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (
      fromSpotlight(event.senderFrame) &&
      isSpotlightWindow(window) &&
      typeof url === 'string' &&
      authorizable(url)
    ) {
      authorize(url, window);
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

    if (saved === null) {
      return false;
    }

    origin = saved;
    connect?.close();
    for (const window of spotlightWindows()) {
      void window.loadURL(origin).catch(ignored);
    }
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
        grant(grants(permission, details.requestingUrl, origin)),
    );
    session.defaultSession.setPermissionCheckHandler(
      (_contents, permission, requestingOrigin) =>
        grants(permission, requestingOrigin, origin),
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
