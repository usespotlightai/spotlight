import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { DecisionTray } from '@/components/shared/decision-tray/DecisionTray';
import { Dockable } from '@/components/shared/decision-tray/Dockable';
import { DecisionActions } from '@/components/shared/DecisionActions';
import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { useDecisionTray } from '@/hooks/useDecisionTray';
import {
  DecisionTrayContext,
  type DockedDecision,
  dockedRuns,
} from '@/lib/decision-tray';

const decision = (id: string, label: string): DockedDecision => ({
  id,
  kind: label,
  label,
  group: `${label}s`,
  content: <p>{`Decide ${id}`}</p>,
});

const APPROVAL: DockedDecision = {
  id: 'approval',
  kind: 'Approval',
  label: 'Approval',
  group: 'Approvals',
  content: (
    <>
      <DecisionActions
        copy={{ text: 'linear.comment', label: 'Copy linear.comment' }}
        editLabel="Edit linear.comment"
        pending={false}
        onEdit={() => {}}
      />
      <p>Decide approval</p>
      <DecisionControls>
        <DecisionButton>Dismiss</DecisionButton>
        <DecisionButton variant="default">Approve</DecisionButton>
      </DecisionControls>
    </>
  ),
};
const CONNECTION: DockedDecision = {
  ...decision('connection', 'Connect GitHub'),
  kind: 'Connection',
};
const task = (id: string): DockedDecision => ({
  ...decision(id, `Task ${id}`),
  kind: 'Task proposal',
  group: 'Tasks proposed',
});

function Docking({ decisions }: { decisions: readonly DockedDecision[] }) {
  const tray = useDecisionTray(decisions);

  return (
    <DecisionTrayContext value={tray}>
      <ol aria-label="Thread">
        {[APPROVAL, CONNECTION, decision('setup', 'Setup')].map((each) => (
          <li key={each.id}>
            <Dockable id={each.id}>{`In the thread: ${each.id}`}</Dockable>
          </li>
        ))}
      </ol>
      <DecisionTray tray={tray}>
        <textarea aria-label="Reply" />
      </DecisionTray>
    </DecisionTrayContext>
  );
}

function Grouping({ decisions }: { decisions: readonly DockedDecision[] }) {
  const tray = useDecisionTray(decisions);
  const ids = ['first', 'second', 'between', 'third'];
  const runs = dockedRuns(tray, ids);

  return (
    <DecisionTrayContext value={tray}>
      <ol aria-label="Thread">
        {ids.map(
          (id) =>
            runs.get(id) !== 0 && (
              <li key={id}>
                <Dockable
                  id={id}
                  run={runs.get(id)}
                >{`In the thread: ${id}`}</Dockable>
              </li>
            ),
        )}
      </ol>
      <DecisionTray tray={tray} />
    </DecisionTrayContext>
  );
}

const tray = () => document.querySelector('[data-slot=decision-tray]');
const trayShows = (text: string) =>
  screen.getByText(text, { selector: '[data-slot=decision-tray] p' });

