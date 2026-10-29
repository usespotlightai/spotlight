import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import {
  OPENING_PULL_REQUESTS,
  REVIEWING_PULL_REQUESTS,
} from '@work/domain/services/built-in-skills';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';

type ToolWorksOn = 'task' | 'chat';

export interface BuiltInTool {
  readonly worksOn: ToolWorksOn;
  readonly skill: SkillKey | null;
  readonly declared: DeclaredTool;
}

export const PULL_REQUEST = Tool.of('pull-request');

export const PROPOSE_TASK = Tool.of('propose-task');

export const SETUP_PULL_REQUEST = Tool.of('setup-pull-request');

export const REVIEW_COMMENT = Tool.of('review-comment');

export const REVIEW = Tool.of('review');

export const TEST_STATION_CHANGE = Tool.of('test-station-change');

export const BUILT_IN_TOOLS: readonly BuiltInTool[] = [
  {
    worksOn: 'task',
    skill: OPENING_PULL_REQUESTS,
    declared: DeclaredTool.of({
      tool: PULL_REQUEST,
      description:
        'Open a pull request for the branch of this task, or change the title and body of the one it has.',
      inputs: [
        {
          name: 'title',
          schema: InputSchema.ofType('string'),
          description: 'What it does',
          required: true,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'body',
          schema: InputSchema.ofType('string'),
          description:
            'The detail, as Markdown. Without it, an open pull request keeps its body',
          required: false,
          defaulted: false,
          stdin: true,
        },
        {
          name: 'repository',
          schema: InputSchema.ofType('string'),
          description:
            'Which of the line’s repositories, where it works several',
          required: false,
          defaulted: false,
          stdin: false,
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
        'Leave a comment on a line of the pull request this task reviews. Spotlight stores it until the review is submitted.',
      inputs: [
        {
          name: 'path',
          schema: InputSchema.ofType('string'),
          description: 'The file, from the root of the repository',
          required: true,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'line',
          schema: InputSchema.ofType('number'),
          description: 'The line it is about, or the last of several',
          required: true,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'start-line',
          schema: InputSchema.ofType('number'),
          description: 'The first line, where it is about several',
          required: false,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'side',
          schema: InputSchema.ofType('string'),
          description:
            'new for a line the pull request leaves, old for one it removes',
          required: false,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'body',
          schema: InputSchema.ofType('string'),
          description: 'What is wrong and what would fix it, as Markdown',
          required: true,
          defaulted: false,
          stdin: true,
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
          schema: InputSchema.ofType('string'),
          description: 'comment, approve or request-changes',
          required: false,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'body',
          schema: InputSchema.ofType('string'),
          description: 'What the review comes down to, as Markdown',
          required: false,
          defaulted: false,
          stdin: true,
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
          schema: InputSchema.ofType('string'),
          description: 'The line it belongs on, by its key',
          required: true,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'station',
          schema: InputSchema.ofType('string'),
          description: 'The station on that line to start it at, by its key',
          required: true,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'title',
          schema: InputSchema.ofType('string'),
          description: 'What the task is, in a line',
          required: true,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'description',
          schema: InputSchema.ofType('string'),
          description: 'What whoever works it needs to know, as Markdown',
          required: false,
          defaulted: false,
          stdin: true,
        },
      ],
    }),
  },
  {
    worksOn: 'chat',
    skill: null,
    declared: DeclaredTool.of({
      tool: SETUP_PULL_REQUEST,
      description:
        'Open the pull request with the team’s configuration, from a branch pushed to the configuration’s repository.',
      inputs: [
        {
          name: 'branch',
          schema: InputSchema.ofType('string'),
          description: 'The branch pushed, as in spotlight-configuration',
          required: true,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'title',
          schema: InputSchema.ofType('string'),
          description: 'What it does',
          required: true,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'body',
          schema: InputSchema.ofType('string'),
          description: 'The decisions and the plan, as Markdown',
          required: false,
          defaulted: false,
          stdin: true,
        },
      ],
    }),
  },
  {
    worksOn: 'chat',
    skill: null,
    declared: DeclaredTool.of({
      tool: TEST_STATION_CHANGE,
      description:
        'Measure a change to the station this chat improves. Spotlight replays it against the live config and tells the person the result in the inbox.',
      inputs: [
        {
          name: 'name',
          schema: InputSchema.ofType('string'),
          description:
            'A slug that names the change, for example shorter-prompt. It must differ from the names of other candidates',
          required: true,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'hypothesis',
          schema: InputSchema.ofType('string'),
          description: 'What you expect the change to improve',
          required: true,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'config',
          schema: InputSchema.ofType('string'),
          description:
            'The changed station block as JSON, as the line resource contains a station',
          required: true,
          defaulted: false,
          stdin: true,
        },
        {
          name: 'mode',
          schema: InputSchema.of({ type: 'string', enum: ['test', 'search'] }),
          description:
            'test replays only this change. search also lets the search agent refine it. Default: test',
          required: false,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'line',
          schema: InputSchema.ofType('string'),
          description: 'The line of the station, by its key',
          required: false,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'station',
          schema: InputSchema.ofType('string'),
          description: 'The station, by its key',
          required: false,
          defaulted: false,
          stdin: false,
        },
      ],
    }),
  },
];

export const builtInToolsForChat = (chat: {
  readonly settingUp: boolean;
  readonly improving: boolean;
}): readonly BuiltInTool[] =>
  builtInToolsFor('chat').filter(
    (each) =>
      (chat.settingUp || !each.declared.tool.equals(SETUP_PULL_REQUEST)) &&
      (chat.improving || !each.declared.tool.equals(TEST_STATION_CHANGE)),
  );

export const builtInTool = (tool: Tool): BuiltInTool | null =>
  BUILT_IN_TOOLS.find((each) => each.declared.tool.equals(tool)) ?? null;

const builtInToolsFor = (worksOn: ToolWorksOn): readonly BuiltInTool[] =>
  BUILT_IN_TOOLS.filter((each) => each.worksOn === worksOn);
