import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShortcutKeys } from '@/components/shared/shortcut/ShortcutKeys';
import { capsOf } from '@/lib/commands/keys';
import { SHORTCUT_IDS, shortcutOf } from '@/lib/commands/shortcuts';

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

const capsShown = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-slot="kbd"]')].map(
    (each) => each.textContent,
  );

describe('ShortcutKeys', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(SHORTCUT_IDS)('shows the keys of %s from the registry', (id) => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: MAC });
    const { container } = render(<ShortcutKeys id={id} />);

    expect(capsShown(container)).toEqual(
      shortcutOf(id).keys.flatMap((chord) => capsOf(chord, true)),
    );
  });

  it('names the keys on a computer that is not a Mac', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: WINDOWS });
    const { container } = render(<ShortcutKeys id="palette.open" />);

    expect(capsShown(container)).toEqual(['Ctrl', 'K']);
  });

  it('shows each key apart in plain text on a Mac', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: MAC });
    const { container } = render(<ShortcutKeys id="palette.open" plain />);

    expect(capsShown(container)).toEqual(['⌘', 'K']);
  });

  it('says the keys to a screen reader', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: MAC });
    render(<ShortcutKeys id="go.inbox" />);

    expect(screen.getByText('G, then I')).toBeInTheDocument();
  });
});
