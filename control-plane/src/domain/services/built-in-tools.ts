import { DeclaredTool } from '@domain/entities/declared-tool.entity';
import { OPENING_PULL_REQUESTS } from '@domain/services/built-in-skills';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';
import { Tool } from '@domain/value-objects/tool.vo';

interface BuiltInTool {
  readonly skill: SkillKey;
  readonly declared: DeclaredTool;
}

export const PULL_REQUEST = Tool.of('pull-request');

export const BUILT_IN_TOOLS: readonly BuiltInTool[] = [
  {
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
];

export const builtInTool = (tool: Tool): BuiltInTool | null =>
  BUILT_IN_TOOLS.find((each) => each.declared.tool.equals(tool)) ?? null;
