import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { DecisionThread } from '@/components/features/decisions/DecisionThread';
import type { Decision } from '@/lib/decision';

vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: undefined }),
}));

const QUEUE: Decision = {
  id: 'decision_queue',
  kind: 'trade-off',
  title: 'Retries in the request, not from a queue',
  why: 'A queue needs a worker the service does not run.',
  alternatives: [],
  paths: ['api/src/uploads.ts', 'web/src/Upload.tsx'],
  steps: [3],
  disputes: [
    {
      id: 'dispute_1',
      path: 'api/src/uploads.ts',
      by: 'user_maya',
      byName: 'Maya Chen',
      reason: 'The worker ships next week.',
      at: '2026-09-21T10:00:00.000Z',
    },
    {
      id: 'dispute_2',
      path: 'web/src/Upload.tsx',
      by: 'user_sam',
      byName: 'Sam Lee',
      reason: 'The browser retries already.',
      at: '2026-09-21T11:00:00.000Z',
    },
  ],
};

const shown = (path: string) => {
  const dispute = vi.fn(async () => undefined);
  render(
    <MemoryRouter>
      <DecisionThread
        decision={QUEUE}
        path={path}
        reasoningAt="/runs/run_1"
        disputing={{ pending: false, failed: false, dispute }}
      />
    </MemoryRouter>,
  );
  return { dispute };
};

describe('DecisionThread', () => {
  it('opens with Spotlight’s decision and reasons, linked to its reasoning', () => {
    shown('api/src/uploads.ts');

    const thread = screen.getByRole('region', {
      name: `Decision: ${QUEUE.title}`,
    });

    expect(thread).toHaveTextContent('Spotlight');
    expect(thread).toHaveTextContent('Decision');
    expect(thread).toHaveTextContent(QUEUE.title);
    expect(thread).toHaveTextContent(QUEUE.why);
    expect(
      screen.getByRole('link', { name: 'Detailed reasoning steps' }),
    ).toHaveAttribute('href', '/runs/run_1');
    expect(
      screen.getByRole('link', { name: 'Detailed reasoning steps' }),
    ).toHaveAttribute('target', '_blank');
  });

  it('follows with the disputes on this file only', () => {
    shown('api/src/uploads.ts');

    expect(screen.getByText('The worker ships next week.')).toBeInTheDocument();
    expect(
      screen.queryByText('The browser retries already.'),
    ).not.toBeInTheDocument();
  });

  it('replies to the decision on this file, as a dispute', async () => {
    const { dispute } = shown('web/src/Upload.tsx');

    await userEvent.click(screen.getByRole('button', { name: 'Reply…' }));
    await userEvent.type(
      screen.getByRole('textbox', {
        name: `Reply to “${QUEUE.title}”`,
      }),
      'It retries twice already.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));

    expect(dispute).toHaveBeenCalledWith(
      'decision_queue',
      'web/src/Upload.tsx',
      'It retries twice already.',
    );
  });
});
