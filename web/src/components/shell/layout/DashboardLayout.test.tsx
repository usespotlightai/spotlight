import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardLayout } from '@/components/shell/layout/DashboardLayout';

const handle = () => screen.getByRole('separator', { name: 'Resize sidebar' });

beforeEach(() => {
  localStorage.clear();
});

describe('DashboardLayout', () => {
  it('renders the sidebar and content it is given', () => {
    render(
      <DashboardLayout sidebar={<p>sidebar slot</p>}>
        <p>content slot</p>
      </DashboardLayout>,
    );

    expect(screen.getByText('sidebar slot')).toBeInTheDocument();
    expect(screen.getByText('content slot')).toBeInTheDocument();
  });

  it('exposes the sidebar width through the resize handle', () => {
    render(<DashboardLayout />);

    expect(handle()).toHaveAttribute('aria-valuenow', '224');
    expect(handle()).toHaveAttribute('aria-valuemin', '192');
    expect(handle()).toHaveAttribute('aria-valuemax', '320');
  });

  it('resizes from the keyboard', async () => {
    const user = userEvent.setup();
    render(<DashboardLayout />);

    handle().focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');

    expect(handle()).toHaveAttribute('aria-valuenow', '256');

    await user.keyboard('{ArrowLeft}');

    expect(handle()).toHaveAttribute('aria-valuenow', '240');
  });

  it('stays within its bounds', async () => {
    const user = userEvent.setup();
    render(<DashboardLayout />);

    handle().focus();
    await user.keyboard('{ArrowLeft>20/}');

    expect(handle()).toHaveAttribute('aria-valuenow', '192');

    await user.keyboard('{ArrowRight>40/}');

    expect(handle()).toHaveAttribute('aria-valuenow', '320');
  });

  it('returns to the default width on double click', async () => {
    const user = userEvent.setup();
    render(<DashboardLayout />);

    handle().focus();
    await user.keyboard('{ArrowRight}');
    await user.dblClick(handle());

    expect(handle()).toHaveAttribute('aria-valuenow', '224');
  });

  it('remembers the width across mounts', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DashboardLayout />);

    handle().focus();
    await user.keyboard('{ArrowRight}');
    unmount();

    render(<DashboardLayout />);

    expect(handle()).toHaveAttribute('aria-valuenow', '240');
  });
});

const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('DashboardLayout split view', () => {
  const splitHandle = () =>
    screen.getByRole('separator', { name: 'Resize split view' });

  const drag = (to: number) => {
    fireEvent.pointerDown(splitHandle(), { clientX: 0, pointerId: 1 });
    wait(100);
    fireEvent.pointerMove(splitHandle(), { clientX: to, pointerId: 1 });
    wait(100);
    fireEvent.pointerUp(splitHandle(), { clientX: to, pointerId: 1 });
  };

  const renderSplit = (onCollapse = vi.fn(), panesKey = 'a:b') =>
    render(
      <DashboardLayout
        split={<p>split slot</p>}
        panesKey={panesKey}
        onCollapse={onCollapse}
      >
        <p>content slot</p>
      </DashboardLayout>,
    );

  const pane = (text: string) =>
    screen.getByText(text).closest('section') as HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('slides the split pane away before hiding it', () => {
    const onCollapse = vi.fn();
    renderSplit(onCollapse);

    drag(500);

    expect(pane('split slot')).toHaveAttribute('data-collapsing');
    expect(pane('split slot').closest('[inert]')).not.toBeNull();
    expect(onCollapse).not.toHaveBeenCalled();

    wait(350);

    expect(onCollapse).toHaveBeenCalledWith('split');
    expect(splitHandle()).toHaveAttribute('aria-valuenow', '560');
  });

  it('slides the main pane away before hiding it', () => {
    const onCollapse = vi.fn();
    renderSplit(onCollapse);
    Object.defineProperty(
      splitHandle().parentElement?.parentElement,
      'clientWidth',
      {
        value: 1000,
      },
    );

    drag(-400);

    expect(pane('content slot')).toHaveAttribute('data-collapsing');
    expect(pane('split slot')).not.toHaveAttribute('data-collapsing');
    expect(onCollapse).not.toHaveBeenCalled();

    wait(350);

    expect(onCollapse).toHaveBeenCalledWith('main');
  });

  it('follows the pointer past the smallest main pane', () => {
    renderSplit();
    const splitPane = splitHandle().parentElement as HTMLElement;
    Object.defineProperty(splitPane.parentElement, 'clientWidth', {
      value: 1000,
    });

    fireEvent.pointerDown(splitHandle(), { clientX: 0, pointerId: 1 });
    wait(100);
    fireEvent.pointerMove(splitHandle(), { clientX: -100, pointerId: 1 });

    expect(splitPane.style.getPropertyValue('--split-drag')).toBe('');

    wait(100);
    fireEvent.pointerMove(splitHandle(), { clientX: -150, pointerId: 1 });

    expect(splitPane.style.getPropertyValue('--split-drag')).toBe('710px');
    expect(pane('content slot')).not.toHaveAttribute('data-collapsing');
  });

  it('keeps a pane that another tab replaced while it was sliding away', () => {
    const onCollapse = vi.fn();
    const { rerender } = renderSplit(onCollapse);

    drag(500);
    rerender(
      <DashboardLayout
        split={<p>split slot</p>}
        panesKey="a:c"
        onCollapse={onCollapse}
      >
        <p>content slot</p>
      </DashboardLayout>,
    );
    wait(350);

    expect(onCollapse).not.toHaveBeenCalled();
    expect(pane('split slot')).not.toHaveAttribute('data-collapsing');
    expect(pane('split slot').closest('[inert]')).toBeNull();
  });

  it('keeps both panes after an ordinary resize', () => {
    const onCollapse = vi.fn();
    renderSplit(onCollapse);

    drag(100);
    wait(350);

    expect(onCollapse).not.toHaveBeenCalled();
    expect(pane('split slot')).not.toHaveAttribute('data-collapsing');
  });
});

