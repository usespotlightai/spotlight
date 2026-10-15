import {
  type AdoptionCounts,
  adoptionCountsOf,
} from '@outcomes/domain/services/adoption';
import {
  type HumanLoadCounts,
  humanLoadCountsOf,
} from '@outcomes/domain/services/human-load';
import type { TeamHistory } from '@outcomes/domain/services/team-history';
import type { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';

export interface PeopleCounts {
  readonly load: {
    readonly current: HumanLoadCounts;
    readonly previous: HumanLoadCounts;
  };
  readonly adoption: AdoptionCounts;
}

export const peopleCountsOf = (
  history: TeamHistory,
  period: InsightsPeriod,
): PeopleCounts => ({
  load: {
    current: humanLoadCountsOf(history, period.current),
    previous: humanLoadCountsOf(history, period.previous),
  },
  adoption: adoptionCountsOf(history, period),
});
