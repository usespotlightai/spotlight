import type {
  AssistSessionLabelSource,
  LabelledSession,
  SessionLabel,
} from '@assist/application/ports/assist-session-labels.port';
import { JudgeSessionTitles } from '@insights/application/rendering/judge-session.text';
import {
  CLAIMS_PURPOSE,
  JUDGE_PURPOSE,
  PAIR_JUDGE_PURPOSE,
} from '@insights/infrastructure/judging/assist-rounds';

/** Names the assist sessions insights orders, by their purpose. */
export class InsightsSessionLabels implements AssistSessionLabelSource {
  readonly context = 'insights';

  labelOf(session: LabelledSession): SessionLabel | null {
    switch (session.purpose) {
      case JUDGE_PURPOSE:
        return JudgeSessionTitles.judging(session.basedOn);
      case PAIR_JUDGE_PURPOSE:
        return JudgeSessionTitles.comparing(session.basedOn);
      case CLAIMS_PURPOSE:
        return JudgeSessionTitles.draftingClaims(session.basedOn);
      default:
        return null;
    }
  }
}
