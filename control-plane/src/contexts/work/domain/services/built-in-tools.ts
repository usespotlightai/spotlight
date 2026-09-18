import {
  OPENING_PULL_REQUESTS,
  REVIEWING_PULL_REQUESTS,
} from '@work/domain/services/built-in-skills';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';

export type ToolWorksOn = 'task' | 'chat';

export interface BuiltInTool {
  readonly worksOn: ToolWorksOn;
  readonly skill: SkillKey | null;
  readonly declared: DeclaredTool;
}

export const PULL_REQUEST = Tool.of('pull-request');

export const PROPOSE_TASK = Tool.of('propose-task');

export const REVIEW_COMMENT = Tool.of('review-comment');

export const REVIEW = Tool.of('review');

export const BUILT_IN_TOOLS: readonly BuiltInTool[] = [
  {
    worksOn: 'task',
    skill: OPENING_PULL_REQUESTS,
    declared: DeclaredTool.of({
      tool: PULL_REQUEST,
      description:
        'Open a pull request for the branch this task was worked on.',
      inputs: [
        {
          name: 'title',
          type: 'string',
          description: 'What it does',
          required: true,
          defaulted: false,
          piped: false,
        },
        {
          name: 'body',
          type: 'string',
          description: 'The detail, as Markdown',
          required: false,
          defaulted: false,
          piped: true,
        },
        {
          name: 'repository',
          type: 'string',
          description:
            'Which of the line’s repositories, where it works several',
          required: false,
          defaulted: false,
          piped: false,
        },
      ],
    }),
  },
  {
    worksOn: 'task',
    skill: REVIEWING_PULL_REQUESTS,
    declared: DeclaredTool.of({
      tool: REVIEW_COMMENT,
      description:
        'Leave a comment on a line of the pull request this task reviews. It is held until the review is submitted.',
      inputs: [
        {
          name: 'path',
          type: 'string',
          description: 'The file, from the root of the repository',
          required: true,
          defaulted: false,
          piped: false,
        },
        {
          name: 'line',
          type: 'number',
          description: 'The line it is about, or the last of several',
          required: true,
          defaulted: false,
          piped: false,
        },
        {
          name: 'start-line',
          type: 'number',
          description: 'The first line, where it is about several',
          required: false,
          defaulted: false,
          piped: false,
        },
        {
          name: 'side',
          type: 'string',
          description:
            'new for a line the pull request leaves, old for one it removes',
          required: false,
          defaulted: false,
          piped: false,
        },
        {
          name: 'body',
          type: 'string',
          description: 'What is wrong and what would fix it, as Markdown',
          required: true,
          defaulted: false,
          piped: true,
        },
      ],
    }),
  },
  {
    worksOn: 'task',
    skill: REVIEWING_PULL_REQUESTS,
    declared: DeclaredTool.of({
      tool: REVIEW,
      description:
        'Submit the comments left so far as one review of the pull request this task reviews.',
      inputs: [
        {
          name: 'verdict',
          type: 'string',
          description: 'comment, approve or request-changes',
          required: false,
          defaulted: false,
          piped: false,
        },
        {
          name: 'body',
          type: 'string',
          description: 'What the review comes down to, as Markdown',
          required: false,
          defaulted: false,
          piped: true,
        },
      ],
    }),
  },
  {
    worksOn: 'chat',
    skill: null,
    declared: DeclaredTool.of({
      tool: PROPOSE_TASK,
      description:
        'Propose a task for the person to create at a station. Nothing is created until they accept it.',
      inputs: [
        {
          name: 'line',
          type: 'string',
          description: 'The line it belongs on, by its key',
          required: true,
          defaulted: false,
          piped: false,
        },
        {
          name: 'station',
          type: 'string',
          description: 'The station on that line to start it at, by its key',
          required: true,
          defaulted: false,
          piped: false,
        },
        {
          name: 'title',
          type: 'string',
          description: 'What the task is, in a line',
          required: true,
          defaulted: false,
          piped: false,
        },
        {
          name: 'description',
          type: 'string',
          description: 'What whoever works it needs to know, as Markdown',
          required: false,
          defaulted: false,
          piped: true,
        },
      ],
    }),
  },
];

export const builtInTool = (tool: Tool): BuiltInTool | null =>
  BUILT_IN_TOOLS.find((each) => each.declared.tool.equals(tool)) ?? null;

export const builtInToolsFor = (worksOn: ToolWorksOn): readonly BuiltInTool[] =>
  BUILT_IN_TOOLS.filter((each) => each.worksOn === worksOn);
