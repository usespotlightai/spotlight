import { nonEmpty } from '@shared-kernel/domain/non-empty';

/** What a judge session is based on: the task and the station of the run it judges, by name. */
interface Judged {
  readonly task: string | null;
  readonly station: string | null;
}

/** What a judge session shows on the Runners page, and whether it opens the run it is based on. */
interface JudgeSessionTitle {
  readonly title: string;
  readonly opens: boolean;
}

const onTask = (task: string | null): string =>
  nonEmpty(task) ? ` on “${task}”` : '';

export const JudgeSessionTitles = {
  judging({ task, station }: Judged): JudgeSessionTitle {
    return {
      title: `Judging ${station ?? 'a run'}${onTask(task)}`,
      opens: true,
    };
  },

  comparing({ task, station }: Judged): JudgeSessionTitle {
    return {
      title: `Comparing two runs${nonEmpty(station) ? ` of ${station}` : ''}${onTask(task)}`,
      opens: true,
    };
  },

  /** Claims are drafted for a station, not for the run they are drafted from, so it opens none. */
  draftingClaims({ station }: Judged): JudgeSessionTitle {
    return {
      title: nonEmpty(station)
        ? `Drafting judge claims for ${station}`
        : 'Drafting judge claims',
      opens: false,
    };
  },
};
