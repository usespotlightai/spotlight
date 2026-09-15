import { DeclaredTool } from '@domain/entities/declared-tool.entity';
import { OPENING_PULL_REQUESTS } from '@domain/services/built-in-skills';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';
import { Tool } from '@domain/value-objects/tool.vo';

export type ToolWorksOn = 'task' | 'chat';

export interface BuiltInTool {
  readonly worksOn: ToolWorksOn;
  readonly skill: SkillKey | null;
  readonly declared: DeclaredTool;
}

export const PULL_REQUEST = Tool.of('pull-request');

export const PROPOSE_TASK = Tool.of('propose-task');

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
