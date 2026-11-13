import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DashboardLayout,
  type Pane,
} from '@/components/shell/layout/DashboardLayout';
import { SPRING_MS } from '@/lib/motion';

const firedAt =
  (type: 'pointerDown' | 'pointerMove' | 'pointerUp') =>
  (target: Element | Document, init: PointerEventInit) => {
    const event = createEvent[type](target, init);
    Object.defineProperty(event, 'timeStamp', { value: Date.now() });
    fireEvent(target, event);
  };

const pointer = {
  pointerDown: firedAt('pointerDown'),
  pointerMove: firedAt('pointerMove'),
  pointerUp: firedAt('pointerUp'),
};

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

  const row = () => splitHandle().closest('.\\@container') as HTMLElement;

  const splitColumn = () => splitHandle().parentElement as HTMLElement;

  const drag = (to: number) => {
    pointer.pointerDown(splitHandle(), { clientX: 0, pointerId: 1 });
    wait(100);
    pointer.pointerMove(splitHandle(), { clientX: to, pointerId: 1 });
    wait(100);
    pointer.pointerUp(splitHandle(), { clientX: to, pointerId: 1 });
  };

  const panesOf = (...keys: string[]): Pane[] =>
    keys.map((key) => ({
      key,
      content: (
        <>
          <p>{key} slot</p>
          <input aria-label={`${key} draft`} />
        </>
      ),
    }));

  const renderSplit = (onCollapse = vi.fn(), keys = ['a', 'b']) => {
    const view = render(
      <DashboardLayout panes={panesOf(...keys)} onCollapse={onCollapse} />,
    );
    const show = (...next: string[]) =>
      view.rerender(
        <DashboardLayout panes={panesOf(...next)} onCollapse={onCollapse} />,
      );

    return { ...view, show };
  };

  const pane = (text: string) => screen.queryByText(text)?.closest('section');

  const roomOf = (width: number) =>
    Object.defineProperty(row(), 'clientWidth', { value: width });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('hides the split pane at release and lets it slide away', () => {
    const onCollapse = vi.fn();
    const { show } = renderSplit(onCollapse);

    drag(500);

    expect(onCollapse).toHaveBeenCalledWith('split');

    show('a');

    expect(pane('b slot')).toHaveAttribute('data-collapsing');
    expect(pane('b slot')?.closest('[inert]')).not.toBeNull();

    wait(SPRING_MS);

    expect(pane('b slot')).toBeUndefined();
    expect(
      screen.queryByRole('separator', { name: 'Resize split view' }),
    ).toBeNull();
  });

  it('drops a closed pane at once when motion is reduced', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
    }));
    const onCollapse = vi.fn();
    const { show } = renderSplit(onCollapse);

    drag(500);
    show('a');

    expect(onCollapse).toHaveBeenCalledWith('split');
    expect(pane('b slot')).toBeUndefined();
  });

  it('hides the main pane at release and lets it slide away', () => {
    const onCollapse = vi.fn();
    const { show } = renderSplit(onCollapse);
    roomOf(1000);

    drag(-400);

    expect(onCollapse).toHaveBeenCalledWith('main');

    show('b');

    expect(pane('a slot')).toHaveAttribute('data-collapsing');
    expect(pane('a slot')?.closest('[inert]')).not.toBeNull();
    expect(pane('b slot')).not.toHaveAttribute('data-collapsing');

    wait(SPRING_MS);

    expect(pane('a slot')).toBeUndefined();
  });

  it('keeps the surviving pane mounted when the main pane closes', () => {
    const { show } = renderSplit();
    const draft = screen.getByRole('textbox', { name: 'b draft' });
    fireEvent.change(draft, { target: { value: 'unsent' } });
    roomOf(1000);

    drag(-400);
    show('b');
    wait(SPRING_MS);

    expect(screen.getByRole('textbox', { name: 'b draft' })).toBe(draft);
    expect(draft).toHaveValue('unsent');
    expect(draft.closest('[inert]')).toBeNull();
  });

  it('moves focus to the surviving pane before the closed one goes inert', () => {
    renderSplit();

    screen.getByRole('textbox', { name: 'b draft' }).focus();
    drag(500);

    expect(pane('a slot')).toHaveFocus();
  });

  it('shows a tab dropped into the split while the closed pane slides away', () => {
    const { show } = renderSplit();

    drag(500);
    show('a');
    show('a', 'c');

    expect(pane('c slot')).not.toHaveAttribute('data-collapsing');
    expect(pane('c slot')?.closest('[inert]')).toBeNull();

    wait(SPRING_MS);

    expect(pane('b slot')).toBeUndefined();
    expect(pane('c slot')).toBeInTheDocument();
  });

  it('starts a drag from the width the split pane shows', () => {
    const onCollapse = vi.fn();
    renderSplit(onCollapse);
    roomOf(478);
    Object.defineProperty(splitColumn(), 'offsetWidth', { value: 235 });

    drag(-2);
    wait(SPRING_MS);

    expect(onCollapse).not.toHaveBeenCalled();
    expect(pane('a slot')).not.toHaveAttribute('data-collapsing');
  });

  it('keeps the remembered width when the room is too small for it', () => {
    renderSplit();
    roomOf(478);
    splitColumn().style.maxWidth = '235px';
    Object.defineProperty(splitColumn(), 'offsetWidth', { value: 235 });

    drag(-20);

    expect(splitHandle()).toHaveAttribute('aria-valuenow', '560');
    expect(localStorage.getItem('spotlight.split-width')).toBeNull();
  });

  it('follows the pointer past the smallest main pane', () => {
    renderSplit();
    roomOf(1000);
    splitColumn().style.maxWidth = '672px';

    pointer.pointerDown(splitHandle(), { clientX: 0, pointerId: 1 });
    wait(100);
    pointer.pointerMove(splitHandle(), { clientX: -100, pointerId: 1 });

    expect(row().style.getPropertyValue('--split-drag')).toBe('');

    wait(100);
    pointer.pointerMove(splitHandle(), { clientX: -150, pointerId: 1 });

    expect(row().style.getPropertyValue('--split-drag')).toBe('710px');
    expect(pane('a slot')).not.toHaveAttribute('data-collapsing');
  });

  it('stores no more split width than the room leaves', () => {
    renderSplit();
    roomOf(1000);
    splitColumn().style.maxWidth = '672px';

    drag(-150);

    expect(splitHandle()).toHaveAttribute('aria-valuenow', '672');
  });

  it('keeps keyboard resizing within the room', () => {
    renderSplit();
    splitColumn().style.maxWidth = '600px';

    for (let step = 0; step < 5; step += 1) {
      fireEvent.keyDown(splitHandle(), { key: 'ArrowLeft' });
    }

    expect(splitHandle()).toHaveAttribute('aria-valuenow', '600');

    fireEvent.keyDown(splitHandle(), { key: 'ArrowRight' });

    expect(splitHandle()).toHaveAttribute('aria-valuenow', '584');
  });

  it('ignores a drag with a button other than the primary one', () => {
    renderSplit();

    pointer.pointerDown(splitHandle(), {
      clientX: 0,
      button: 2,
      pointerId: 1,
    });
    pointer.pointerMove(splitHandle(), { clientX: 500, pointerId: 1 });

    expect(pane('b slot')).not.toHaveAttribute('data-collapsing');
    expect(row().style.getPropertyValue('--split-drag')).toBe('');
  });

  it('keeps both panes after an ordinary resize', () => {
    const onCollapse = vi.fn();
    renderSplit(onCollapse);

    drag(100);
    wait(SPRING_MS);

    expect(onCollapse).not.toHaveBeenCalled();
    expect(pane('b slot')).not.toHaveAttribute('data-collapsing');
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
    pointer.pointerDown(sidebarHandle(), { clientX: from, pointerId: 1 });
    for (const x of rest) {
      wait(100);
      pointer.pointerMove(sidebarHandle(), { clientX: x, pointerId: 1 });
    }
    wait(100);
    pointer.pointerUp(sidebarHandle(), {
      clientX: rest.at(-1) ?? from,
      pointerId: 1,
    });
  };

  const flick = (...path: number[]) => {
    const [from, ...rest] = path;
    pointer.pointerDown(sidebarHandle(), { clientX: from, pointerId: 1 });
    for (const x of rest.slice(0, -1)) {
      wait(20);
      pointer.pointerMove(sidebarHandle(), { clientX: x, pointerId: 1 });
    }
    wait(20);
    pointer.pointerUp(sidebarHandle(), {
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

  it.each([
    ['repeated', { repeat: true }],
    ['with Ctrl', { ctrlKey: true }],
    ['with Command', { metaKey: true }],
    ['with Option', { altKey: true }],
    ['with Shift', { shiftKey: true }],
  ])('ignores the [ key %s', (_name, init) => {
    renderLayout();

    press(init);

    expect(collapsedNow()).toBe(false);
  });

  it('ignores a [ key that something else handled', () => {
    renderLayout();
    const handled = (event: KeyboardEvent) => event.preventDefault();
    document.body.addEventListener('keydown', handled);

    press({});
    document.body.removeEventListener('keydown', handled);

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

  it('ignores the [ key in editable text', () => {
    render(
      <DashboardLayout sidebar={<p>sidebar slot</p>}>
        <div contentEditable aria-label="Note" />
      </DashboardLayout>,
    );
    const note = screen.getByLabelText('Note');
    Object.defineProperty(note, 'isContentEditable', { value: true });

    press({}, note);

    expect(collapsedNow()).toBe(false);
  });

  it.each(['dialog', 'menu', 'listbox'])(
    'ignores the [ key while focus is in a %s',
    (role) => {
      render(
        <>
          <DashboardLayout sidebar={<p>sidebar slot</p>} />
          <div role={role}>
            <button type="button">Inside</button>
          </div>
        </>,
      );

      screen.getByRole('button', { name: 'Inside' }).focus();
      press({});

      expect(collapsedNow()).toBe(false);
    },
  );

  it('collapses on a plain [ key', () => {
    renderLayout();

    press({});

    expect(collapsedNow()).toBe(true);
  });

  it('ignores the [ key while there is no sidebar to show', () => {
    localStorage.setItem('spotlight.sidebar-collapsed', 'true');
    render(
      <DashboardLayout>
        <p>content slot</p>
      </DashboardLayout>,
    );

    press({});

    expect(collapsedNow()).toBe(true);
    expect(document.querySelector('[data-slot="sidebar-peek"]')).toBeNull();
    expect(expandButton()).toBeDisabled();
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

    press({});

    expect(sidebarHandle()).toHaveFocus();
  });

  it('keeps focus on the toggle when it opens the sidebar in the desktop app', () => {
    vi.stubGlobal('spotlightDesktop', { platform: 'darwin' });
    renderLayout();

    screen.getByRole('link', { name: 'Inbox' }).focus();
    press({});

    expect(expandButton()).toHaveFocus();

    press({});

    expect(
      screen.getByRole('button', { name: 'Collapse sidebar' }),
    ).toHaveFocus();
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

    wait(SPRING_MS);

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
    wait(SPRING_MS);
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

    pointer.pointerDown(sidebarHandle(), { clientX: 224, pointerId: 1 });
    pointer.pointerMove(sidebarHandle(), { clientX: 150, pointerId: 1 });

    expect(gutter().style.getPropertyValue('--sidebar-drag')).toBe('150px');

    pointer.pointerMove(sidebarHandle(), { clientX: 90, pointerId: 1 });

    expect(gutter().style.getPropertyValue('--sidebar-drag')).toBe('90px');
    expect(aside()).toHaveAttribute('data-closing');
  });

  it('restores the starting width when the pointer capture is lost', () => {
    renderLayout();

    pointer.pointerDown(sidebarHandle(), { clientX: 224, pointerId: 1 });
    pointer.pointerMove(sidebarHandle(), { clientX: 150, pointerId: 1 });
    fireEvent.lostPointerCapture(sidebarHandle(), { pointerId: 1 });

    expect(aside()).not.toHaveAttribute('data-collapsed');
    expect(aside()).not.toHaveAttribute('data-closing');
    expect(document.body).not.toHaveClass('resizing');
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

    pointer.pointerMove(document, { clientX: 60, clientY: 300 });
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
      pointer.pointerMove(document, { clientX, clientY });

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

  it('keeps the backdrop while a shown sidebar docks', () => {
    renderCollapsed();
    const backdrop = () =>
      document.querySelector('[data-slot="sidebar-backdrop"]');

    peek();
    fireEvent.click(expandButton());

    expect(backdrop()).not.toBeNull();

    wait(SPRING_MS);

    expect(backdrop()).toBeNull();
  });

  it('docks the closed sidebar again once a shown sidebar has slid away', () => {
    renderCollapsed();

    peek();
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(aside()).toHaveAttribute('data-floating');

    wait(SPRING_MS);

    expect(aside()).not.toHaveAttribute('data-floating');
  });

  it('waits for the pointer to move away before it shows the sidebar again after Escape', () => {
    renderCollapsed();

    fireEvent.pointerEnter(edge());
    wait(75);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.pointerEnter(edge());
    wait(200);

    expect(aside()).not.toHaveAttribute('data-peeking');

    pointer.pointerMove(document, { clientX: 60, clientY: 300 });
    fireEvent.pointerEnter(edge());
    wait(75);

    expect(aside()).toHaveAttribute('data-peeking');
  });
});
