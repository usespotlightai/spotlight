import type { StationKind } from '@domain/entities/station.entity';
import { PULL_REQUEST } from '@domain/services/built-in-tools';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import type { Tool } from '@domain/value-objects/tool.vo';

export interface StationOpening {
  readonly name: StationName;
  readonly color: StationColor;
  readonly kind: StationKind;
  readonly agentPrompt: AgentPrompt | null;
  readonly passesTo: readonly string[];
  readonly tools: readonly Tool[];
  readonly ends: boolean;
}

const opening = (input: {
  name: string;
  color: string;
  prompt?: string;
  kind?: StationKind;
  passesTo?: readonly string[];
  tools?: readonly Tool[];
  ends?: boolean;
}): StationOpening => ({
  name: StationName.of(input.name),
  color: StationColor.of(input.color),
  kind: input.kind ?? 'work',
  agentPrompt: input.prompt ? AgentPrompt.of(input.prompt) : null,
  passesTo: input.passesTo ?? [],
  tools: input.tools ?? [],
  ends: input.ends ?? false,
});

const TRIAGE = `## Triage

Work out what is actually being asked for, and whether it is clear enough to
build. Read the code it would touch before deciding.

Read only. Make no edits and run nothing that changes a file, however small
the change and however certain you are of it.

Say in your note: what the change is, which parts of the codebase it lands in,
and anything the request leaves open.

Hand on when you can state the change in a sentence and name where it goes.
A small change still goes along the line rather than skipping ahead to the end 
of it.

If what was asked for is ambiguous, contradictory, or already done, that is a
question for a person, not a guess for you to make.`;

const SPEC = `## Spec

Turn what triage understood into a plan someone can implement without going
back to the requester.

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

/** What a line is made of. Stations are not added or taken away. */
export const BUILT_IN_STATIONS: readonly StationOpening[] = [
  opening({
    name: 'Backlog',
    color: '#a3a8b0',
    kind: 'backlog',
    passesTo: ['Triage'],
  }),
  opening({
    name: 'Triage',
    color: '#93a1b5',
    prompt: TRIAGE,
    passesTo: ['Spec', 'Implementation'],
  }),
  opening({
    name: 'Spec',
    color: '#5c66d9',
    prompt: SPEC,
    passesTo: ['Implementation'],
  }),
  opening({
    name: 'Implementation',
    color: '#edc12b',
    prompt: IMPLEMENTATION,
    passesTo: ['Code Review'],
  }),
  opening({
    name: 'Code Review',
    color: '#56b98d',
    prompt: CODE_REVIEW,
    passesTo: ['Implementation'],
    ends: true,
    // The one station on the opening line that opens pull requests.
    tools: [PULL_REQUEST],
  }),
  opening({
    name: 'Completed',
    color: '#a3a8b0',
    kind: 'completed',
  }),
];

/** A word from outside, and where on the opening line it takes a task. */
export interface ReactionOpening {
  readonly happening: Happening;
  /** Named rather than identified: the stations do not exist yet. */
  readonly to: string;
}

/**
 * How every line answers a word about a task it already has. Each applies
 * wherever the task stands, which is how the line behaved when a station held
 * its own reactions.
 */
export const BUILT_IN_REACTIONS: readonly ReactionOpening[] = [
  // A broken build is not a comment to weigh: it is work.
  {
    happening: Happening.of('github.checks.failed'),
    to: 'Implementation',
  },
  // What a reviewer says is weighed at review before it becomes work.
  {
    happening: Happening.of('github.pull_request.commented'),
    to: 'Code Review',
  },
  {
    happening: Happening.of('github.pull_request.changes-requested'),
    to: 'Code Review',
  },
  // Merged is the end of the line, whoever pressed the button.
  {
    happening: Happening.of('github.pull_request.merged'),
    to: 'Completed',
  },
];