describe('DashboardLayout sidebar', () => {
  const sidebarHandle = () =>
    screen.getByRole('separator', { name: 'Resize sidebar' });

  const gutter = () =>
    document.querySelector('[data-slot="sidebar-gutter"]') as HTMLElement;

  const aside = () => screen.getByText('sidebar slot').closest('aside');

  const expandButton = () =>
    screen.getByRole('button', { name: 'Expand sidebar' });

  const dragSidebar = (...path: number[]) => {
    const [from, ...rest] = path;
    fireEvent.pointerDown(sidebarHandle(), { clientX: from, pointerId: 1 });
    for (const x of rest) {
      wait(100);
      fireEvent.pointerMove(sidebarHandle(), { clientX: x, pointerId: 1 });
    }
    wait(100);
    fireEvent.pointerUp(sidebarHandle(), {
      clientX: rest.at(-1) ?? from,
      pointerId: 1,
    });
  };

  const flick = (...path: number[]) => {
    const [from, ...rest] = path;
    fireEvent.pointerDown(sidebarHandle(), { clientX: from, pointerId: 1 });
    for (const x of rest.slice(0, -1)) {
      wait(20);
      fireEvent.pointerMove(sidebarHandle(), { clientX: x, pointerId: 1 });
    }
    wait(20);
    fireEvent.pointerUp(sidebarHandle(), {
      clientX: rest.at(-1),
      pointerId: 1,
    });
  };

  const renderLayout = () =>
    render(
      <DashboardLayout
        sidebar={
          <>
            <p>sidebar slot</p>
            <a href="/inbox">Inbox</a>
          </>
        }
      >
        <p>content slot</p>
      </DashboardLayout>,
    );

  const renderCollapsed = () => {
    localStorage.setItem('spotlight.sidebar-collapsed', 'true');
    return renderLayout();
  };

  const edge = () =>
    document.querySelector('[data-slot="sidebar-peek"]') as Element;

  const peek = () => {
    fireEvent.pointerEnter(
      document.querySelector('[data-slot="sidebar-expand"]') as Element,
    );
    wait(75);
  };

  const press = (init: KeyboardEventInit, target: Element = document.body) =>
    fireEvent.keyDown(target, { key: '[', ...init });

  const collapsedNow = () =>
    localStorage.getItem('spotlight.sidebar-collapsed') === 'true';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the collapse button out of reach while the sidebar is open', () => {
    renderLayout();
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });

    expect(toggle.closest('[inert]')).not.toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', aside()?.id);
  });

  it('toggles the sidebar with the [ key', () => {
    renderLayout();

    press({});

    expect(aside()).toHaveAttribute('data-collapsed');

    press({});

    expect(aside()).not.toHaveAttribute('data-collapsed');
  });

  it('ignores a repeated [ key', () => {
    renderLayout();

    press({ repeat: true });

    expect(collapsedNow()).toBe(false);
  });

  it('ignores the [ key with a modifier', () => {
    renderLayout();

    press({ ctrlKey: true });
    press({ metaKey: true });
    press({ altKey: true });

    expect(collapsedNow()).toBe(false);
  });

  it('ignores the [ key while typing', () => {
    render(
      <DashboardLayout sidebar={<input aria-label="Search" />}>
        <p>content slot</p>
      </DashboardLayout>,
    );

    press({}, screen.getByRole('textbox', { name: 'Search' }));

    expect(collapsedNow()).toBe(false);
  });

  it('ignores the [ key while focus is in a dialog or menu', () => {
    render(
      <>
        <DashboardLayout sidebar={<p>sidebar slot</p>} />
        <div role="dialog">
          <button type="button">In dialog</button>
        </div>
        <div role="menu">
          <button type="button">In menu</button>
        </div>
      </>,
    );

    screen.getByRole('button', { name: 'In dialog' }).focus();
    press({});
    screen.getByRole('button', { name: 'In menu' }).focus();
    press({});

    expect(collapsedNow()).toBe(false);

    (document.activeElement as HTMLElement).blur();
    press({});

    expect(collapsedNow()).toBe(true);
  });

  it('ignores the [ key while the sidebar cannot show', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    renderLayout();

    press({});

    expect(collapsedNow()).toBe(false);
  });

  it('collapses on Enter at the resize handle and keeps focus on the expand button', () => {
    renderLayout();

    sidebarHandle().focus();
    fireEvent.keyDown(sidebarHandle(), { key: 'Enter' });

    expect(aside()).toHaveAttribute('data-collapsed');
    expect(expandButton()).toHaveFocus();
  });

  it('moves focus back into the sidebar when it opens', () => {
    renderLayout();
    const link = screen.getByRole('link', { name: 'Inbox' });

    link.focus();
    press({});

    expect(expandButton()).toHaveFocus();

    press({});

    expect(link).toHaveFocus();
  });

  it('focuses the first link when the expand button opens the sidebar', () => {
    renderCollapsed();

    expandButton().focus();
    fireEvent.click(expandButton());

    expect(screen.getByRole('link', { name: 'Inbox' })).toHaveFocus();
  });

  it('closes the sidebar when its edge is dragged to the side of the window', () => {
    renderLayout();

    dragSidebar(224, 40);

    expect(aside()).toHaveAttribute('inert');
    expect(aside()).toHaveAttribute('data-closing');

    wait(350);

    expect(aside()).not.toHaveAttribute('data-closing');

    fireEvent.click(expandButton());

    expect(sidebarHandle()).toHaveAttribute('aria-valuenow', '224');
    expect(gutter().style.getPropertyValue('--sidebar-width')).toBe('224px');
    expect(aside()).not.toHaveAttribute('inert');
  });

  it('reopens at the remembered width after a drag past the narrowest width closes it', () => {
    localStorage.setItem('spotlight.sidebar-width', '300');
    renderLayout();

    dragSidebar(300, 200, 120, 40);
    wait(350);
    press({});

    expect(gutter().style.getPropertyValue('--sidebar-width')).toBe('300px');
    expect(localStorage.getItem('spotlight.sidebar-width')).toBe('300');
  });

  it('closes the sidebar on a fast flick short of the closing edge', () => {
    renderLayout();

    flick(224, 180, 150);

    expect(aside()).toHaveAttribute('data-collapsed');
  });

  it('closes a wide sidebar on a fast flick that moves it meaningfully', () => {
    localStorage.setItem('spotlight.sidebar-width', '320');
    renderLayout();

    flick(320, 270, 220);

    expect(aside()).toHaveAttribute('data-collapsed');
    expect(localStorage.getItem('spotlight.sidebar-width')).toBe('320');
  });

  it('keeps the sidebar open after a slow resize below the narrowest width', () => {
    renderLayout();

    dragSidebar(224, 180, 150);

    expect(aside()).not.toHaveAttribute('data-collapsed');
    expect(sidebarHandle()).toHaveAttribute('aria-valuenow', '192');
    expect(gutter().style.getPropertyValue('--sidebar-drag')).toBe('');
    expect(gutter().style.getPropertyValue('--sidebar-width')).toBe('192px');
  });

  it('keeps the sidebar space in step with its width after a drag back out of closing', () => {
    renderLayout();

    dragSidebar(224, 40, 260);

    expect(sidebarHandle()).toHaveAttribute('aria-valuenow', '260');
    expect(gutter().style.getPropertyValue('--sidebar-drag')).toBe('');
    expect(gutter().style.getPropertyValue('--sidebar-width')).toBe('260px');
  });

  it('follows the pointer below the narrowest width instead of jumping', () => {
    renderLayout();

    fireEvent.pointerDown(sidebarHandle(), { clientX: 224, pointerId: 1 });
    fireEvent.pointerMove(sidebarHandle(), { clientX: 150, pointerId: 1 });

    expect(gutter().style.getPropertyValue('--sidebar-drag')).toBe('150px');

    fireEvent.pointerMove(sidebarHandle(), { clientX: 90, pointerId: 1 });

    expect(gutter().style.getPropertyValue('--sidebar-drag')).toBe('90px');
    expect(aside()).toHaveAttribute('data-closing');
  });

  it('restores the starting width when the pointer capture is lost', () => {
    renderLayout();

    fireEvent.pointerDown(sidebarHandle(), { clientX: 224, pointerId: 1 });
    fireEvent.pointerMove(sidebarHandle(), { clientX: 150, pointerId: 1 });
    fireEvent.lostPointerCapture(sidebarHandle(), { pointerId: 1 });

    expect(aside()).not.toHaveAttribute('data-collapsed');
    expect(aside()).not.toHaveAttribute('data-closing');
    expect(gutter()).not.toHaveAttribute('data-resizing');
    expect(gutter().style.getPropertyValue('--sidebar-drag')).toBe('');
    expect(sidebarHandle()).toHaveAttribute('aria-valuenow', '224');
    expect(localStorage.getItem('spotlight.sidebar-width')).toBe('224');
  });

  it('shows the closed sidebar once the pointer rests on the expand button', () => {
    renderCollapsed();
    const slot = document.querySelector(
      '[data-slot="sidebar-expand"]',
    ) as Element;

    fireEvent.pointerEnter(slot);
    wait(74);
    fireEvent.pointerLeave(slot);
    wait(100);

    expect(aside()).not.toHaveAttribute('data-peeking');

    peek();

    expect(aside()).toHaveAttribute('data-peeking');
    expect(aside()).not.toHaveAttribute('inert');
  });

  it('shows the closed sidebar while the pointer rests at the window edge', () => {
    renderCollapsed();

    fireEvent.pointerEnter(edge());
    wait(75);

    expect(aside()).toHaveAttribute('data-peeking');
  });

  it('waits for the pointer to leave the window edge before showing a sidebar it just closed', () => {
    renderLayout();

    dragSidebar(224, 2);
    fireEvent.pointerEnter(edge());
    wait(100);

    expect(aside()).not.toHaveAttribute('data-peeking');

    fireEvent.pointerMove(document, { clientX: 60, clientY: 300 });
    fireEvent.pointerEnter(edge());
    wait(75);

    expect(aside()).toHaveAttribute('data-peeking');
  });

  it('ignores the window edge while a button is held', () => {
    renderCollapsed();

    fireEvent.pointerEnter(edge(), { buttons: 1 });
    wait(100);

    expect(aside()).not.toHaveAttribute('data-peeking');
  });

  it('hides the shown sidebar 300 ms after the pointer leaves the panel and the expand button', () => {
    renderCollapsed();
    peek();
    const panel = aside() as HTMLElement;
    for (const [key, value] of Object.entries({
      offsetLeft: 0,
      offsetTop: 44,
      offsetWidth: 224,
      offsetHeight: 800,
    })) {
      Object.defineProperty(panel, key, { value });
    }
    expandButton().getBoundingClientRect = () =>
      ({ left: 8, top: 8, width: 28, height: 28 }) as DOMRect;
    const move = (clientX: number, clientY: number) =>
      fireEvent.pointerMove(document, { clientX, clientY });

    move(500, 300);
    wait(299);

    expect(aside()).toHaveAttribute('data-peeking');

    move(100, 300);
    wait(300);
    move(20, 20);
    wait(300);

    expect(aside()).toHaveAttribute('data-peeking');

    move(100, 20);
    wait(300);

    expect(aside()).not.toHaveAttribute('data-peeking');
  });

  it('hides the shown sidebar on Escape', () => {
    renderCollapsed();

    peek();
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(aside()).not.toHaveAttribute('data-peeking');
  });

  it('keeps the closed sidebar over the page while it slides away', () => {
    renderCollapsed();

    peek();
    fireEvent.click(
      document.querySelector('[data-slot="sidebar-backdrop"]') as Element,
    );

    expect(aside()).not.toHaveAttribute('data-peeking');
    expect(aside()).toHaveAttribute('data-floating');
    expect(aside()).toHaveAttribute('inert');
  });

  it('docks the shown sidebar when it is expanded', () => {
    renderCollapsed();

    peek();
    fireEvent.click(expandButton());

    expect(aside()).not.toHaveAttribute('data-floating');
    expect(aside()).not.toHaveAttribute('data-collapsed');
    expect(localStorage.getItem('spotlight.sidebar-collapsed')).toBe('false');
  });
});
