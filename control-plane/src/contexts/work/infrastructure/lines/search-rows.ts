import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import {
  LineSearchPolicy,
  SearchAgent,
  StationSearchOverride,
} from '@work/domain/value-objects/search-policy.vo';
import type {
  LineSearchRow,
  StationSearchRow,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';

export const lineSearchRow = (
  policy: LineSearchPolicy | null,
): LineSearchRow | null => policy?.toPrimitives() ?? null;

export const stationSearchRow = (
  override: StationSearchOverride | null,
): StationSearchRow | null =>
  override && {
    enabled: override.enabled,
    ceiling: override.ceiling,
    period: override.period?.text ?? null,
    onAlert: override.onAlert,
    cooldown: override.cooldown?.text ?? null,
    agent: override.agent?.toPrimitives() ?? null,
    iterations: override.iterations,
    repeats: override.repeats,
    objective: override.objective,
  };

export const lineSearchOf = (
  row: LineSearchRow | null,
): LineSearchPolicy | null => row && LineSearchPolicy.of(row);

export const stationSearchOf = (
  row: StationSearchRow | null,
): StationSearchOverride | null =>
  row &&
  StationSearchOverride.of({
    ...row,
    agent: row.agent
      ? SearchAgent.of({
          harness: HarnessId.of(row.agent.harness),
          model: row.agent.model ? HarnessModel.of(row.agent.model) : null,
          effort: row.agent.effort ? Effort.of(row.agent.effort) : null,
        })
      : null,
  });
