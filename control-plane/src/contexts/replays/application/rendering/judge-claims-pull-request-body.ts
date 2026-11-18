import type {
  JudgeClaimsDisagreementNote,
  JudgeClaimsDisagreementRun,
  JudgeClaimsProposal,
} from '@replays/domain/value-objects/judge-claims-proposal';

export interface JudgeClaimsPullRequestFacts extends JudgeClaimsProposal {
  readonly lineKey: string;
  readonly stationKey: string;
}

const MAX_LISTED_RUNS = 20;

const MAX_NOTE_CHARS = 300;

const BECAUSE: Readonly<
  Record<JudgeClaimsPullRequestFacts['trigger'], string>
> = {
  'claim-wrong':
    'People answered at least 3 times that one claim is wrong for a run.',
  'calibration-failed':
    'The agreement of the judge with people is below the minimum agreement of the station.',
  'claim-missing':
    'People found at least 3 problems in runs that the judge passed and that no claim checks.',
};

const kappaText = (kappa: number | null): string =>
  kappa === null ? 'not known' : kappa.toFixed(2);

const quoted = (text: string): string =>
  text.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_CHARS);

const listed = (claims: readonly string[]): string[] =>
  claims.map((each) => `- ${quoted(each)}`);

const changesOf = (facts: JudgeClaimsPullRequestFacts): string[] => {
  const removed = facts.claimsBefore.filter(
    (each) => !facts.claimsAfter.includes(each),
  );
  const added = facts.claimsAfter.filter(
    (each) => !facts.claimsBefore.includes(each),
  );

  return [
    '### Changed claims',
    '',
    ...(removed.length > 0 ? ['Removed:', '', ...listed(removed), ''] : []),
    ...(added.length > 0 ? ['Added:', '', ...listed(added), ''] : []),
    `Claims that stay the same: ${facts.claimsAfter.length - added.length}.`,
  ];
};

const noteLineOf = (
  note: JudgeClaimsDisagreementNote,
  claimsBefore: readonly string[],
): string => {
  const claim = note.claim === null ? undefined : claimsBefore[note.claim];

  return claim === undefined
    ? ` Note: "${quoted(note.text)}"`
    : ` Note on "${quoted(claim)}": "${quoted(note.text)}"`;
};

const runLineOf = (
  run: JudgeClaimsDisagreementRun,
  claimsBefore: readonly string[],
): string => {
  const verdict =
    run.direction === 'judge-failed'
      ? 'The judge failed the run and people passed it.'
      : 'The judge passed the run and people failed it.';
  const wrong = run.claimsWrong
    .map((claim) => claimsBefore[claim])
    .filter((each): each is string => each !== undefined)
    .map((each) => `"${quoted(each)}"`);

  return [
    `- Run ${run.runId} of task ${run.taskId}. ${verdict}`,
    ...(wrong.length > 0 ? [` Wrong claims: ${wrong.join(', ')}.`] : []),
    ...run.notes.map((note) => noteLineOf(note, claimsBefore)),
  ].join('');
};

const disagreementsOf = (facts: JudgeClaimsPullRequestFacts): string[] => {
  if (facts.disagreementRuns.length === 0) {
    return [];
  }

  const shown = facts.disagreementRuns.slice(0, MAX_LISTED_RUNS);
  const more = facts.disagreementRuns.length - shown.length;

  return [
    '',
    '### Runs where the judge and people disagree',
    '',
    ...shown.map((each) => runLineOf(each, facts.claimsBefore)),
    ...(more > 0 ? [`- And ${more} more.`] : []),
  ];
};

export const JudgeClaimsPullRequestBody = {
  titleOf(facts: JudgeClaimsPullRequestFacts): string {
    return `Revise the judge claims of the ${facts.stationKey} station`;
  },

  of(facts: JudgeClaimsPullRequestFacts): string {
    return [
      `## Judge claims of the ${facts.lineKey} / ${facts.stationKey} station`,
      '',
      BECAUSE[facts.trigger],
      'Spotlight judged the stored evidence of runs with people’s verdict again with new claims. It picked the claims on the searched runs and checked them on held-out runs.',
      '',
      '| Agreement with people (kappa) | Searched runs | Held-out runs |',
      '| --- | --- | --- |',
      `| Runs | ${facts.searched.runs} | ${facts.heldOut.runs} |`,
      `| Current claims | ${kappaText(facts.searched.before)} | ${kappaText(facts.heldOut.before)} |`,
      `| New claims | ${kappaText(facts.searched.after)} | ${kappaText(facts.heldOut.after)} |`,
      '',
      ...changesOf(facts),
      ...disagreementsOf(facts),
      '',
      'This pull request changes only the claims of the judge. When you merge it, Spotlight judges the newest runs with people’s verdict again with the new claims.',
    ].join('\n');
  },
};
