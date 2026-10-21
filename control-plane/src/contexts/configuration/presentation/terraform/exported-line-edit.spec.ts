import { CONFIGURATION } from '@configuration/presentation/terraform/exportable-configuration.fake-spec';
import { workspaceTerraform } from '@configuration/presentation/terraform/terraform-configuration';
import type { HclLiteral } from '@platform/hcl/hcl.parse';
import {
  editedHclBlock,
  type HclBlockEdit,
  type HclField,
} from '@platform/hcl/hcl-edit';
import {
  formattedByTerraform,
  TERRAFORM_INSTALLED,
} from '@platform/hcl/terraform-cli.fake-spec';
import { describe, expect, it } from 'vitest';

const ROOT = 'infra/spotlight';

const EXPORTED = workspaceTerraform(CONFIGURATION).map((each) => ({
  path: `${ROOT}/${each.path}`,
  content: each.content,
}));

const LINE = EXPORTED.find(
  (each) => each.path === `${ROOT}/line-core-delivery.tf`,
) ?? {
  path: '',
  content: '',
};

const PROMPT = `${ROOT}/prompts/core/delivery/implementation.md`;

const SEED: Readonly<Record<string, HclLiteral>> = {
  harness: 'claude-code',
  model: null,
  effort: null,
  description: null,
  profile: 'careful',
  prompt: 'Implement the task.\n\n',
  decisions: true,
  memories: false,
  tools: ['linear.comment', 'github.comment', 'catalog.web-search@1.1.0'],
  skills: ['grafana', 'catalog.research@1.0.0'],
  check: 'npm test',
  passes_to: [],
};

const RULES: Readonly<Record<string, HclField['references']>> = {
  profile: {
    type: 'spotlight_harness_profile',
    attribute: 'key',
    storedAt: 'key',
    tool: false,
  },
  skills: {
    type: 'spotlight_skill',
    attribute: 'key',
    storedAt: 'key',
    tool: false,
  },
  tools: {
    type: 'spotlight_integration',
    attribute: 'integration',
    storedAt: 'definition.integration',
    tool: true,
  },
};

const LISTS = new Set(['tools', 'skills', 'passes_to']);

const editOf = (now: Readonly<Record<string, HclLiteral>>): HclBlockEdit => ({
  file: LINE,
  owner: { attribute: 'team_id', type: 'spotlight_team', key: 'core' },
  resource: { type: 'spotlight_line', key: 'delivery' },
  block: { type: 'station', key: 'implementation' },
  fields: Object.entries(SEED).map(([name, was]) => ({
    name,
    expected: was,
    desired: name in now ? (now[name] ?? null) : was,
    unset: LISTS.has(name)
      ? []
      : name === 'decisions' || name === 'memories'
        ? false
        : null,
    ...(RULES[name] ? { references: RULES[name] } : {}),
    ...(name === 'prompt'
      ? { freshFile: 'prompts/core/delivery/implementation.md' }
      : {}),
  })),
  blocks: [
    {
      type: 'judge',
      expected: {
        rubric: 'A good run changes only what the task requests.\n',
        sample: 0.2,
        min_agreement: 0.6,
      },
    },
  ],
  module: EXPORTED.map((each) => each.path).filter(
    (path) => path.endsWith('.tf') && path !== LINE.path,
  ),
  read: async (path) =>
    EXPORTED.find((each) => each.path === path)?.content ?? null,
});

describe('editing a line Spotlight exported', () => {
  it('changes the station’s prompt file and values, leaving every other byte of the export', async () => {
    const edited = await editedHclBlock(
      editOf({
        prompt: 'Implement the task, smallest change first.\n',
        harness: 'codex',
        model: 'gpt-5',
        decisions: false,
      }),
    );

    expect(edited.ok && edited.unchecked).toEqual([]);

    const files = edited.ok ? edited.files : [];
    const line = files.find((each) => each.path === LINE.path)?.content ?? '';

    expect(files.find((each) => each.path === PROMPT)?.content).toBe(
      'Implement the task, smallest change first.\n',
    );
    expect(line).toBe(
      LINE.content
        .replace(
          '    harness   = "claude-code"\n    profile',
          '    harness   = "codex"\n    profile',
        )
        .replace(
          '    decisions = true\n    memories  = false\n',
          '    decisions = false\n    memories  = false\n',
        )
        .replace(
          '    ends      = true\n\n    judge {',
          '    ends      = true\n\n    model = "gpt-5"\n\n    judge {',
        ),
    );
    if (TERRAFORM_INSTALLED) {
      expect(formattedByTerraform(LINE.content)).toBe(LINE.content);
      expect(formattedByTerraform(line)).toBe(line);
    }
  });

  it('changes tools, skills and the profile the export wrote as references, keeping references where the export has the resource', async () => {
    const edited = await editedHclBlock(
      editOf({
        tools: ['github.comment', 'linear.comment'],
        skills: ['catalog.research@1.0.0', 'grafana'],
        profile: 'bold',
      }),
    );
    const line = edited.ok ? (edited.files[0]?.content ?? '') : '';

    expect(edited.ok).toBe(true);
    expect(line).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      '    tools     = ["github.comment", "${spotlight_integration.core_linear.integration}.comment"]\n',
    );
    expect(line).toContain(
      '    skills    = ["catalog.research@1.0.0", spotlight_skill.core_grafana.key]\n',
    );
    expect(line).toContain('    profile   = "bold"\n');
    if (TERRAFORM_INSTALLED) {
      expect(formattedByTerraform(line)).toBe(line);
    }
  });
});
