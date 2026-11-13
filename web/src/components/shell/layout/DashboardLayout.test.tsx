import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('DashboardLayout split view', () => {
  const splitHandle = () =>
    screen.getByRole('separator', { name: 'Resize split view' });

  const drag = (to: number) => {
    fireEvent.pointerDown(splitHandle(), { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(splitHandle(), { clientX: to, pointerId: 1 });
    fireEvent.pointerUp(splitHandle(), { clientX: to, pointerId: 1 });
  };

  it('hides the split pane when its edge is dragged to the side of the window', () => {
    const onCollapse = vi.fn();
    render(
      <DashboardLayout split={<p>split slot</p>} onCollapse={onCollapse}>
        <p>content slot</p>
      </DashboardLayout>,
    );

    drag(500);

    expect(onCollapse).toHaveBeenCalledWith('split');
    expect(splitHandle()).toHaveAttribute('aria-valuenow', '560');
  });

  it('keeps both panes after an ordinary resize', () => {
    const onCollapse = vi.fn();
    render(
      <DashboardLayout split={<p>split slot</p>} onCollapse={onCollapse}>
        <p>content slot</p>
      </DashboardLayout>,
    );

    drag(100);

    expect(onCollapse).not.toHaveBeenCalled();
  });
});

describe('DashboardLayout sidebar', () => {
  const sidebarHandle = () =>
    screen.getByRole('separator', { name: 'Resize sidebar' });

  const dragSidebar = (to: number) => {
    fireEvent.pointerDown(sidebarHandle(), { clientX: 224, pointerId: 1 });
    fireEvent.pointerMove(sidebarHandle(), { clientX: to, pointerId: 1 });
    fireEvent.pointerUp(sidebarHandle(), { clientX: to, pointerId: 1 });
  };

  const renderLayout = () =>
    render(
      <DashboardLayout sidebar={<p>sidebar slot</p>}>
        <p>content slot</p>
      </DashboardLayout>,
    );

  it('offers no collapse button while the sidebar is open', () => {
    renderLayout();

    expect(
      screen.queryByRole('button', { name: 'Collapse sidebar' }),
    ).not.toBeInTheDocument();
  });

  it('closes the sidebar when its edge is dragged to the side of the window', async () => {
    const user = userEvent.setup();
    renderLayout();

    dragSidebar(40);

    expect(
      screen.queryByRole('separator', { name: 'Resize sidebar' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('sidebar slot').closest('aside')).toHaveAttribute(
      'inert',
    );

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));

    expect(sidebarHandle()).toHaveAttribute('aria-valuenow', '224');
    expect(
      screen.getByText('sidebar slot').closest('aside'),
    ).not.toHaveAttribute('inert');
  });

  it('keeps the sidebar open after an ordinary resize', () => {
    renderLayout();

    dragSidebar(180);

    expect(sidebarHandle()).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Expand sidebar' }),
    ).not.toBeInTheDocument();
  });

  it('shows the closed sidebar over the page while the pointer is on the expand button', async () => {
    const user = userEvent.setup();
    localStorage.setItem('spotlight.sidebar-collapsed', 'true');
    renderLayout();

    await user.hover(screen.getByRole('button', { name: 'Expand sidebar' }));

    expect(screen.getByText('sidebar slot').closest('aside')).toHaveAttribute(
      'data-peeking',
    );
  });

  it('shows the closed sidebar over the page while the pointer is at the window edge', () => {
    localStorage.setItem('spotlight.sidebar-collapsed', 'true');
    renderLayout();
    const aside = screen.getByText('sidebar slot').closest('aside');

    fireEvent.pointerEnter(
      document.querySelector('[data-slot="sidebar-peek"]') as Element,
    );

    expect(aside).toHaveAttribute('data-peeking');
    expect(aside).not.toHaveAttribute('inert');
  });
});
