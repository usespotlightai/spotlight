import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReviewProvider } from '@/components/features/review/ReviewProvider';
import { useReviewing, useStackTeam } from '@/lib/review-context';

function Shown() {
  const reviewing = useReviewing();
  const team = useStackTeam();

  return (
    <p>
      {team ?? 'no team'} {reviewing ? reviewing.taskId : 'no review'}
    </p>
  );
}

const provided = (taskId: string | null) =>
  render(
    <ReviewProvider
      teamId="team_1"
      taskId={taskId}
      repository={null}
      alone
      review={undefined}
    >
      <Shown />
    </ReviewProvider>,
  );

describe('ReviewProvider', () => {
  it('reviews the changes of a task in its team', () => {
    provided('task_1');

    expect(screen.getByText('team_1 task_1')).toBeInTheDocument();
  });

  it('gives the team to answer questions in, with no review, on a run of no task', () => {
    provided(null);

    expect(screen.getByText('team_1 no review')).toBeInTheDocument();
  });
});
