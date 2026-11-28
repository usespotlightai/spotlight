import type {
  AssistSessionLabelSource,
  LabelledSession,
  SessionLabel,
} from '@assist/application/ports/assist-session-labels.port';
import { ChangeReviewSessionTitles } from '@change-review/application/rendering/review-session.text';
import {
  DRAFTING_PURPOSE,
  GRADING_PURPOSE,
  isRedraftKey,
} from '@change-review/infrastructure/assist/assist-rounds';

/** Names the assist sessions change review orders, by their purpose. */
export class ChangeReviewSessionLabels implements AssistSessionLabelSource {
  readonly context = 'change-review';

  labelOf(session: LabelledSession): SessionLabel | null {
    const { task } = session.basedOn;

    switch (session.purpose) {
      case DRAFTING_PURPOSE:
        return ChangeReviewSessionTitles.drafting(
          task,
          isRedraftKey(session.key),
        );
      case GRADING_PURPOSE:
        return ChangeReviewSessionTitles.grading(task);
      default:
        return null;
    }
  }
}
