import type { DesktopBridge } from '../bridges';
import { element } from './element.js';

declare global {
  interface Window {
    readonly spotlightDesktop?: DesktopBridge;
  }
}

const RETRY_EVERY_MS = 10_000;

const webPage = (value: string | null): URL | null => {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
};

const page = webPage(new URLSearchParams(location.search).get('page'));
const retry = element('retry', HTMLButtonElement);

element('host', HTMLElement).textContent = page?.host ?? 'this address';

const again = () => {
  if (!page) {
    return;
  }
  retry.disabled = true;
  location.replace(page.href);
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
