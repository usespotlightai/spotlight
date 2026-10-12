import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { OnlyOnSeenTasksMark } from '@/components/features/searches/OnlyOnSeenTasksMark';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { spendShown } from '@/lib/insights';
import { percentShown } from '@/lib/judge';
import type { ReplaySet } from '@/lib/replay';
import {
  intervalShown,
  minGainSentence,
  NOT_SCORED_YET,
  repeatsShown,
  runsScoredShown,
} from '@/lib/replay-words';
import { type SearchDetail, setTaskTitle } from '@/lib/search';
import {
  bestOnShown,
  bestTermShown,
  budgetNoteShown,
  heldOutTasksShown,
  noBestShown,
  objectiveNote,
  objectiveShown,
  SPLIT_NOTE,
} from '@/lib/search-words';

const NONE = '–';

const likely = (
  interval: { readonly low: number; readonly high: number } | null,
): string | null =>
  interval ? `Likely range: ${intervalShown(interval)}.` : null;

const sentences = (...parts: readonly (string | null)[]): string =>
  parts.filter(Boolean).join(' ');

type SearchTilesProps = {
  search: SearchDetail;
  set: ReplaySet | undefined;
};

export function SearchTiles({ search, set }: SearchTilesProps) {
  const { data: harnesses } = useHarnesses();
  const { budget, agent, best, seed, split } = search;
  const harness =
    harnesses?.find((each) => each.id === agent.harness)?.name ?? agent.harness;
  const heldOut = best !== null && best.heldOutScore !== null;
  const bestRate = heldOut ? best?.heldOutScore : best?.searchScore;

  return (
    <InsightsTiles label="The search in numbers" className="gap-3">
      <InsightsTile
        label={bestTermShown(search.objective)}
        value={best ? (best.seed ? 'Live config' : best.name) : NONE}
        detail={
          best ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {bestRate != null &&
                `${percentShown(bestRate)} ${bestOnShown(heldOut)}`}
              {best.onlyOnSeenTasks && (
                <OnlyOnSeenTasksMark mark={best.onlyOnSeenTasks} />
              )}
            </span>
          ) : (
            noBestShown(search.objective)
          )
        }
        note={sentences(
          `Aims for ${objectiveShown(search.objective).toLowerCase()}. ${objectiveNote(search.objective)}`,
          best
            ? likely(heldOut ? best.heldOutInterval : best.searchInterval)
            : null,
        )}
      />

      <InsightsTile
        label="Live config"
        value={
          seed.searchScored === 0 || seed.searchScore === null
            ? NONE
            : percentShown(seed.searchScore)
        }
        detail={
          seed.searchScored === 0
            ? NOT_SCORED_YET
            : runsScoredShown(seed.searchScored)
        }
        note={sentences(
          likely(seed.searchInterval),
          `${minGainSentence(search.minGain)}.`,
        )}
      />

      <InsightsTile
        label="Iterations"
        value={`${search.iterationsRun} of ${budget.iterations}`}
        detail={`${search.proposed} ${search.proposed === 1 ? 'candidate' : 'candidates'} proposed`}
        note={budgetNoteShown(
          budget,
          repeatsShown(budget.repeats),
          [harness, agent.model, agent.effort].filter(Boolean).join(' · '),
        )}
      />

      <InsightsTile
        label="Tasks"
        value={`${split.searchedTasks}`}
        detail={`searched · ${split.heldOutTasks} held out`}
        note={sentences(
          SPLIT_NOTE,
          heldOutTasksShown(
            split.heldOut.map((entry) => setTaskTitle(entry, set)),
          ),
        )}
      />

      <InsightsTile
        label="Spent"
        value={spendShown(search.spent)}
        detail={`of ${spendShown(budget.ceiling)}`}
      />
    </InsightsTiles>
  );
}
