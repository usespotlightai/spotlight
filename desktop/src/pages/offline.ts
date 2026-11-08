import type { DesktopBridge } from '../bridges';
import { element } from './element.js';

declare global {
  interface Window {
    readonly spotlightDesktop?: DesktopBridge;
  }
}

const RETRY_EVERY_MS = 10_000;

const hostOf = (page: string): string => {
  try {
    return new URL(page).host;
  } catch {
    return 'this address';
  }
};

const page = new URLSearchParams(location.search).get('page') ?? '';
const retry = element('retry', HTMLButtonElement);

element('host', HTMLElement).textContent = hostOf(page);

const again = () => {
  retry.disabled = true;
  location.replace(page);
};

retry.addEventListener('click', again);
element('change', HTMLButtonElement).addEventListener('click', () =>
  window.spotlightDesktop?.changeAddress(),
);
window.addEventListener('online', again);
setInterval(() => {
  if (navigator.onLine) {
    again();
  }
}, RETRY_EVERY_MS);
