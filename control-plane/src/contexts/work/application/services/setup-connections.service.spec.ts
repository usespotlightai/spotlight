import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  LineReaderPort,
  ReviewInvitation,
} from '@work/application/ports/line-reader.port';
import type { TaskReaderPort } from '@work/application/ports/task-reader.port';
import type {
  OpeningSource,
  TeamIntegrationsPort,
} from '@work/application/ports/team-integrations.port';
import { SetupConnections } from '@work/application/services/setup-connections.service';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const REVIEW: ReviewInvitation = {
  label: 'ai-review',
  mention: '@acme-bot',
  repository: 'acme/api',
};

const SLACK: OpeningSource = {
  source: 'slack',
  name: 'Slack',
  tryIt: 'Mention @spotlight in any channel.',
  heard: 'Message received',
  link: null,
};

const connections = (given: {
  review?: ReviewInvitation | null;
  opening?: readonly OpeningSource[];
  opened?: ReadonlyMap<string, Date>;
}) =>
  new SetupConnections(
    {
      reviewInvitationOf: vi.fn(async () =>
        given.review === undefined ? REVIEW : given.review,
      ),
    } as unknown as LineReaderPort,
    {
      opening: vi.fn(async () => given.opening ?? []),
    } as unknown as TeamIntegrationsPort,
    {
      firstOpenedFrom: vi.fn(async () => given.opened ?? new Map()),
    } as unknown as TaskReaderPort,
  ).of(TEAM);

describe('SetupConnections', () => {
  it('lists GitHub first, worded from the team’s review policy', async () => {
    const [github] = await connections({});

    expect(github).toEqual({
      source: 'github',
      name: 'GitHub',
      tryIt:
        'Add the ai-review label to a pull request, or mention @acme-bot on one.',
      heard: 'Review asked for',
      link: {
        label: 'Open pull requests',
        url: 'https://github.com/acme/api/pulls',
      },
      firstOpenedAt: null,
    });
  });

  it('lists each integration that opens tasks after GitHub, once', async () => {
    const listed = await connections({
      opening: [SLACK, { ...SLACK, source: 'github', name: 'GitHub again' }],
    });

    expect(listed.map((each) => each.source)).toEqual(['github', 'slack']);
  });

  it('says when each source first opened a task', async () => {
    const at = new Date('2026-10-10T09:00:00.000Z');
    const [, slack] = await connections({
      opening: [SLACK],
      opened: new Map([['slack', at]]),
    });

    expect(slack?.firstOpenedAt).toEqual(at);
  });

  it('words an integration that says nothing of itself', async () => {
    const [, linear] = await connections({
      opening: [
        {
          source: 'linear',
          name: 'Linear',
          tryIt: null,
          heard: null,
          link: null,
        },
      ],
    });

    expect(linear).toMatchObject({
      tryIt: 'Send anything from Linear that opens a task.',
      heard: 'Task opened',
    });
  });

  it('links nowhere for GitHub, and words it plainly, where the team has no review line', async () => {
    const [github] = await connections({ review: null });

    expect(github?.link).toBeNull();
    expect(github?.tryIt).toBe('Send anything from GitHub that opens a task.');
  });
});
