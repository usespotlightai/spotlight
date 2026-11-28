import type { NamedSessionRow } from '@assist/application/ports/assist-session-reader.port';
import type { RunsPort } from '@assist/application/ports/runs.port';
import { AssistSessionLabels } from '@assist/application/services/assist-session-labels.service';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const SESSIONS: NamedSessionRow[] = [
  {
    id: 'session_1',
    purpose: 'insights.judge',
    key: 'judging:run_task:1:1',
    basedOnRun: 'run_task',
  },
  {
    id: 'session_2',
    purpose: 'memory.compare-proposals',
    key: 'proposals',
    basedOnRun: 'run_other',
  },
  {
    id: 'session_3',
    purpose: 'nobody.knows',
    key: 'key',
    basedOnRun: 'run_task',
  },
];

const requesterOf = (
  id: string,
  {
    kind = 'session',
    team = 'team_1',
  }: { kind?: string; team?: string | null } = {},
) => ({ owner: 'assist', kind, id, token: null, team });

const labelling = () => {
  const labels = new AssistSessionLabels(
    {
      sessionsOf: async (ids) =>
        SESSIONS.filter((each) => ids.includes(each.id)),
    },
    partial<RunsPort>({
      workOf: async (runs) =>
        runs.flatMap((each) =>
          each.value === 'run_task'
            ? [
                {
                  runId: each,
                  task: 'Incident owners 2/5',
                  station: 'Implementation',
                },
              ]
            : [],
        ),
    }),
  );
  const asked: unknown[] = [];

  labels.register({
    context: 'insights',
    labelOf: (session) => {
      asked.push(session);
      return {
        title: `Judging ${session.basedOn.station} on “${session.basedOn.task}”`,
        opens: true,
      };
    },
  });
  labels.register({
    context: 'memory',
    labelOf: () => ({ title: 'Checking proposed memories', opens: false }),
  });

  return { labels, asked };
};

describe('AssistSessionLabels', () => {
  it('names each session as the context of its purpose does, for whoever reads the run it is based on', async () => {
    const { labels, asked } = labelling();

    const found = await labels.labelsOf([
      requesterOf('session_1'),
      requesterOf('session_2'),
    ]);

    expect(found.get('assist/session/session_1')).toEqual({
      title: 'Judging Implementation on “Incident owners 2/5”',
      readers: { of: 'run', runId: RunId.of('run_task'), opens: true },
    });
    expect(found.get('assist/session/session_2')).toEqual({
      title: 'Checking proposed memories',
      readers: { of: 'run', runId: RunId.of('run_other'), opens: false },
    });
    expect(asked).toEqual([
      {
        purpose: 'insights.judge',
        key: 'judging:run_task:1:1',
        basedOn: {
          runId: 'run_task',
          task: 'Incident owners 2/5',
          station: 'Implementation',
        },
      },
    ]);
  });

  it('names a session plainly where no context names its purpose, or it is gone, for its team', async () => {
    const { labels } = labelling();

    const found = await labels.labelsOf([
      requesterOf('session_3'),
      requesterOf('session_gone'),
      requesterOf('session_gone_nowhere', { team: null }),
      requesterOf('session_1', { kind: 'other' }),
    ]);

    expect(found.get('assist/session/session_3')).toEqual({
      title: 'Assisting with a run',
      readers: { of: 'run', runId: RunId.of('run_task'), opens: false },
    });
    expect(found.get('assist/session/session_gone')).toEqual({
      title: 'Assisting with a run',
      readers: {
        of: 'team-members',
        teamId: TeamId.of('team_1'),
      },
    });
    expect(found.size).toBe(2);
  });
});
