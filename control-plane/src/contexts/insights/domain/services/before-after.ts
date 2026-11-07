import { type GroupCounts } from '@insights/domain/services/change-verdict';
import { type ConfigMarker } from '@insights/domain/services/daily-output';
import { type RubricRates } from '@insights/domain/services/judge-rates';

export interface ChangeCounts {
  readonly marker: ConfigMarker;
  readonly before: GroupCounts;
  readonly after: GroupCounts;
  readonly judgedBefore: readonly RubricRates[];
  readonly judgedAfter: readonly RubricRates[];
}
