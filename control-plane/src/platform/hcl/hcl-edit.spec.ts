import { parsedHcl } from '@platform/hcl/hcl.parse';
import {
  editedHclBlock,
  type HclBlockEdit,
  type HclField,
  type HclGuardedBlock,
  type HclReferenceRule,
} from '@platform/hcl/hcl-edit';
import {
  formattedByTerraform,
  TERRAFORM_INSTALLED,
} from '@platform/hcl/terraform-cli.fake-spec';
import { describe, expect, it } from 'vitest';

const LINES = `# The core team's delivery line.
resource "spotlight_skill" "core_grafana" {
  team_id = spotlight_team.core.id
  key     = "grafana"
}

resource "spotlight_skill" "core_oncall" {
  team_id = spotlight_team.core.id
  key     = "oncall"
}

resource "spotlight_integration" "core_linear" {
  team_id = spotlight_team.core.id
  definition = {
    integration = "linear"
  }
}

resource "spotlight_line" "core_delivery" {
  team_id = spotlight_team.core.id # owned by core
  key     = "delivery"
  name    = "Delivery"

  /* the backlog keeps
     whatever comes in */
  station {
    key    = "backlog"
    name   = "Backlog"
    kind   = "backlog"
    prompt = file("\${path.module}/prompts/shared.md")
  }

  station {
    key       = "build"
    name      = "Build"
    kind      = "work"
    harness   = "claude-code" // the harness we trust
    model     = "sonnet"
    prompt    = file("\${path.module}/prompts/shared.md")
    tools     = ["\${spotlight_integration.core_linear.integration}.comment", "github.comment"]
    skills    = [spotlight_skill.core_grafana.key]
    check     = "npm test"
    passes_to = ["completed"]

    judge {
      rubric        = file("\${path.module}/judges/build.md")
      sample        = 0.2
      min_agreement = 0.6
    }
  }

  station {
    key    = "polish"
    name   = "Polish"
    kind   = "work"
    prompt = <<-EOT
      Polish it.
        Then stop.
      EOT
    effort = var.effort
  }
}

resource "spotlight_line" "review" {
  key  = "review"
  name = "Review"
}
`;

const FILES: Readonly<Record<string, string>> = {
  'teams/core/prompts/shared.md': 'Build it.\n',
  'teams/core/judges/build.md': 'Good runs ship.\n',
};

const SKILLS: HclReferenceRule = {
  type: 'spotlight_skill',
  attribute: 'key',
  storedAt: 'key',
  tool: false,
};

const TOOLS: HclReferenceRule = {
  type: 'spotlight_integration',
  attribute: 'integration',
  storedAt: 'definition.integration',
  tool: true,
};

const BUILD = {
  harness: 'claude-code',
  model: 'sonnet',
  effort: null,
  prompt: 'Build it.\n',
  tools: ['linear.comment', 'github.comment'],
  skills: ['grafana'],
  check: 'npm test',
  passes_to: ['completed'],
} as const;

const UNSET: Readonly<Record<string, HclField['unset']>> = {
  tools: [],
  skills: [],
  passes_to: [],
};

const JUDGE: HclGuardedBlock = {
  type: 'judge',
  expected: { rubric: 'Good runs ship.\n', sample: 0.2, min_agreement: 0.6 },
};

const fieldsOf = (
  expected: Readonly<Record<string, HclField['expected']>>,
  desired: Readonly<Record<string, HclField['expected']>> = {},
  station = 'build',
): readonly HclField[] =>
  [...new Set([...Object.keys(expected), ...Object.keys(desired)])].map(
    (name) => ({
      name,
      expected: expected[name] ?? UNSET[name] ?? null,
      desired:
        name in desired
          ? (desired[name] ?? null)
          : (expected[name] ?? UNSET[name] ?? null),
      unset: UNSET[name] ?? null,
      ...(name === 'skills' ? { references: SKILLS } : {}),
      ...(name === 'tools' ? { references: TOOLS } : {}),
      ...(name === 'prompt'
        ? { freshFile: `prompts/core/delivery/${station}.md` }
        : {}),
    }),
  );