describe('DecisionTray', () => {
  it('docks an open decision above the text bar, and keeps a pill in the thread', () => {
    render(<Docking decisions={[APPROVAL]} />);

    expect(tray()).toBeVisible();
    expect(trayShows('Decide approval')).toBeVisible();
    expect(
      within(screen.getByRole('list', { name: 'Thread' })).getByRole('button', {
        name: 'Show Approval',
      }),
    ).toBeVisible();
    expect(screen.getByText('In the thread: setup')).toBeVisible();
  });

  it('puts the pager and the decision buttons in one row under the decision, and leaves out copy', () => {
    render(<Docking decisions={[APPROVAL, CONNECTION]} />);

    const row = tray()?.querySelector('footer') as HTMLElement;
    expect(within(row).getByText('1 of 2')).toBeVisible();
    expect(within(row).getByRole('button', { name: 'Approve' })).toBeVisible();
    expect(within(row).getByRole('button', { name: 'Dismiss' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Edit linear.comment' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Copy linear.comment' }),
    ).not.toBeInTheDocument();
  });

  it('collapses into one pill per type, named by the type, and a pill opens its decision', async () => {
    const user = userEvent.setup();
    render(<Docking decisions={[APPROVAL, CONNECTION]} />);

    await user.click(screen.getByRole('button', { name: 'Collapse' }));

    expect(tray()).not.toBeVisible();
    const pills = within(
      screen.getByRole('group', { name: 'Waiting for you' }),
    ).getAllByRole('button');
    expect(pills.map((pill) => pill.textContent)).toEqual([
      'Approval',
      'Connection',
    ]);

    await user.click(pills[1]);

    expect(tray()).toBeVisible();
    expect(trayShows('Decide connection')).toBeVisible();
    expect(
      screen.queryByRole('group', { name: 'Waiting for you' }),
    ).not.toBeInTheDocument();
  });

  it('pages through the decisions it holds', async () => {
    const user = userEvent.setup();
    render(<Docking decisions={[APPROVAL, CONNECTION]} />);

    expect(screen.getByText('1 of 2')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('2 of 2')).toBeVisible();
    expect(trayShows('Decide connection')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('opens again on a new decision, and shows it', async () => {
    const user = userEvent.setup();
    const shown = render(<Docking decisions={[APPROVAL]} />);
    await user.click(screen.getByRole('button', { name: 'Collapse' }));

    shown.rerender(<Docking decisions={[APPROVAL, CONNECTION]} />);

    expect(tray()).toBeVisible();
    expect(trayShows('Decide connection')).toBeVisible();
  });

  it('opens again on a decision that comes back, and shows it', async () => {
    const user = userEvent.setup();
    const shown = render(<Docking decisions={[APPROVAL, CONNECTION]} />);
    shown.rerender(<Docking decisions={[CONNECTION]} />);
    await user.click(screen.getByRole('button', { name: 'Collapse' }));

    shown.rerender(<Docking decisions={[APPROVAL, CONNECTION]} />);

    expect(tray()).toBeVisible();
    expect(trayShows('Decide approval')).toBeVisible();
  });

  it('moves a decided decision back to the thread', () => {
    const shown = render(<Docking decisions={[APPROVAL, CONNECTION]} />);

    shown.rerender(<Docking decisions={[CONNECTION]} />);

    expect(screen.getByText('In the thread: approval')).toBeVisible();
    expect(trayShows('Decide connection')).toBeVisible();
    expect(screen.queryByText('1 of 2')).not.toBeInTheDocument();
  });

  it('shows nothing above the text bar when no decision is open', () => {
    render(<Docking decisions={[]} />);

    expect(tray()).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Reply' })).toBeVisible();
  });

  it('groups decisions next to each other into one thread link, which opens the first of them', async () => {
    const user = userEvent.setup();
    render(
      <Grouping decisions={[task('first'), task('second'), task('third')]} />,
    );
    const thread = screen.getByRole('list', { name: 'Thread' });

    expect(
      within(thread)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Tasks proposed', 'In the thread: between', 'Task third']);

    await user.click(
      within(thread).getByRole('button', { name: 'Show Task third' }),
    );
    expect(trayShows('Decide third')).toBeVisible();

    await user.click(
      within(thread).getByRole('button', { name: 'Show Tasks proposed' }),
    );
    expect(trayShows('Decide first')).toBeVisible();
  });

  it('collapses decisions of one type into one pill, which opens the one shown', async () => {
    const user = userEvent.setup();
    render(
      <Grouping decisions={[task('first'), task('second'), task('third')]} />,
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Collapse' }));

    const pills = within(
      screen.getByRole('group', { name: 'Waiting for you' }),
    ).getAllByRole('button');
    expect(pills.map((pill) => pill.textContent)).toEqual(['Tasks proposed']);

    await user.click(pills[0]);

    expect(trayShows('Decide second')).toBeVisible();
  });
});
