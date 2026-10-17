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
  readonly memories?: boolean;
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
  memories?: boolean;
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
  memories: input.memories ?? false,
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

Pass the task to Spec once a plan could be written against it. Which files it
touches, the approach and the design are Spec's to work out, not yours — do not
do its job here.

A small change still goes along the line rather than skipping ahead to the end
of it.

If what was asked for is ambiguous, contradictory, or already done, that is a
question for a person, not a guess for you to make.`;

const SPEC = `## Spec

Take the request as triage decided it and turn it into a plan someone can
implement without going back to the requester. What is being asked is decided;
do not reopen it — your job is the how, not the what.

Say in your note: the approach and why it beats the obvious alternative, the
files and functions to change, how it should be tested, and what is explicitly
out of scope. Read enough of the codebase to be concrete — name real things,
not placeholders.

Do not write the implementation. If the plan needs a decision that is not
yours to make — a product call, a schema change, anything hard to undo — put
that to a person instead of choosing.

If the task comes back from Implementation or Code Review, the note it returns
with says what the plan got wrong or missed: revise the plan against that note
rather than starting over.`;

const IMPLEMENTATION = `## Implementation

Make the change the spec describes, and no more than it.

Match the surrounding code: its naming, its structure, its idioms. Write tests
that would fail without your change. Run the tests and the linter, and leave
them passing — a change that does not build is not done.

Commit your work and push it. The workspace is already on the branch this
task belongs to, so push that branch and nothing else:

    git push -u origin HEAD

Say in your note: what you changed, what you tested, and anything you found
that the spec did not anticipate.

If the spec turns out to be wrong, or leaves out something the change depends
on, do not improvise a different change: pass the task back to Spec, and say
in your note what the plan got wrong or missed, so that run can put it right.
A problem in your own code is not the spec's to fix; that stays yours.`;

const REVIEWING = `### Before you judge

Read the whole diff once, then list what the change could break, and where.
Check each risk on that list before you look for more.

To check a risk, read every file it touches in full, not only the lines the
change alters: code that looks wrong in a hunk can be right in its file, and
the other way round. Read the project's conventions too, where it writes them
down — AGENTS.md, CLAUDE.md, CONTRIBUTING.md.

Give every changed file its own pass. A test, a migration, a type or a
configuration file is a file to review, even when it only serves the code
beside it. Where files depend on each other, make sure they still agree: a
changed signature, field or event has callers that must change with it.

### What to look for

- Bugs first: wrong logic, missing guards, edge cases (empty, missing, at the
  limit), races, and security holes such as injection, a missing permission
  check, or data that reaches the wrong person.
- Errors that are swallowed, thrown where nothing catches them, or turned into
  a success.
- Behaviour that changes: a field, default, message or error path that the old
  code had and the new code does not. Raise it most of all when the change
  looks unintended.
- Tests that pass without the change, and cases they miss. Read the tests as
  carefully as the code, and run them where you can.
- Code that does not fit: an abstraction the codebase already has and the
  change ignores, or a pattern it breaks.
- Performance, only where the problem is obvious: work that grows with
  unbounded input, a query for each row, a block on a hot path.

Review only what the change adds or alters. Removed code tells you what the
code did before; code the change does not touch is not yours to review. Leave
formatting to the linter.

### Before you say it

Be sure. Before you call something a bug, find how the codebase does the same
thing elsewhere, and read the documentation of the library it uses. Name a
real case where it goes wrong, not a hypothetical one. When a doubt
remains, ask it as a question rather than state it as a fault.

Give each finding a severity, and do not overstate it:

- high: it loses data, opens a security hole, crashes, or breaks what the
  change is for.
- medium: it fails at an edge, is slow, or will be hard to change later.
- low: anything else worth saying.

For each finding, say where it is, what goes wrong, when it goes wrong (the
input or state that it takes), and what would fix it.

When you have finished, read each finding again against the code. Drop a
finding only when the code shows it is wrong; keep one that you cannot prove
either way. Say nothing about code that is right, and do not praise.`;

const CODE_REVIEW = `## Code review

Review the change against what was asked for, not against how you would have
written it. The workspace is on this task's branch, and the change is
everything since it forked from the default branch:

    git diff refs/spotlight/base

Read the spec and the notes first, so you judge the change against what it set
out to do.

${REVIEWING}

Say in your note what you found, most serious first, each finding with its
severity.

If the code needs changing, pass the task back to implementation. If the
fault is in the plan rather than the code — the spec asked for the wrong
thing, or left out something the change needs — pass it back to Spec instead:
rewriting the code against the same plan would only repeat the mistake.
Either way, your note is what that run works from, so it has to be enough to
act on without reading the diff again.

If it is sound, say so plainly and say what you checked, then open a pull
request and give its address in your note.

With the pull request open, the task is finished: pass the task to \`done\` rather
than to a person, so nothing is left waiting on an answer nobody owes.`;

const PULL_REQUEST_REVIEW = `## Review

Review the pull request this task names. Somebody else wrote it, outside
Spotlight: your job is to tell them what is wrong with it and what could be
better, not to change it. The workspace is checked out at the pull request's
head, and what it changes is everything since it forked from the default
branch:

    git diff refs/spotlight/base

Read the description first, so you judge the change against what it set out
to do.

${REVIEWING}

Leave each finding as a comment on the line it is about, with
\`spotlight review-comment\`, and start the comment with its severity. Then
submit them all as one review with \`spotlight review\`. In the review's body,
say what the change comes down to and anything wrong with it as a whole.
Request changes only for a high finding.

Make no edits and push nothing: the branch is theirs.

Say in your note what you found, most serious first, and pass the task to \`done\`.`;

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
    passesTo: ['code-review', 'spec'],
    decisions: true,
  }),
  opening({
    key: 'code-review',
    name: 'Code Review',
    color: '#56b98d',
    prompt: CODE_REVIEW,
    passesTo: ['spec', 'implementation'],
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
        happening: Happening.of('github.pull_request.labelled'),
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