const editOf = (
  desired: Readonly<Record<string, HclField['expected']>>,
  more: Partial<HclBlockEdit> = {},
  files: Readonly<Record<string, string>> = FILES,
): HclBlockEdit => ({
  file: { path: 'teams/core/lines.tf', content: LINES },
  owner: { attribute: 'team_id', type: 'spotlight_team', key: 'core' },
  resource: { type: 'spotlight_line', key: 'delivery' },
  block: { type: 'station', key: 'build' },
  fields: fieldsOf(BUILD, desired),
  blocks: [JUDGE],
  module: [],
  read: async (path) => files[path] ?? null,
  ...more,
});

const editedTo = async (edit: HclBlockEdit) => {
  const edited = await editedHclBlock(edit);

  if (!edited.ok) {
    throw new Error(edited.error.message);
  }

  return edited;
};

const errorOf = async (edit: HclBlockEdit) => {
  const edited = await editedHclBlock(edit);

  if (edited.ok) {
    throw new Error('the edit went through');
  }

  return edited.error;
};

const mainOf = async (edit: HclBlockEdit): Promise<string> =>
  (await editedTo(edit)).files.find((each) => each.path === edit.file.path)
    ?.content ?? '';

const fmtClean = (text: string) =>
  !TERRAFORM_INSTALLED || formattedByTerraform(text) === text;

describe('parsedHcl', () => {
  it('reads literals, heredocs, file() calls and references, and leaves other expressions computed', async () => {
    const parsed = await parsedHcl(LINES);
    const delivery = parsed.blocks.find(
      (each) => each.labels[1] === 'core_delivery',
    );
    const [, build, polish] = delivery?.body.blocks ?? [];
    const readOf = (from: typeof build, name: string) =>
      from?.body.attributes.find((each) => each.name === name)?.read;

    expect(readOf(build, 'skills')).toEqual({
      kind: 'list',
      items: [
        {
          sourceText: 'spotlight_skill.core_grafana.key',
          read: {
            kind: 'reference',
            type: 'spotlight_skill',
            name: 'core_grafana',
            attribute: 'key',
            suffix: null,
          },
        },
      ],
    });
    expect(readOf(build, 'tools')).toMatchObject({
      kind: 'list',
      items: [
        {
          read: { kind: 'reference', name: 'core_linear', suffix: '.comment' },
        },
        { read: { kind: 'literal', value: 'github.comment' } },
      ],
    });
    expect(readOf(build, 'prompt')).toEqual({
      kind: 'file',
      path: 'prompts/shared.md',
      fromModule: true,
    });
    expect(readOf(polish, 'prompt')).toEqual({
      kind: 'literal',
      value: 'Polish it.\n  Then stop.\n',
    });
    expect(readOf(polish, 'effort')).toEqual({ kind: 'computed' });
  });

  it('unescapes quoted strings and keeps interpolated ones computed', async () => {
    const parsed = await parsedHcl(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      'a = "x\\"y\\n\\u00e9 $${z}"\nb = "${var.x}-y-${var.z}"\nc = file("p.md")\n',
    );
    const [a, b, c] = parsed.attributes;

    // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
    expect(a?.read).toEqual({ kind: 'literal', value: 'x"y\né ${z}' });
    expect(b?.read).toEqual({ kind: 'computed' });
    expect(c?.read).toEqual({ kind: 'file', path: 'p.md', fromModule: false });
  });

  it('fails on a file that does not parse', async () => {
    await expect(parsedHcl('resource "x" {\n  a = \n')).rejects.toThrow(
      'does not parse as HCL',
    );
  });
});

