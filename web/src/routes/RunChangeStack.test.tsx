import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunChangeStacks } from '@/lib/change-stack';
import { RunChangeStack } from '@/routes/RunChangeStack';
import { INVITATIONS, LARGE_FILE } from '@/test/fixtures/change-stack';

const stacks = vi.fn();
const stacksFailing = vi.fn();
const refetchStacks = vi.fn();
const review = vi.fn();
const decided = vi.fn();

vi.mock('@/hooks/api/useRunChangeStacks', () => ({
  changeStackKeys: { forRun: () => ['change-stacks'] },
  useRunChangeStacks: () => ({
    data: stacks(),
    isPending: stacks() === undefined,
    errorUpdateCount: stacksFailing() ? 1 : 0,
    isFetching: false,
    refetch: refetchStacks,
  }),
}));

vi.mock('@/hooks/api/useRunReview', () => ({
  reviewKeys: { forRun: () => ['review'] },
  useRunReview: () => ({ data: review() }),
}));

vi.mock('@/hooks/api/useTeamRuns', () => ({
  teamRunKeys: { forTeam: () => ['runs'] },
  useTeamRuns: () => ({
    data: [
      {
        id: 'run_1',
        taskId: 'task_1',
        taskTitle: 'Invite people to a team',
        station: { name: 'Implementation' },
      },
    ],
    isPending: false,
    errorUpdateCount: 0,
  }),
}));

vi.mock('@/hooks/api/useTaskDecisions', () => ({
  taskDecisionKeys: { forTask: () => ['decisions'] },
  useTaskDecisions: () => ({ data: decided() }),
}));

vi.mock('@/hooks/api/useDisputeDecision', () => ({
  useDisputeDecision: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: undefined }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
  }),
}));

vi.mock('@/components/shared/PatchCodeDiff', () => ({
  PatchCodeDiff: ({ patch }: { patch: string }) => <pre>{patch}</pre>,
}));

