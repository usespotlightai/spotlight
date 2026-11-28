import { TitleAudience } from '@runs/domain/services/title-audience';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TASK = RunId.of('run_task');
const WORK = RunId.of('run_work');
const TEAM = TeamId.of('team_1');

const taskRun = {
  runId: TASK,
  teamId: 'team_1',
  listed: true,
  readers: { of: 'the-run', opens: true, hidden: 'Hidden task' } as const,
};

const work = (teamId: string | null = 'team_1') => ({
  runId: WORK,
  teamId,
  listed: false,
  readers: { of: 'run', runId: TASK, opens: true } as const,
});

const follows = { status: 'follows', runId: TASK, opens: true } as const;

describe('TitleAudience', () => {
  it('lets the readers of a listed run read its title, and opens the run where its owner says so', () => {
    const state = TitleAudience.of(taskRun);

    expect(TitleAudience.shown(state, true)).toEqual({
      shows: 'title',
      opens: { runId: 'run_task', teamId: 'team_1' },
    });
    expect(TitleAudience.shown(state, false)).toEqual({
      shows: 'hidden',
      hidden: 'Hidden task',
    });
  });

  it('follows work for another run to that run, opening it only where that run’s own title opens it', () => {
    expect(TitleAudience.of(work())).toEqual(follows);
    expect(
      TitleAudience.shown(
        TitleAudience.following(follows, work(), taskRun),
        true,
      ),
    ).toEqual({
      shows: 'title',
      opens: { runId: 'run_task', teamId: 'team_1' },
    });
    expect(
      TitleAudience.following(follows, work(), {
        ...taskRun,
        readers: { of: 'the-run', opens: false, hidden: 'Hidden chat' },
      }),
    ).toEqual({
      status: 'decided',
      gate: { by: 'run', runId: TASK, hidden: 'Hidden chat' },
      opens: null,
    });
  });

  it('takes the team an unlisted run names, and the work’s own team where the run is gone', () => {
    const replay = {
      runId: TASK,
      teamId: 'team_1',
      listed: false,
      readers: { of: 'team-members', teamId: TEAM } as const,
    };

    expect(TitleAudience.following(follows, work(), replay)).toEqual({
      status: 'decided',
      gate: { by: 'team', teamId: TEAM },
      opens: null,
    });
    expect(TitleAudience.following(follows, work(), null)).toEqual({
      status: 'decided',
      gate: { by: 'team', teamId: TEAM },
      opens: null,
    });
  });

  it('takes the team a listed run’s own title names, as of a deleted chat, and not the readers of the run', () => {
    const deletedChat = {
      runId: TASK,
      teamId: 'team_1',
      listed: true,
      readers: { of: 'team-members', teamId: TEAM } as const,
    };
    const state = TitleAudience.following(follows, work(), deletedChat);

    expect(state).toEqual({
      status: 'decided',
      gate: { by: 'team', teamId: TEAM },
      opens: null,
    });
    expect(TitleAudience.shown(state, false)).toEqual({
      shows: 'hidden',
      hidden: null,
    });
  });

  it('shows nothing where no one may read the title', () => {
    const nobody = TitleAudience.following(follows, work(null), null);

    expect(TitleAudience.shown(nobody, false)).toEqual({ shows: 'nothing' });
    expect(TitleAudience.shown(follows, true)).toEqual({ shows: 'nothing' });
  });
});
