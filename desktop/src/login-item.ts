import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

export const opensAtLogin = (): boolean =>
  app.getLoginItemSettings().openAtLogin;

export const setOpensAtLogin = (opens: boolean): void => {
  app.setLoginItemSettings({ openAtLogin: opens });
};

export const openAtLoginOnFirstRun = (directory: string): void => {
  if (!app.isPackaged || !app.isInApplicationsFolder()) {
    return;
  }

  const marker = join(directory, 'first-run.json');

  try {
    readFileSync(marker, 'utf8');
    return;
  } catch {}

  setOpensAtLogin(true);

  try {
    writeFileSync(marker, JSON.stringify({ openAtLoginOffered: true }));
  } catch {}
};
