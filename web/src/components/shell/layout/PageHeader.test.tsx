import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from '@/components/shell/layout/PageHeader';

describe('PageHeader', () => {
  it('titles the view', () => {
    render(<PageHeader title="Agent" />);

    expect(screen.getByRole('heading', { name: 'Agent' })).toBeInTheDocument();
  });

  it('renders the actions it is given', () => {
    render(
      <PageHeader
        title="Agent"
        actions={<button type="button">Filter</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
  });

  it('keeps the bar but leaves out the heading when there is no title', () => {
    const { container } = render(<PageHeader />);

    expect(container.querySelector('header')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('leaves out the actions area when there are none', () => {
    const { container } = render(<PageHeader title="Agent" />);

    expect(container.querySelector('header')?.children).toHaveLength(1);
  });
});