const renderAt = (search = '') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter
        initialEntries={[`/w/acme/team/team_1/runs/run_1/changes${search}`]}
      >
        <Routes>
          <Route
            path="/w/:slug/team/:teamId/runs/:runId/changes"
            element={<RunChangeStack />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const given = (value: RunChangeStacks | undefined) =>
  stacks.mockReturnValue(value);

beforeEach(() => {
  stacks.mockReset();
  stacksFailing.mockReturnValue(false);
  decided.mockReturnValue(undefined);
});

describe('RunChangeStack', () => {
  describe('while it loads', () => {
    it('shows the skeleton', () => {
      given(undefined);
      renderAt();

      expect(
        screen.getByRole('status', { name: 'Loading the change stack' }),
      ).toBeInTheDocument();
    });
  });

  describe('when it could not be loaded', () => {
    it('says so and tries again', async () => {
      given(undefined);
      stacksFailing.mockReturnValue(true);
      renderAt();

      expect(screen.getByRole('alert')).toHaveTextContent(
        'The change stack could not be loaded.',
      );

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(refetchStacks).toHaveBeenCalled();
    });
  });

  describe('without a stack', () => {
    it('says one appears once a station drafts it', () => {
      given({ stacks: [] });
      renderAt();

      expect(screen.getByText('No change stack yet')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Back to the run' }),
      ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_1');
    });
  });

  describe('while the stack drafts', () => {
    it('says what it is grouping', () => {
      given({
        stacks: [{ ...INVITATIONS, state: 'drafting', cohorts: [] }],
      });
      renderAt();

      expect(screen.getByText('Drafting the change stack')).toBeInTheDocument();
      expect(
        screen.getByText(/Grouping 5 changes across 5 files/),
      ).toBeInTheDocument();
    });
  });

  describe('where drafting failed', () => {
    it('says why', () => {
      given({
        stacks: [
          {
            ...INVITATIONS,
            state: 'failed',
            failure: 'Spotlight couldn’t draft the change stack.',
            cohorts: [],
          },
        ],
      });
      renderAt();

      expect(
        screen.getByText('Sorry, the change stack couldn’t be drafted'),
      ).toBeInTheDocument();
    });
  });

  describe('with a stack', () => {
    beforeEach(() => given({ stacks: [INVITATIONS] }));

    it('lists every cohort and its layers in order', () => {
      renderAt();

      const nav = screen.getByRole('navigation', { name: 'Change stack' });
      const cohort = within(nav).getByRole('region', {
        name: 'Team invitations',
      });

      expect(
        within(within(cohort).getByRole('list'))
          .getAllByRole('button')
          .map((each) => each.textContent),
      ).toEqual([
        '1Add the invitation data model1 file+11',
        '2Add the invitation API and emails2 files+17',
        '3Build the invite & members UI1 file+3−1',
      ]);
      expect(
        within(nav).getByRole('region', { name: 'Dependency bump' }),
      ).toBeInTheDocument();
    });

    it('keeps a cohort’s intent for a hover, not the sidebar', async () => {
      renderAt();

      const nav = screen.getByRole('navigation', { name: 'Change stack' });
      const cohort = within(nav).getByRole('region', {
        name: 'Team invitations',
      });

      expect(cohort).not.toHaveTextContent('Let admins invite people');

      await userEvent.hover(
        within(cohort).getByRole('button', { name: /Team invitations/ }),
      );

      expect(
        await screen.findByText(/Let admins invite people/),
      ).toBeInTheDocument();
    });

    it('folds a cohort away and back', async () => {
      renderAt();

      const cohort = screen.getByRole('region', { name: 'Team invitations' });
      const heading = within(cohort).getByRole('button', {
        name: /Team invitations/,
      });

      expect(heading).toHaveAttribute('aria-expanded', 'true');

      await userEvent.click(heading);

      expect(heading).toHaveAttribute('aria-expanded', 'false');
      expect(
        within(cohort).getByRole('list').closest('[inert]'),
      ).not.toBeNull();

      await userEvent.click(heading);

      expect(heading).toHaveAttribute('aria-expanded', 'true');
    });

    it('opens on the first layer', () => {
      renderAt();

      expect(
        screen.getByRole('heading', { name: 'Add the invitation data model' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /1Add the invitation data model/ }),
      ).toHaveAttribute('aria-current', 'step');
    });

    it('shows a layer’s files and why they change', () => {
      renderAt('?layer=c1.l2');

      expect(
        screen.getByRole('heading', {
          name: 'Add the invitation API and emails',
        }),
      ).toBeInTheDocument();

      expect(
        screen.queryByRole('region', { name: 'Depends on' }),
      ).not.toBeInTheDocument();

      const files = screen.getByRole('region', {
        name: 'Files in this layer',
      });
      expect(
        within(files)
          .getAllByRole('article')
          .map((each) => each.getAttribute('aria-label')),
      ).toEqual([
        'control-plane/src/invitations/invitation.controller.ts',
        'control-plane/src/mail/invitation.mail.ts',
      ]);
      const [controller] = within(files).getAllByRole('article');
      expect(
        within(controller as HTMLElement).getByText(
          'Adds the invite and accept endpoints. Only admins may invite; anyone holding a token may accept.',
        ),
      ).toBeInTheDocument();
    });

    it('collapses a file’s changes, one at a time or all at once', async () => {
      renderAt('?layer=c1.l2');

      const controller = screen.getByRole('button', {
        name: /invitation\.controller\.ts/,
      });
      expect(controller).toHaveAttribute('aria-expanded', 'true');

      await userEvent.click(controller);
      expect(controller).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(
        screen.getByRole('button', { name: 'Collapse all' }),
      );
      expect(
        screen.getByRole('button', { name: /invitation\.mail\.ts/ }),
      ).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
      expect(controller).toHaveAttribute('aria-expanded', 'true');
    });

    it('opens incidental changes collapsed', () => {
      renderAt('?layer=c2.l1');

      expect(
        within(
          screen.getByRole('region', { name: 'Files in this layer' }),
        ).getAllByRole('button', { expanded: false }).length,
      ).toBeGreaterThan(0);
    });

    it('opens large files collapsed, the rest open', () => {
      given({ stacks: [LARGE_FILE] });
      renderAt('?layer=c1.l1');

      expect(
        screen.getByRole('button', { name: /types\.gen\.ts/ }),
      ).toHaveAttribute('aria-expanded', 'false');
      expect(
        screen.getByRole('button', { name: /invitation\.schema\.ts/ }),
      ).toHaveAttribute('aria-expanded', 'true');
    });

    it('folds each layer afresh, though the pane stays put', async () => {
      renderAt('?layer=c1.l2');

      const sidebar = () =>
        within(screen.getByRole('navigation', { name: 'Change stack' }));
      const controller = () =>
        screen.getByRole('button', { name: /invitation\.controller\.ts/ });

      await userEvent.click(controller());
      expect(controller()).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(
        sidebar().getByRole('button', { name: /Update the lockfile/ }),
      );
      expect(
        within(
          screen.getByRole('region', { name: 'Files in this layer' }),
        ).getAllByRole('button', { expanded: false }).length,
      ).toBeGreaterThan(0);

      await userEvent.click(
        sidebar().getByRole('button', {
          name: /Add the invitation API and emails/,
        }),
      );
      expect(controller()).toHaveAttribute('aria-expanded', 'true');
    });

    it('moves to another layer when one is picked', async () => {
      renderAt();

      await userEvent.click(
        screen.getByRole('button', { name: /3Build the invite/ }),
      );

      expect(
        screen.getByRole('heading', { name: 'Build the invite & members UI' }),
      ).toBeInTheDocument();

      await userEvent.click(
        within(screen.getByRole('navigation', { name: 'Layers' })).getByRole(
          'button',
          { name: /Add the invitation API and emails/ },
        ),
      );

      expect(
        screen.getByRole('heading', {
          name: 'Add the invitation API and emails',
        }),
      ).toBeInTheDocument();
    });
    it('shows a decision on the file it bears on, with its disputes there', () => {
      decided.mockReturnValue({
        runId: 'run_1',
        drafting: false,
        standing: 'proposed',
        merge: null,
        decisions: [
          {
            position: 0,
            kind: 'limitation',
            title: 'Invitations expire after seven days',
            why: 'The ticket says nothing on renewal.',
            alternatives: [],
            paths: ['control-plane/src/schemas/invitation.schema.ts'],
            steps: [7],
            disputes: [
              {
                path: 'control-plane/src/schemas/invitation.schema.ts',
                by: 'user_maya',
                byName: 'Maya Chen',
                reason: 'Product wants thirty days.',
                at: '2026-09-21T10:00:00.000Z',
              },
            ],
          },
        ],
      });
      renderAt();

      const file = screen.getByRole('article', {
        name: 'control-plane/src/schemas/invitation.schema.ts',
      });
      const decision = within(file).getByRole('region', {
        name: 'Decision: Invitations expire after seven days',
      });

      expect(decision).toHaveTextContent('The ticket says nothing on renewal.');
      expect(decision).toHaveTextContent('Maya Chen');
      expect(decision).toHaveTextContent('Product wants thirty days.');
      expect(
        within(decision).getByRole('link', {
          name: 'Detailed reasoning steps',
        }),
      ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_1');
    });

    it('shows no decisions where none were recorded', () => {
      renderAt();

      expect(
        screen.queryByRole('region', { name: /^Decision:/ }),
      ).not.toBeInTheDocument();
    });
  });
});
