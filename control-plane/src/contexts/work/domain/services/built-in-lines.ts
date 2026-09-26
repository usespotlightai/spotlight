import type { StationKind } from '@work/domain/entities/station.entity';
import {
  PULL_REQUEST,
  REVIEW,
  REVIEW_COMMENT,
} from '@work/domain/services/built-in-tools';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { ReviewPolicy } from '@work/domain/value-objects/review-policy.vo';
import type { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';
import type { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';

interface StationOpening {
  readonly key: StationKey;
  readonly name: StationName;
  readonly color: StationColor;
  readonly kind: StationKind;
  readonly agentPrompt: AgentPrompt | null;
  readonly passesTo: readonly StationKey[];
  readonly tools: readonly Tool[];
  readonly skills?: readonly SkillKey[];
  readonly diffs?: boolean;
  readonly decisions?: boolean;
  readonly ends: boolean;
}

interface ReactionOpening {
  readonly happening: Happening;
  readonly to: StationKey;
}

export interface LineOpening {
  readonly key: LineKey;
  readonly name: LineName;
  readonly role: LineRole | null;
  readonly stations: readonly StationOpening[];
  readonly reactions: readonly ReactionOpening[];
  readonly repositories: readonly WorkedRepository[];
  readonly reviews?: ReviewPolicy | null;
}

const opening = (input: {
  key: string;
  name: string;
  color: string;
  prompt?: string;
  kind?: StationKind;
  passesTo?: readonly string[];
  tools?: readonly Tool[];
  diffs?: boolean;
  decisions?: boolean;
  ends?: boolean;
}): StationOpening => ({
  key: StationKey.of(input.key),
  name: StationName.of(input.name),
  color: StationColor.of(input.color),
  kind: input.kind ?? 'work',
  agentPrompt: input.prompt ? AgentPrompt.of(input.prompt) : null,
  passesTo: (input.passesTo ?? []).map((each) => StationKey.of(each)),
  tools: input.tools ?? [],
  diffs: input.diffs ?? false,
  decisions: input.decisions ?? false,
  ends: input.ends ?? false,
});

const TRIAGE = `## Triage

Decide what is actually being asked for, and whether it is clear and coherent
enough to plan against. This is a gate, not a plan: read just enough to judge
the request.

Read only. Make no edits and run nothing that changes a file, however small
the change and however certain you are of it.

Say in your note what the request comes down to, in a sentence or two, and
anything it leaves open or takes for granted.

Hand on to Spec once a plan could be written against it. Which files it
touches, the approach and the design are Spec's to work out, not yours — do not
do its job here.

A small change still goes along the line rather than skipping ahead to the end
of it.

If what was asked for is ambiguous, contradictory, or already done, that is a
question for a person, not a guess for you to make.`;

const SPEC = `## Spec

Take the request as triage settled it and turn it into a plan someone can
implement without going back to the requester. What is being asked is decided;
do not reopen it — your job is the how, not the what.

Say in your note: the approach and why it beats the obvious alternative, the
files and functions to change, how it should be tested, and what is explicitly
out of scope. Read enough of the codebase to be concrete — name real things,
not placeholders.

Do not write the implementation. If the plan needs a decision that is not
yours to make — a product call, a schema change, anything hard to undo — put
that to a person instead of choosing.`;

const IMPLEMENTATION = `## Implementation

Make the change the spec describes, and no more than it.

Match the surrounding code: its naming, its structure, its idioms. Write tests
that would fail without your change. Run the tests and the linter, and leave
them passing — a change that does not build is not done.

Commit your work and push it. The workspace is already on the branch this
task belongs to, so push that branch and nothing else:

    git push -u origin HEAD

Say in your note: what you changed, what you tested, and anything you found
that the spec did not anticipate. If the spec turns out to be wrong or cannot
be followed as written, stop and put that to a person rather than improvising
a different change.`;

const CODE_REVIEW = `## Code review

Review the change against what was asked for, not against how you would have
written it.

Look for: behaviour that does not match the spec, cases the tests miss, errors
swallowed or left unhandled, and anything that will be hard to change later.
Read the tests as carefully as the code. Run them.

Say in your note what you found, most serious first, and be specific — the
file, the line, and what goes wrong. Anything you are unsure about is worth a
person's eyes.

If anything needs changing, hand the task back to implementation. Your note is
what that run works from, so it has to be enough to act on without reading the
diff again.

If it is sound, say so plainly and say what you checked, then open a pull
request and give its address in your note.

With the pull request open, the task is finished: hand on to \`done\` rather
than to a person, so nothing is left waiting on an answer nobody owes.`;

const PULL_REQUEST_REVIEW = `## Review

Review the pull request this task names. Somebody else wrote it, outside
Spotlight: your job is to tell them what is wrong with it and what could be
better, not to change it. The workspace is checked out at the pull request's
head, and what it changes is everything since it forked from the default
branch:

    git diff refs/spotlight/base

Read the description first, so you judge the change against what it set out
to do. Then read the diff, and as much of the code around it as it takes to be
sure of what you say. Run the tests where you can.

Look for: behaviour that does not match what the description promises, cases
the tests miss, errors swallowed or left unhandled, and anything that will be
hard to change later. Leave style to the linter.

Leave each finding as a comment on the line it is about, with
\`spotlight review-comment\`, then submit them all as one review with
\`spotlight review\`. Be specific: what goes wrong, when, and what would fix
it. Say nothing where there is nothing worth saying.

Make no edits and push nothing: the branch is theirs.

Say in your note what you found, most serious first, and hand on to \`done\`.`;

const REVIEW_STATIONS: readonly StationOpening[] = [
  opening({
    key: 'backlog',
    name: 'Backlog',
    color: StationColor.plain().value,
    kind: 'backlog',
    passesTo: ['code-review'],
  }),
  opening({
    key: 'code-review',
    name: 'Review',
    color: '#56b98d',
    prompt: PULL_REQUEST_REVIEW,
    ends: true,
    diffs: true,
    tools: [REVIEW_COMMENT, REVIEW],
  }),
  opening({
    key: 'completed',
    name: 'Completed',
    color: StationColor.plain().value,
    kind: 'completed',
  }),
];

const DELIVERY_STATIONS: readonly StationOpening[] = [
  opening({
    key: 'backlog',
    name: 'Backlog',
    color: StationColor.plain().value,
    kind: 'backlog',
    passesTo: ['triage'],
  }),
  opening({
    key: 'triage',
    name: 'Triage',
    color: '#93a1b5',
    prompt: TRIAGE,
    passesTo: ['spec', 'implementation'],
  }),
  opening({
    key: 'spec',
    name: 'Spec',
    color: '#5c66d9',
    prompt: SPEC,
    passesTo: ['implementation'],
  }),
  opening({
    key: 'implementation',
    name: 'Implementation',
    color: '#edc12b',
    prompt: IMPLEMENTATION,
    passesTo: ['code-review'],
    decisions: true,
  }),
  opening({
    key: 'code-review',
    name: 'Code Review',
    color: '#56b98d',
    prompt: CODE_REVIEW,
    passesTo: ['implementation'],
    ends: true,
    tools: [PULL_REQUEST],
  }),
  opening({
    key: 'completed',
    name: 'Completed',
    color: StationColor.plain().value,
    kind: 'completed',
  }),
];

const GITHUB_REACTIONS: readonly ReactionOpening[] = [
  {
    happening: Happening.of('github.checks.failed'),
    to: StationKey.of('implementation'),
  },
  {
    happening: Happening.of('github.pull_request.commented'),
    to: StationKey.of('code-review'),
  },
  {
    happening: Happening.of('github.pull_request.changes-requested'),
    to: StationKey.of('code-review'),
  },
  {
    happening: Happening.of('github.pull_request.merged'),
    to: StationKey.of('completed'),
  },
];

export const BUILT_IN_LINES: readonly LineOpening[] = [
  {
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    role: LineRole.DELIVERY,
    stations: DELIVERY_STATIONS,
    reactions: GITHUB_REACTIONS,
    repositories: [],
  },
  {
    key: LineKey.of('review'),
    name: LineName.of('Review'),
    role: LineRole.REVIEW,
    stations: REVIEW_STATIONS,
    reactions: [
      {
        happening: Happening.of('github.pull_request.mentioned'),
        to: StationKey.of('code-review'),
      },
      {
        happening: Happening.of('github.pull_request.merged'),
        to: StationKey.of('completed'),
      },
      {
        happening: Happening.of('github.pull_request.closed-unmerged'),
        to: StationKey.of('completed'),
      },
    ],
    repositories: [],
    reviews: ReviewPolicy.of({}),
  },
];
