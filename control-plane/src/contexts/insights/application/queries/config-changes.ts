import type {
  ConfigInOrder,
  ConfigPart,
  StationConfigView,
} from '@insights/application/ports/work.port';
import { itemAt } from '@shared-kernel/domain/item-at';

export interface ConfigPair {
  readonly previous: string | null;
  readonly next: string | null;
}

export interface ConfigChanges {
  configOf(fingerprint: string | null): StationConfigView | null;
  between(pair: ConfigPair): readonly ConfigPart[];
}

const keyOf = (previous: string, next: string): string => `${previous}>${next}`;

export const fingerprintsToRead = (
  pairs: readonly ConfigPair[],
): readonly string[] =>
  pairs.flatMap(({ previous, next }) => {
    if (next === null) {
      return [];
    }

    return previous === null || previous === next ? [next] : [previous, next];
  });

export const configChangesOf = (
  configs: readonly ConfigInOrder[],
): ConfigChanges => {
  const views = new Map(configs.map((each) => [each.fingerprint, each.config]));
  const pairs = new Map(
    configs.flatMap((each, at) => {
      const previous = itemAt(configs, at - 1);

      return previous !== undefined
        ? [[keyOf(previous.fingerprint, each.fingerprint), each.changes]]
        : [];
    }),
  );

  return {
    configOf: (fingerprint) =>
      fingerprint === null ? null : (views.get(fingerprint) ?? null),
    between: ({ previous, next }) =>
      previous === null || next === null || previous === next
        ? []
        : (pairs.get(keyOf(previous, next)) ?? []),
  };
};
