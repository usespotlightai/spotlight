import { describe, expect, it } from 'vitest';

import {
  ACCEPTED_DISAGREEMENT_ID,
  CLAIMS_CHANGED_DISAGREEMENT_ID,
  LABEL_GONE_DISAGREEMENT_ID,
  MERGED_DISAGREEMENT_ID,
  SEARCH_DISAGREEMENT_ID,
  SENT_BACK_DISAGREEMENT_ID,
  VERDICTS_AGREE_DISAGREEMENT_ID,
  seedInbox,
} from '@/mocks/world/inbox';
import { seedJudgeDisagreements } from '@/mocks/world/inbox-disagreements';
import { seededTask } from '@/mocks/world/inbox-places';
import { pastTaskOf } from '@/mocks/world/past-work';
import { SAM } from '@/mocks/world/people';

describe('the seeded inbox of judge disagreements', () => {
  it('asks every disagreement of Sam or the team, each in Sam’s inbox with the standing the server gives', () => {
    const disagreements = Object.values(seedJudgeDisagreements());
    const requests = seedInbox().flatMap((entry) =>
      'inboxRequest' in entry &&
      entry.inboxRequest?.form === 'judge-disagreement'
        ? [{ about: entry.inboxRequest.about, standing: entry.standing }]
        : [],
    );

    expect(
      disagreements.filter(
        ({ askedOf }) => askedOf !== null && askedOf !== SAM.id,
      ),
    ).toEqual([]);
    expect(
      disagreements.filter(
        ({ taskId }) => (pastTaskOf(taskId) ?? seededTask(taskId)).assignee,
      ),
    ).toEqual([]);
    expect(
      disagreements.filter(
        ({ labelFrom, askedOf }) =>
          (labelFrom === 'merged') !== (askedOf === null),
      ),
    ).toEqual([]);
    expect(requests).toEqual(
      expect.arrayContaining([
        { about: SEARCH_DISAGREEMENT_ID, standing: 'team' },
        { about: SENT_BACK_DISAGREEMENT_ID, standing: 'assignee' },
        { about: ACCEPTED_DISAGREEMENT_ID, standing: 'assignee' },
        { about: MERGED_DISAGREEMENT_ID, standing: 'team' },
        { about: VERDICTS_AGREE_DISAGREEMENT_ID, standing: 'team' },
        { about: CLAIMS_CHANGED_DISAGREEMENT_ID, standing: 'assignee' },
        { about: LABEL_GONE_DISAGREEMENT_ID, standing: 'team' },
      ]),
    );
    expect(requests).toHaveLength(disagreements.length);
  });
});
