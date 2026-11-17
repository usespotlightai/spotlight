import type {
  CodeReviewResponseDto,
  JudgeDisagreementResponseDto,
  MemoryReviewResponseDto,
  StationAlertFiringResponseDto,
  TaskDecisionsResponseDto,
} from '@/lib/api';
import type { RunScores } from '@/lib/judge';
import { perWorld } from '@/mocks/world';
import { GROWTH_RUNS } from '@/mocks/world/growth';
import { freshInbox, type InboxEntry, seedInbox } from '@/mocks/world/inbox';
import { seedJudgeDisagreements } from '@/mocks/world/inbox-disagreements';
import { seedMemoryReviews } from '@/mocks/world/inbox-memories';
import { seedCodeReviews, seedDecisions } from '@/mocks/world/inbox-reviews';
import { seedAlerts, seedRunScores } from '@/mocks/world/inbox-scores';
import { PLATFORM_RUNS } from '@/mocks/world/platform';

export type InboxStore = {
  entries: InboxEntry[];
  scores: Record<string, RunScores>;
  alerts: Record<string, StationAlertFiringResponseDto>;
  disagreements: Record<string, JudgeDisagreementResponseDto>;
  codeReviews: Record<string, CodeReviewResponseDto>;
  decisions: Record<string, TaskDecisionsResponseDto>;
  memoryReviews: Record<string, MemoryReviewResponseDto>;
  scoresWait: boolean;
  made: number;
};

const ALL_RUN_IDS = Object.values({ ...PLATFORM_RUNS, ...GROWTH_RUNS })
  .flat()
  .map((run) => run.id);

const EMPTY: InboxStore = {
  entries: [],
  scores: {},
  alerts: {},
  disagreements: {},
  codeReviews: {},
  decisions: {},
  memoryReviews: {},
  scoresWait: false,
  made: 0,
};

export const inboxStore = perWorld((kind): InboxStore =>
  kind === 'empty'
    ? { ...structuredClone(EMPTY), entries: freshInbox() }
    : {
        entries: seedInbox(),
        scores: seedRunScores(ALL_RUN_IDS),
        alerts: seedAlerts(),
        disagreements: seedJudgeDisagreements(),
        codeReviews: seedCodeReviews(),
        decisions: seedDecisions(),
        memoryReviews: seedMemoryReviews(),
        scoresWait: false,
        made: 0,
      },
);

export const nextId = (prefix: string): string => {
  const store = inboxStore();
  store.made += 1;

  return `${prefix}_${store.made}`;
};