describe('editedHclBlock', () => {
  it('replaces only the values it changes, keeping every other byte', async () => {
    const main = await mainOf(editOf({ model: 'opus' }));

    expect(main).toBe(
      LINES.replace('    model     = "sonnet"', '    model     = "opus"'),
    );
  });

  it('writes a changed prompt to the station’s own file, leaving a file another station reads alone', async () => {
    const edited = await editedTo(editOf({ prompt: 'Build it, in order.\n' }));

    expect(edited.files).toEqual([
      {
        path: 'teams/core/lines.tf',
        content: LINES.replace(
          // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
          '    prompt    = file("${path.module}/prompts/shared.md")',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
          '    prompt    = file("${path.module}/prompts/core/delivery/build.md")',
        ),
      },
      {
        path: 'teams/core/prompts/core/delivery/build.md',
        content: 'Build it, in order.\n',
      },
    ]);
    expect(fmtClean(edited.files[0]?.content ?? '')).toBe(true);
  });

  it('edits the station’s own prompt file in place, and picks a free name when the usual one is taken', async () => {
    const own = LINES.replace(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
      '    prompt    = file("${path.module}/prompts/shared.md")',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
      '    prompt    = file("${path.module}/prompts/core/delivery/build.md")',
    );
    const files = {
      ...FILES,
      'teams/core/prompts/core/delivery/build.md': 'Build it.\n',
    };

    expect(
      (
        await editedTo(
          editOf(
            { prompt: 'Ship it.\n' },
            { file: { path: 'teams/core/lines.tf', content: own } },
            files,
          ),
        )
      ).files,
    ).toEqual([
      {
        path: 'teams/core/prompts/core/delivery/build.md',
        content: 'Ship it.\n',
      },
    ]);

    const taken = await editedTo(
      editOf(
        { prompt: 'Ship it.\n' },
        {},
        {
          ...FILES,
          'teams/core/prompts/core/delivery/build.md': 'Someone else’s.\n',
        },
      ),
    );

    expect(taken.files.map((each) => each.path)).toEqual([
      'teams/core/lines.tf',
      'teams/core/prompts/core/delivery/build-2.md',
    ]);
  });

  it('keeps CRLF line endings in the file and in a rewritten prompt', async () => {
    const crlf = LINES.replace(/\n/g, '\r\n');
    const edited = await editedTo(
      editOf(
        { effort: 'high', prompt: 'Build.\nThen ship.\n' },
        { file: { path: 'teams/core/lines.tf', content: crlf } },
        { ...FILES, 'teams/core/prompts/shared.md': 'Build it.\r\n' },
      ),
    );
    const [main, prompt] = edited.files;

    expect(main?.content).toContain(
      '    passes_to = ["completed"]\r\n\r\n    effort = "high"\r\n\r\n    judge {',
    );
    expect(main?.content.replace(/\r\n/g, '')).not.toContain('\n');
    expect(prompt?.content).toBe('Build.\r\nThen ship.\r\n');
  });

  it('replaces a heredoc prompt in place, and writes a quoted string when something follows the value on its line', async () => {
    const polish = {
      block: { type: 'station', key: 'polish' },
      fields: fieldsOf(
        { prompt: 'Polish it.\n  Then stop.\n' },
        { prompt: 'Polish it.\nStop there.\n' },
        'polish',
      ),
      blocks: [],
    };
    const main = await mainOf(editOf({}, polish));

    expect(main).toContain(
      '    prompt = <<EOT\nPolish it.\nStop there.\nEOT\n    effort',
    );
    expect(fmtClean(main)).toBe(true);

    const commented = await mainOf(editOf({ harness: 'codex\nfirst\n' }));

    expect(commented).toContain(
      '    harness   = "codex\\nfirst\\n" // the harness we trust\n',
    );
  });

  it('adds what the block leaves out after its last attribute', async () => {
    const main = await mainOf(
      editOf({ effort: 'high', description: 'Builds.' }),
    );

    expect(main).toContain(
      '    passes_to = ["completed"]\n\n    effort      = "high"\n    description = "Builds."\n\n    judge {',
    );
    expect(fmtClean(main)).toBe(true);
  });

  it('spreads a block written on one line before adding to it', async () => {
    const oneLine = `resource "spotlight_line" "core_delivery" {\n  key = "delivery"\n  station { key = "build" }\n}\n`;
    const main = await mainOf(
      editOf(
        { model: 'opus' },
        {
          file: { path: 'main.tf', content: oneLine },
          fields: fieldsOf({ model: null }, { model: 'opus' }),
          blocks: [],
        },
      ),
    );

    expect(main).toBe(
      `resource "spotlight_line" "core_delivery" {\n  key = "delivery"\n  station {\n    key = "build"\n\n    model = "opus"\n  }\n}\n`,
    );
    expect(fmtClean(main)).toBe(true);
  });

  it('keeps references, refers to the team’s own skills and integrations, and writes the rest as literals', async () => {
    const main = await mainOf(
      editOf({
        skills: ['grafana', 'oncall', 'catalog.research@1.0.0'],
        tools: ['github.comment', 'linear.create', 'linear.comment'],
      }),
    );

    expect(main).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
      '    tools     = ["github.comment", "${spotlight_integration.core_linear.integration}.create", "${spotlight_integration.core_linear.integration}.comment"]\n',
    );
    expect(main).toContain(
      '    skills    = [spotlight_skill.core_grafana.key, spotlight_skill.core_oncall.key, "catalog.research@1.0.0"]\n',
    );
    expect(fmtClean(main)).toBe(true);
  });

  it('refers to skills and integrations written in another file of the module', async () => {
    const at = LINES.indexOf('resource "spotlight_line"');
    const files = { ...FILES, 'teams/core/skills.tf': LINES.slice(0, at) };
    const main = await mainOf(
      editOf(
        {
          skills: ['grafana', 'oncall'],
          tools: ['linear.comment'],
        },
        {
          file: { path: 'teams/core/lines.tf', content: LINES.slice(at) },
          module: ['teams/core/skills.tf'],
        },
        files,
      ),
    );

    expect(main).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
      '    tools     = ["${spotlight_integration.core_linear.integration}.comment"]\n',
    );
    expect(main).toContain(
      '    skills    = [spotlight_skill.core_grafana.key, spotlight_skill.core_oncall.key]\n',
    );
  });

  it('fails on another file of the module that does not parse, naming it', async () => {
    const error = await errorOf(
      editOf(
        { model: 'opus' },
        { module: ['teams/core/skills.tf'] },
        { ...FILES, 'teams/core/skills.tf': 'resource "spotlight_skill" {\n' },
      ),
    );

    expect(error).toMatchObject({ code: 'unparsable' });
    expect(error?.message).toContain('"teams/core/skills.tf"');
  });

  it('does not change what it cannot resolve, and lists what it could not check', async () => {
    const elsewhere = LINES.replace(
      'skills    = [spotlight_skill.core_grafana.key]',
      'skills    = [module.shared.skill]',
    );
    const error = await errorOf(
      editOf(
        { skills: ['oncall'] },
        { file: { path: 'teams/core/lines.tf', content: elsewhere } },
      ),
    );

    expect(error).toMatchObject({
      code: 'computed-attribute',
      attribute: 'skills',
      expression: '[module.shared.skill]',
      wanted: ['oncall'],
    });

    const unchecked = await editedTo(
      editOf(
        { model: 'opus' },
        { file: { path: 'teams/core/lines.tf', content: elsewhere } },
      ),
    );

    expect(unchecked.unchecked).toEqual(['skills']);
  });

  it('fails on a plain relative file() it cannot follow, and a computed attribute, saying what it wanted', async () => {
    const plain = LINES.replace(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
      'prompt    = file("${path.module}/prompts/shared.md")',
      'prompt    = file("prompts/shared.md")',
    );

    expect(
      await errorOf(
        editOf(
          { prompt: 'Ship.\n' },
          { file: { path: 'teams/core/lines.tf', content: plain } },
        ),
      ),
    ).toMatchObject({ code: 'computed-attribute', attribute: 'prompt' });
    expect(
      await errorOf(
        editOf(
          {},
          {
            block: { type: 'station', key: 'polish' },
            fields: [
              { name: 'effort', expected: 'high', desired: 'max', unset: null },
            ],
            blocks: [],
          },
        ),
      ),
    ).toEqual({
      code: 'computed-attribute',
      message:
        'Terraform computes `effort` from `var.effort`. Please change it by hand.',
      attribute: 'effort',
      expression: 'var.effort',
      wanted: 'max',
    });
  });

  it('finds the line of the edit’s team when two teams share a line key', async () => {
    const growth = LINES.replace(
      'resource "spotlight_line" "review" {',
      'resource "spotlight_line" "growth_delivery" {\n  team_id = spotlight_team.growth.id\n  key     = "delivery"\n  name    = "Delivery"\n}\n\nresource "spotlight_line" "review" {',
    );

    expect(
      await mainOf(
        editOf(
          { model: 'opus' },
          { file: { path: 'teams/core/lines.tf', content: growth } },
        ),
      ),
    ).toContain('model     = "opus"');
    expect(
      await errorOf(
        editOf(
          { model: 'opus' },
          {
            file: { path: 'teams/core/lines.tf', content: growth },
            owner: {
              attribute: 'team_id',
              type: 'spotlight_team',
              key: 'design',
            },
          },
        ),
      ),
    ).toMatchObject({ code: 'block-not-found' });

    const literal = `resource "spotlight_line" "a" {\n  team_id = "t1"\n  key = "delivery"\n  station {\n    key = "build"\n    model = "sonnet"\n  }\n}\n`;
    const only = editOf(
      {},
      {
        file: { path: 'main.tf', content: literal },
        fields: fieldsOf({ model: 'sonnet' }, { model: 'opus' }),
        blocks: [],
      },
    );

    expect(await mainOf(only)).toContain('model = "opus"');
    expect(
      await errorOf({
        ...only,
        file: {
          path: 'main.tf',
          content: `${literal}${literal.replace('"a"', '"b"').replace('"t1"', '"t2"')}`,
        },
      }),
    ).toMatchObject({ code: 'blocks-ambiguous' });
  });

  it('fails when no block or more than one block has the key', async () => {
    expect(
      await errorOf(
        editOf({}, { block: { type: 'station', key: 'ship' }, fields: [] }),
      ),
    ).toMatchObject({
      code: 'block-not-found',
      message:
        'The resource has no station block with key "ship". Found: 3 station blocks in the resource with key "delivery", 0 with key "ship"',
    });

    const twice = LINES.replace(
      '  station {\n    key    = "polish"',
      '  station {\n    key = "build"\n  }\n\n  station {\n    key    = "polish"',
    );

    expect(
      await errorOf(
        editOf({}, { file: { path: 'teams/core/lines.tf', content: twice } }),
      ),
    ).toMatchObject({ code: 'blocks-ambiguous' });
  });

  it('fails when anything the search started from changed in the repository, the judge and routes included', async () => {
    const changedIn = (from: string, to: string) =>
      errorOf(
        editOf(
          { model: 'opus' },
          {
            file: {
              path: 'teams/core/lines.tf',
              content: LINES.replace(from, to),
            },
          },
        ),
      );

    for (const [from, to, attribute] of [
      ['harness   = "claude-code"', 'harness   = "codex"', 'harness'],
      ['check     = "npm test"', 'check     = "npm run test"', 'check'],
      ['passes_to = ["completed"]', 'passes_to = []', 'passes_to'],
      ['sample        = 0.2', 'sample        = 0.3', 'judge'],
      [
        'skills    = [spotlight_skill.core_grafana.key]',
        'skills    = []',
        'skills',
      ],
    ] as const) {
      expect(await changedIn(from, to)).toMatchObject({
        code: 'base-changed',
        attribute,
      });
    }

    expect(
      await errorOf(
        editOf(
          { model: 'opus' },
          {},
          {
            ...FILES,
            'teams/core/judges/build.md': 'Runs ship.\n',
          },
        ),
      ),
    ).toMatchObject({ code: 'base-changed', attribute: 'judge' });
  });

  it('checks a prompt file before taking the prompt away', async () => {
    expect(
      await errorOf(
        editOf(
          { prompt: null },
          {},
          {
            ...FILES,
            'teams/core/prompts/shared.md': 'Something else.\n',
          },
        ),
      ),
    ).toMatchObject({ code: 'base-changed', attribute: 'prompt' });
    expect(await mainOf(editOf({ prompt: null }))).toContain(
      '    prompt    = null\n',
    );
  });

  it('writes any other attribute read with file() to the station’s own file too, and never inlines one it has no file for', async () => {
    const described = LINES.replace(
      '    check     = "npm test"\n',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
      '    check     = "npm test"\n    description = file("${path.module}/prompts/shared.md")\n',
    );
    const fields = (fresh: boolean): readonly HclField[] => [
      ...fieldsOf(BUILD),
      {
        name: 'description',
        expected: 'Build it.\n',
        desired: 'Builds the change.\n',
        unset: null,
        ...(fresh
          ? { freshFile: 'prompts/core/delivery/build.description.md' }
          : {}),
      },
    ];
    const edit = (fresh: boolean) =>
      editOf(
        {},
        {
          file: { path: 'teams/core/lines.tf', content: described },
          fields: fields(fresh),
        },
      );
    const edited = await editedTo(edit(true));

    expect(edited.files.map((each) => each.path)).toEqual([
      'teams/core/lines.tf',
      'teams/core/prompts/core/delivery/build.description.md',
    ]);
    expect(edited.files[0]?.content).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
      'description = file("${path.module}/prompts/core/delivery/build.description.md")',
    );
    expect(edited.files[0]?.content).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
      '    prompt    = file("${path.module}/prompts/shared.md")',
    );
    expect(await errorOf(edit(false))).toMatchObject({
      code: 'edit-failed',
      attribute: 'description',
    });
  });

  it('fails on a prompt file the repository does not contain', async () => {
    expect(await errorOf(editOf({ prompt: 'Ship.\n' }, {}, {}))).toMatchObject({
      code: 'file-missing',
    });
  });
});
