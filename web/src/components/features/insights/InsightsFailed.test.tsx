import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';

const query = (error: unknown) => ({
  error,
  isFetching: false,
  refetch: vi.fn(),
});

describe('InsightsFailed', () => {
  it('says what could not be loaded, and tries again on request', async () => {
    const failing = query(new Error('The control plane did not answer.'));

    render(<InsightsFailed what="The overview" query={failing} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The overview could not be loaded.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(failing.refetch).toHaveBeenCalled();
  });

  it('tells someone off the team that only its members can see its Insights', () => {
    render(
      <InsightsFailed what="The overview" query={query({ statusCode: 404 })} />,
    );

    expect(
      screen.getByText('Only team members can see Insights'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });
});
