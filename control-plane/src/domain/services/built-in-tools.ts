import { Tool } from '@domain/value-objects/tool.vo';

/**
 * A tool as a run is told about it. The instructions are what the agent
 * reads, so they are written to be acted on rather than to describe.
 */
export interface ToolDeclaration {
  readonly tool: Tool;
  readonly label: string;
  readonly instructions: string;
}

export const PULL_REQUEST = Tool.of('pull-request');

const OPENING = `## Opening a pull request

Run this, from anywhere in the workspace:

\`\`\`
spotlight pull-request --title "<what it does>" --body "<the detail>"
\`\`\`

Spotlight opens it for the branch this task was worked on, and answers with
its address. You cannot reach the host yourself, and do not need to: what it
takes to open one never leaves Spotlight.

A long body is easier piped in, as \`spotlight pull-request --title "…" < body.md\`.

One task has one pull request. Asking again where one is already open answers
with the one that is there rather than opening another.`;

/**
 * What Spotlight itself can do for a run. A repository will be able to say
 * what else it has, and these will read the same way when it does.
 */
export const BUILT_IN_TOOLS: readonly ToolDeclaration[] = [
  {
    tool: PULL_REQUEST,
    label: 'Open a pull request',
    instructions: OPENING,
  },
];

export const toolNamed = (tool: Tool): ToolDeclaration | null =>
  BUILT_IN_TOOLS.find((each) => each.tool.equals(tool)) ?? null;
