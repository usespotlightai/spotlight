import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppTabStrip } from '@/components/shell/tabs/AppTabStrip';

const TABS = [
  { id: 'a', path: '/w/acme/inbox', title: 'Inbox', back: [], forward: [] },
];

const renderStrip = (canGoBack: boolean, canGoForward: boolean) => {
  const onBack = vi.fn();
  const onForward = vi.fn();
  render(
    <AppTabStrip
      tabs={TABS}
      activeId="a"
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onSelect={() => {}}
      onClose={() => {}}
      onOpen={() => {}}
      onBack={onBack}
      onForward={onForward}
    />,
  );

  return { onBack, onForward };
};

describe('AppTabStrip back and forward', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'spotlightDesktop');
  });

  it('has no back and forward buttons outside the desktop app', () => {
    renderStrip(true, true);

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Forward' })).toBeNull();
  });

  it('disables each button when its side has no history', () => {
    Object.assign(window, { spotlightDesktop: { platform: 'darwin' } });
    renderStrip(false, true);

    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Forward' })).toBeEnabled();
  });

  it('calls the handlers of the enabled buttons', async () => {
    const user = userEvent.setup();
    Object.assign(window, { spotlightDesktop: { platform: 'darwin' } });
    const { onBack, onForward } = renderStrip(true, true);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Forward' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onForward).toHaveBeenCalledOnce();
  });
});
