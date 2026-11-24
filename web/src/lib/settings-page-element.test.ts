import { describe, expect, it, vi } from 'vitest';

import {
  isAppPath,
  loadSettingsPageElement,
  scriptUrlOf,
} from '@/lib/settings-page-element';

let next = 0;

// Each test gets its own element and script, because the browser keeps an element defined, and the loader keeps each load.
const fresh = () => {
  next += 1;
  return { script: `/pages/${next}.js`, element: `x-test-page-${next}` };
};

const defines = (element: string) =>
  vi.fn(async () => {
    customElements.define(element, class extends HTMLElement {});
  });

describe('loadSettingsPageElement', () => {
  it('imports the script and resolves when the script defines the element', async () => {
    const page = fresh();
    const load = defines(page.element);

    await expect(loadSettingsPageElement(page, 0, load)).resolves.toBe(
      undefined,
    );
    expect(load).toHaveBeenCalledWith(page.script);
  });

  it('does not import the script again for an element that is defined', async () => {
    const page = fresh();
    customElements.define(page.element, class extends HTMLElement {});
    const load = vi.fn(async () => undefined);

    await loadSettingsPageElement(page, 0, load);

    expect(load).not.toHaveBeenCalled();
  });

  it('imports each attempt once', async () => {
    const page = fresh();
    let finish: () => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            customElements.define(page.element, class extends HTMLElement {});
            resolve();
          };
        }),
    );

    const first = loadSettingsPageElement(page, 0, load);
    const second = loadSettingsPageElement(page, 0, load);
    finish();
    await Promise.all([first, second]);

    expect(load).toHaveBeenCalledOnce();
  });

  it('fails when the script does not load', async () => {
    const page = fresh();
    const load = vi.fn(async () => {
      throw new TypeError('Failed to fetch dynamically imported module');
    });

    await expect(loadSettingsPageElement(page, 0, load, 50)).rejects.toThrow(
      'Failed to fetch',
    );
  });

  it('fails when the script does not define the element in time', async () => {
    const page = fresh();
    const load = vi.fn(async () => undefined);

    await expect(loadSettingsPageElement(page, 0, load, 20)).rejects.toThrow(
      `did not define <${page.element}> in time`,
    );
  });

  it('asks for a new URL on a new attempt', async () => {
    const page = fresh();
    const load = vi
      .fn<(url: string) => Promise<unknown>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementationOnce(async () => {
        customElements.define(page.element, class extends HTMLElement {});
      });

    await expect(loadSettingsPageElement(page, 0, load, 50)).rejects.toThrow(
      'Failed to fetch',
    );
    await expect(loadSettingsPageElement(page, 1, load, 50)).resolves.toBe(
      undefined,
    );
    expect(load.mock.calls.map(([url]) => url)).toEqual([
      page.script,
      `${page.script}?attempt=1`,
    ]);
  });
});

describe('scriptUrlOf', () => {
  it('keeps the script as it is on the first attempt', () => {
    expect(scriptUrlOf('/billing/element.js', 0)).toBe('/billing/element.js');
  });

  it('adds the attempt after that', () => {
    expect(scriptUrlOf('/billing/element.js', 2)).toBe(
      '/billing/element.js?attempt=2',
    );
  });
});

describe('isAppPath', () => {
  it.each(['/w/acme/settings/members', '/'])('accepts %j', (to) => {
    expect(isAppPath(to)).toBe(true);
  });

  it.each([
    'https://example.com',
    '//example.com/w',
    '/\\example.com',
    'w/acme',
    'javascript:alert(1)',
    '',
    42,
    null,
    undefined,
  ])('refuses %j', (to) => {
    expect(isAppPath(to)).toBe(false);
  });
});
