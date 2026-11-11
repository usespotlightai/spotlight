import { type AdoptionCounts } from '@insights/domain/services/adoption';
import { type HumanLoadCounts } from '@insights/domain/services/human-load';

export interface PeopleCounts {
  readonly load: {
    readonly current: HumanLoadCounts;
    readonly previous: HumanLoadCounts;
  };
  readonly adoption: AdoptionCounts;
}
