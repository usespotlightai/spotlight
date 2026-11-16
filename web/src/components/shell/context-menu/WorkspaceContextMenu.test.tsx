import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Archive } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceContextMenu } from '@/components/shell/context-menu/WorkspaceContextMenu';
import { useMenuActions } from '@/hooks/useMenuActions';

function Row({
  onResolve,
  pending = false,
}: {
  onResolve: () => void;
  pending?: boolean;
}) {
  const menu = useMenuActions([
    { label: 'Resolve', icon: Archive, onSelect: onResolve, disabled: pending },
  ]);

  return (
    <div {...menu}>
      <a href="/w/acme/inbox/item_1">Flaky checkout test</a>
      <span>14 Nov</span>
    </div>
  );
}

const renderMenu = () => {
  const onOpenTab = vi.fn();
  const onResolve = vi.fn();
  const page = (pending: boolean) => (
    <WorkspaceContextMenu slug="acme" onOpenTab={onOpenTab}>
      <a href="/w/acme/team/team_1/runs">Runs</a>
      <a href="https://github.com/acme/api/pull/1">The pull request</a>
      <a href="/w/acme/inbox/item_1/report.pdf" download>
        The report
      </a>
      <p>Plain text</p>
      <ul>
        <li data-link="/w/acme/inbox">
          <button type="button">Inbox tab</button>
        </li>
      </ul>
      <input aria-label="Title" />
      <Row onResolve={onResolve} pending={pending} />
    </WorkspaceContextMenu>
  );
  const { rerender } = render(page(false));

  return {
    onOpenTab,
    onResolve,
    resolving: () => rerender(page(true)),
  };
};

const rightClick = (element: Element) =>
  fireEvent.contextMenu(element, { clientX: 40, clientY: 60 });

afterEach(() => {
  Reflect.deleteProperty(window, 'spotlightDesktop');
});

describe('WorkspaceContextMenu', () => {
  it('opens a workspace link in a new Spotlight tab', async () => {
    const user = userEvent.setup();
    const { onOpenTab } = renderMenu();

    expect(rightClick(screen.getByText('Runs'))).toBe(false);
    const openIn = await screen.findByRole('menuitem', { name: 'Open in' });
    openIn.focus();
    await user.keyboard('{ArrowRight}');
    await screen.findByRole('menuitem', { name: 'New tab' });
    await user.keyboard('{Enter}');

    expect(onOpenTab).toHaveBeenCalledExactlyOnceWith(
      '/w/acme/team/team_1/runs',
    );
  });

  it('copies the full address of a workspace link', async () => {
    const user = userEvent.setup();
    renderMenu();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();

    rightClick(screen.getByText('Runs'));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Copy link' }),
    );

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/w/acme/team/team_1/runs`,
    );
  });

  it('puts the actions of the row before the link items', async () => {
    const user = userEvent.setup();
    const { onResolve } = renderMenu();

    rightClick(screen.getByText('14 Nov'));
    const items = await screen.findAllByRole('menuitem');

    expect(items.map((item) => item.textContent)).toEqual(['Resolve']);

    await user.click(items[0]);

    expect(onResolve).toHaveBeenCalledOnce();
  });

  it('follows the row actions while the menu is open', async () => {
    const user = userEvent.setup();
    const { onResolve, resolving } = renderMenu();

    rightClick(screen.getByText('14 Nov'));
    await screen.findByRole('menuitem', { name: 'Resolve' });
    resolving();
    const resolve = screen.getByRole('menuitem', { name: 'Resolve' });

    expect(resolve).toHaveAttribute('aria-disabled', 'true');

    await user.click(resolve);

    expect(onResolve).not.toHaveBeenCalled();
  });

  it('offers the row actions and the link items on the link in a row', async () => {
    renderMenu();

    rightClick(screen.getByText('Flaky checkout test'));

    expect(
      (await screen.findAllByRole('menuitem')).map((item) => item.textContent),
    ).toEqual(['Resolve', 'Copy link', 'Open in']);
  });

  it('leaves the browser menu everywhere else', () => {
    renderMenu();

    for (const element of [
      screen.getByText('The pull request'),
      screen.getByText('The report'),
      screen.getByText('Plain text'),
      screen.getByRole('textbox', { name: 'Title' }),
    ]) {
      expect(rightClick(element)).toBe(true);
    }

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('copies the address of a tab', async () => {
    const user = userEvent.setup();
    renderMenu();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();

    expect(rightClick(screen.getByText('Inbox tab'))).toBe(false);
    await user.click(
      await screen.findByRole('menuitem', { name: 'Copy link' }),
    );

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/w/acme/inbox`,
    );
  });

  it('opens a workspace link in a new desktop window', async () => {
    const user = userEvent.setup();
    const openWindow = vi.fn();
    Object.assign(window, {
      spotlightDesktop: { platform: 'darwin', openWindow },
    });
    renderMenu();

    rightClick(screen.getByText('Runs'));
    const openIn = await screen.findByRole('menuitem', { name: 'Open in' });
    openIn.focus();
    await user.keyboard('{ArrowRight}');
    const newWindow = await screen.findByRole('menuitem', {
      name: 'New window',
    });

    expect(screen.queryByRole('menuitem', { name: 'Browser' })).toBeNull();

    await user.click(newWindow);

    expect(openWindow).toHaveBeenCalledExactlyOnceWith(
      '/w/acme/team/team_1/runs',
    );
  });
});
