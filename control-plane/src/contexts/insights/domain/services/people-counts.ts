import {
  type AdoptionCounts,
  adoptionCountsOf,
} from '@insights/domain/services/adoption';
import {
  type HumanLoadCounts,
  humanLoadCountsOf,
} from '@insights/domain/services/human-load';
import type { TeamHistory } from '@insights/domain/services/team-history';
import type { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';

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
