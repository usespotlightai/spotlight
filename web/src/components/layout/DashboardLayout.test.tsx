import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const handle = () => screen.getByRole('separator', { name: 'Resize sidebar' });

beforeEach(() => {
  localStorage.clear();
});

describe('DashboardLayout', () => {
  it('titles the view', () => {
    render(<DashboardLayout title="Agent" />);

    expect(screen.getByRole('heading', { name: 'Agent' })).toBeInTheDocument();
  });

  it('renders the sidebar, actions and content it is given', () => {
    render(
      <DashboardLayout
        title="Agent"
        sidebar={<p>sidebar slot</p>}
        actions={<button type="button">Filter</button>}
      >
        <p>content slot</p>
      </DashboardLayout>,
    );

    expect(screen.getByText('sidebar slot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.getByText('content slot')).toBeInTheDocument();
  });

  it('leaves out the actions area when there are none', () => {
    const { container } = render(<DashboardLayout title="Agent" />);

    expect(container.querySelector('header')?.children).toHaveLength(1);
  });

  it('exposes the sidebar width through the resize handle', () => {
    render(<DashboardLayout title="Agent" />);

    expect(handle()).toHaveAttribute('aria-valuenow', '224');
    expect(handle()).toHaveAttribute('aria-valuemin', '192');
    expect(handle()).toHaveAttribute('aria-valuemax', '320');
  });

  it('resizes from the keyboard', async () => {
    const user = userEvent.setup();
    render(<DashboardLayout title="Agent" />);

    handle().focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');

    expect(handle()).toHaveAttribute('aria-valuenow', '256');

    await user.keyboard('{ArrowLeft}');

    expect(handle()).toHaveAttribute('aria-valuenow', '240');
  });

  it('refuses to go past its bounds', async () => {
    const user = userEvent.setup();
    render(<DashboardLayout title="Agent" />);

    handle().focus();
    await user.keyboard('{ArrowLeft>20/}');

    expect(handle()).toHaveAttribute('aria-valuenow', '192');

    await user.keyboard('{ArrowRight>40/}');

    expect(handle()).toHaveAttribute('aria-valuenow', '320');
  });

  it('returns to the default width on double click', async () => {
    const user = userEvent.setup();
    render(<DashboardLayout title="Agent" />);

    handle().focus();
    await user.keyboard('{ArrowRight}');
    await user.dblClick(handle());

    expect(handle()).toHaveAttribute('aria-valuenow', '224');
  });

  it('remembers the width across mounts', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DashboardLayout title="Agent" />);

    handle().focus();
    await user.keyboard('{ArrowRight}');
    unmount();

    render(<DashboardLayout title="Agent" />);

    expect(handle()).toHaveAttribute('aria-valuenow', '240');
  });
});
