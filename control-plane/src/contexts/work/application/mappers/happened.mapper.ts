import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type {
  Arriving,
  Happened,
  MarkWorn,
  ReviewWord,
} from '@work/application/contracts/happenings.contract';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
import { Happening, type Word } from '@work/domain/value-objects/happening.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import type { OpensWith } from '@work/domain/value-objects/opens-with';
import {
  type ReviewRequest,
  reviewAsking,
  reviewRequested,
} from '@work/domain/value-objects/review-asked.vo';
import { Said } from '@work/domain/value-objects/said.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';

export interface Heard {
  readonly word: Word;
  readonly concerns: Concerns;
  readonly said: Said | null;
  readonly ourOwn: boolean;
  readonly opens: OpensWith | null;
  readonly attachments: readonly Arriving[];
}

const reviewOf = (
  word: ReviewWord | null | undefined,
): ReviewRequest | null => {
  if (!word) {
    return null;
  }

  return reviewRequested({
    asking: reviewAsking(word.asking),
    label: word.label?.trim() || null,
    pullRequest: PullRequestUrl.of(word.pullRequest),
    author: word.author?.trim() || null,
    outside: word.outside !== false,
    draft: word.draft,
    branch: word.branch ? Branch.of(word.branch) : null,
  });
};

export const HappenedMapper = {
  markOf(worn: MarkWorn): Mark {
    return Mark.of(worn.kind, worn.value);
  },

  toHeard(happened: Happened): Heard | null {
    const concerns = Concerns.of({
      branch: happened.concerns.branch,
      marks: happened.concerns.marks.map(HappenedMapper.markOf),
    });

    if (!concerns) {
      return null;
    }

    const opens = happened.opens;

    return {
      word: {
        happening: Happening.of(happened.happening),
        told: happened.told,
        spoken: happened.spoken,
        state: happened.state,
      },
      concerns,
      said: happened.said ? Said.of(happened.said) : null,
      ourOwn: happened.ourOwn,
      opens: opens
        ? {
            onto: LineRole.of(opens.onto),
            at: opens.at ? StationKey.parsed(opens.at) : null,
            title: opens.title,
            description: opens.description,
            assignEmail: opens.assignEmail,
            marks: opens.marks.map(HappenedMapper.markOf),
            review: reviewOf(opens.review),
          }
        : null,
      attachments: happened.attachments ?? [],
    };
  },
};
