import type {
  AssistSessionLabelSource,
  LabelledSession,
  SessionLabel,
} from '@assist/application/ports/assist-session-labels.port';
import { MemorySessionTitles } from '@memory/application/rendering/memory-session.text';
import { CONSOLIDATION_PURPOSE } from '@memory/infrastructure/consolidation/assist-memory-consolidator';
import { COMPARISON_PURPOSE } from '@memory/infrastructure/duplicates/assist-proposal-comparer';

/** Names the assist sessions memory orders, by their purpose. */
export class MemorySessionLabels implements AssistSessionLabelSource {
  readonly context = 'memory';

  labelOf(session: LabelledSession): SessionLabel | null {
    switch (session.purpose) {
      case COMPARISON_PURPOSE:
        return MemorySessionTitles.duplicateCheck;
      case CONSOLIDATION_PURPOSE:
        return MemorySessionTitles.upkeep;
      default:
        return null;
    }
  }
}
