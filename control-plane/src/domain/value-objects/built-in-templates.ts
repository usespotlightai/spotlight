import { Template } from '@domain/entities/template.entity';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TemplateId } from '@domain/value-objects/template-id.vo';
import { TemplateName } from '@domain/value-objects/template-name.vo';

type Opening = [name: string, color: string, prompt: string | null];

const template = (id: string, name: string, stations: Opening[]): Template =>
  Template.of({
    id: TemplateId.of(id),
    name: TemplateName.of(name),
    stations: stations.map(([each, color, prompt]) => ({
      name: StationName.of(each),
      color: StationColor.of(color),
      agentPrompt: prompt ? AgentPrompt.of(prompt) : null,
    })),
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
request and give its address in your note:

    spotlight pull-request --title "<what it does>" --body "<the detail>"

Spotlight opens it for the branch this task was worked on. You cannot reach
GitHub yourself, and do not need to.`;

export const DEFAULT_TEMPLATE = template('default', 'Default', [
  ['Triage', '#93a1b5', TRIAGE],
  ['Spec', '#5c66d9', SPEC],
  ['Implementation', '#edc12b', IMPLEMENTATION],
  ['Code Review', '#56b98d', CODE_REVIEW],
]);

export const BUILT_IN_TEMPLATES: readonly Template[] = [DEFAULT_TEMPLATE];
