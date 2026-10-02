import { sameField } from '@replays/domain/services/field-comparison';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const SEARCHABLE_FIELDS = [
  'prompt',
  'harness',
  'model',
  'effort',
  'profile',
  'skills',
  'tools',
  'decisions',
  'memories',
  'description',
] as const;

export const unsearchableChanges = (
  seed: StationBlock,
  candidate: StationBlock,
): readonly ConfigurationProblem[] => {
  const was = seed.value;
  const now = candidate.value;
  const searchable = new Set<string>(SEARCHABLE_FIELDS);

  return [...new Set([...Object.keys(was), ...Object.keys(now)])]
    .filter(
      (field) => !searchable.has(field) && !sameField(was[field], now[field]),
    )
    .sort()
    .map((field) =>
      ConfigurationProblem.of({
        path: '',
        at: FieldPath.of(['station', field]),
        reason: `A search may change only the station’s ${SEARCHABLE_FIELDS.join(', ')}; keep ${field} as the search’s starting config has it`,
      }),
    );
};
