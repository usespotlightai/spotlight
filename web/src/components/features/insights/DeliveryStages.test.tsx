import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DeliveryStages } from '@/components/features/insights/DeliveryStages';
import type { Flow } from '@/lib/insights';

const spread = { p50Ms: null, p90Ms: null, count: 0 };

const delivery = (over: Partial<Flow['delivery']> = {}): Flow['delivery'] => ({
  toPullRequest: spread,
  toFirstReview: spread,
  toMerge: spread,
  opened: 3,
  reviewed: 2,
  merged: 1,
  openedTaskIds: ['task_1', 'task_2', 'task_3'],
  reviewedTaskIds: ['task_1', 'task_2'],
  mergedTaskIds: ['task_1'],
  changes: {
    opened: {
      unit: 'percent',
      by: 0.5,
      fromZero: false,
      direction: 'up',
      tone: 'good',
    },
    reviewed: null,
    merged: null,
  },
  ...over,
});

const showing = (now: Flow['delivery']) =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/insights?tab=flow']}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/insights"
          element={<DeliveryStages delivery={now} />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('DeliveryStages', () => {
  it('opens the runs of the tasks whose pull requests were first reviewed', () => {
    showing(delivery());

    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=traces&taskIds=task_1%2Ctask_2',
    );
  });

  it('marks a count with how it moved against the period before', () => {
    showing(delivery());

    expect(screen.getByText('+50%')).toBeInTheDocument();
  });

  it('opens nothing where no pull request was first reviewed', () => {
    showing(delivery({ reviewed: 0, reviewedTaskIds: [] }));

    expect(screen.queryByRole('link', { name: '0' })).toBeNull();
  });
});
