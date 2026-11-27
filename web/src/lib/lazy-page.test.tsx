import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { isLazyPage, lazyPage } from '@/lib/lazy-page';

const pageModule = { Page: () => <p>The page</p> };

const shown = (Page: ReturnType<typeof lazyPage>) =>
  render(
    <Suspense fallback={<p>Loading</p>}>
      <Page />
    </Suspense>,
  );

describe('lazyPage', () => {
  it('shows a preloaded page at once, without the fallback', async () => {
    const Page = lazyPage(
      () => Promise.resolve(pageModule),
      (module) => module.Page,
    );

    await Page.preload();
    shown(Page);

    expect(screen.getByText('The page')).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('shows the fallback until a page that was not preloaded arrives', async () => {
    const Page = lazyPage(
      () => Promise.resolve(pageModule),
      (module) => module.Page,
    );

    shown(Page);

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(await screen.findByText('The page')).toBeInTheDocument();
  });

  it('loads the module once for a preload and a render', async () => {
    const load = vi.fn(() => Promise.resolve(pageModule));
    const Page = lazyPage(load, (module) => module.Page);

    await Page.preload();
    shown(Page);
    await Page.preload();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('loads again after a failed preload', async () => {
    const load = vi
      .fn<() => Promise<typeof pageModule>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(pageModule);
    const Page = lazyPage(load, (module) => module.Page);

    await expect(Page.preload()).rejects.toThrow('offline');
    await Page.preload();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('tells a lazy page from other components', () => {
    expect(
      isLazyPage(
        lazyPage(
          () => Promise.resolve(pageModule),
          (m) => m.Page,
        ),
      ),
    ).toBe(true);
    expect(isLazyPage(pageModule.Page)).toBe(false);
  });
});
