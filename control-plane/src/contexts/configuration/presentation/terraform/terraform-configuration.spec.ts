import type {
  HeldConfigurationDto,
  HeldResourceDto,
} from '@configuration/application/dto/held-configuration.dto';
import {
  resourceHcl,
  workspaceTerraform,
} from '@configuration/presentation/terraform/terraform-configuration';
import {
  formattedByTerraform,
  TERRAFORM_INSTALLED,
} from '@platform/hcl/terraform-cli.fake-spec';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE_ID = '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57';

const DELIVERY = {
  key: 'delivery',
  name: 'Delivery',
  role: 'delivery',
  repositories: ['acme/api'],
  runners: ['build-1', 'vpc-internal'],
  stations: [
    {
      key: 'backlog',
      name: 'Backlog',
      kind: 'backlog',
      color: '#a3a8b0',
      diffs: false,
      decisions: false,
      tools: [],
      skills: [],
      passesTo: ['implementation'],
      ends: false,
    },
    {
      key: 'implementation',
      name: 'Implementation',
      kind: 'work',
      color: '#6d78d5',
      harness: 'claude-code',
      profile: 'careful',
      prompt: 'Implement the task.\n\n',
      check: 'npm test',
      diffs: true,
      decisions: true,
      tools: ['linear.comment', 'github.comment', 'catalog.summarize@1.0.0'],
      skills: ['grafana', 'spotlight'],
      runners: ['gpu'],
      passesTo: ['completed'],
      ends: false,
    },
  ],
  reactions: [
    {
      happening: 'github.checks.failed',
      from: 'implementation',
      to: 'implementation',
    },
  ],
  reviews: {
    start: 'opened',
    skip: {
      spotlight: true,
      drafts: true,
      authors: ['dependabot[bot]', 'renovate[bot]'],
    },
  },
};

const LINEAR = {
  integration: 'linear',
  actions: {
    comment: {
      request: {
        method: 'POST',
        url: 'https://api.linear.app/graphql',
        headers: { 'Content-Type': 'application/json' },
        // biome-ignore lint/suspicious/noTemplateCurlyInString: an integration expression
        body: { query: '${{ inputs.body }}' },
        auth: { secrets: ['secret.LINEAR_API_KEY', 'secret.ELSEWHERE'] },
      },
    },
  },
  webhook: { verify: { hmac: { secret: 'secret.LINEAR_SIGNING' } } },
  tools: {
    comment: {
      does: 'comment',
      description: 'Comment on the issue.\nUse it to say what you did.\n',
      inputs: { body: { type: 'string', required: true, piped: false } },
    },
  },
};

const HELD: HeldConfigurationDto = {
  workspaceId: WORKSPACE_ID,
  workspaceSlug: 'acme',
  resources: [
    {
      kind: 'workspace',
      id: WORKSPACE_ID,
      address: 'acme',
      slug: 'acme',
      name: 'Acme',
    },
    {
      kind: 'secret',
      heldBy: 'workspace',
      id: 'secret_linear',
      address: 'LINEAR_API_KEY',
      name: 'LINEAR_API_KEY',
      source: { kind: 'built-in', secretId: null, field: null },
      bindings: [
        { host: 'api.linear.app', header: 'authorization', prefix: 'Bearer ' },
      ],
      keepsValue: true,
      valueVersion: 3,
    },
    {
      kind: 'secret',
      heldBy: 'workspace',
      id: 'secret_signing',
      address: 'LINEAR_SIGNING',
      name: 'LINEAR_SIGNING',
      source: {
        kind: 'aws-secrets-manager',
        secretId: 'linear/signing',
        field: 'secret',
      },
      bindings: [],
      keepsValue: false,
      valueVersion: null,
    },
    {
      kind: 'runner',
      heldBy: 'workspace',
      id: 'runner_build',
      address: 'build-1',
      name: 'build-1',
      labels: ['vpc-internal'],
    },
    {
      kind: 'runner-trust',
      heldBy: 'workspace',
      id: 'trust_cluster',
      address: 'production-cluster',
      key: 'production-cluster',
      issuer: 'https://oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE',
      subject: 'system:serviceaccount:spotlight:runner',
      audience: 'spotlight',
      labels: ['gpu'],
    },
    {
      kind: 'workspace-runners',
      heldBy: 'workspace',
      id: 'declared_acme',
      address: 'acme',
      runners: ['build-1', 'gone-1'],
      trusts: ['production-cluster'],
    },
    {
      kind: 'team',
      heldBy: 'workspace',
      id: 'team_core',
      address: 'core',
      key: 'core',
      name: 'Core',
    },
    {
      kind: 'line',
      heldBy: 'team',
      id: 'line_delivery',
      address: 'core/delivery',
      teamKey: 'core',
      key: 'delivery',
      definition: DELIVERY,
    },
    {
      kind: 'skill',
      heldBy: 'team',
      id: 'skill_grafana',
      address: 'core/grafana',
      teamKey: 'core',
      key: 'grafana',
      files: {
        'SKILL.md':
          '---\nname: grafana\ndescription: Look up dashboards\n---\n',
        'queries/latency.promql': 'histogram_quantile(0.99, rate(x[5m]))',
      },
    },
    {
      kind: 'integration',
      heldBy: 'team',
      id: 'integration_linear',
      address: 'core/linear',
      teamKey: 'core',
      source: 'linear',
      definition: LINEAR,
      secretsWorn: [
        {
          path: FieldPath.of([
            'actions',
            'comment',
            'request',
            'auth',
            'secrets',
            0,
          ]),
          name: 'LINEAR_API_KEY',
        },
        {
          path: FieldPath.of([
            'actions',
            'comment',
            'request',
            'auth',
            'secrets',
            1,
          ]),
          name: 'ELSEWHERE',
        },
        {
          path: FieldPath.of(['webhook', 'verify', 'hmac', 'secret']),
          name: 'LINEAR_SIGNING',
        },
      ],
    },
    {
      kind: 'harness-profile',
      heldBy: 'team',
      id: 'profile_careful',
      address: 'core/careful',
      teamKey: 'core',
      key: 'careful',
      permissions: {
        allow: ['read', 'execute(npm test *)'],
        ask: [],
        deny: ['read(.env)'],
      },
      mcpServers: [
        {
          name: 'linear',
          command: 'npx',
          args: ['-y', 'linear-mcp'],
          env: { LINEAR_WORKSPACE: 'acme', 'log.level': 'debug' },
        },
      ],
      native: { 'claude-code': { includeCoAuthoredBy: false } },
    },
    {
      kind: 'team',
      heldBy: 'workspace',
      id: 'team_3d',
      address: '3d',
      key: '3d',
      name: 'Three D',
    },
  ],
};

const fileOf = (configuration: HeldConfigurationDto, path: string): string =>
  workspaceTerraform(configuration).find((each) => each.path === path)
    ?.content ?? '';

const mainOf = (configuration: HeldConfigurationDto): string =>
  fileOf(configuration, 'main.tf');

const heldAs = (kind: HeldResourceDto['kind']): HeldResourceDto => {
  const held = HELD.resources.find((each) => each.kind === kind);

  if (!held) {
    throw new Error(`no ${kind} held`);
  }

  return held;
};

const LINE_RESOURCE = `resource "spotlight_line" "core_delivery" {
  team_id      = spotlight_team.core.id
  key          = "delivery"
  name         = "Delivery"
  role         = "delivery"
  repositories = ["acme/api"]
  runners      = [spotlight_runner.build-1.name, "vpc-internal"]

  station {
    key       = "backlog"
    name      = "Backlog"
    kind      = "backlog"
    color     = "#a3a8b0"
    diffs     = false
    decisions = false
    tools     = []
    skills    = []
    passes_to = ["implementation"]
    ends      = false
  }

  station {
    key       = "implementation"
    name      = "Implementation"
    kind      = "work"
    color     = "#6d78d5"
    harness   = "claude-code"
    profile   = spotlight_harness_profile.core_careful.key
    prompt    = file("\${path.module}/prompts/core/delivery/implementation.md")
    check     = "npm test"
    diffs     = true
    decisions = true
    tools     = ["\${spotlight_integration.core_linear.source}.comment", "github.comment", "catalog.summarize@1.0.0"]
    skills    = [spotlight_skill.core_grafana.key, "spotlight"]
    runners   = ["gpu"]
    passes_to = ["completed"]
    ends      = false
  }

  reaction {
    happening = "github.checks.failed"
    from      = "implementation"
    to        = "implementation"
  }

  reviews {
    start = "opened"

    skip {
      spotlight = true
      drafts    = true
      authors   = ["dependabot[bot]", "renovate[bot]"]
    }
  }
}
`;

describe('workspaceTerraform', () => {
  it('writes main.tf, variables.tf and every file main.tf reads, ordered by path', () => {
    expect(workspaceTerraform(HELD).map((each) => each.path)).toEqual([
      'main.tf',
      'prompts/core/delivery/implementation.md',
      'skills/core/grafana/SKILL.md',
      'skills/core/grafana/queries/latency.promql',
      'variables.tf',
    ]);
  });

  it('writes no variables.tf when nothing needs a value from outside', () => {
    const quiet: HeldConfigurationDto = {
      ...HELD,
      resources: HELD.resources.filter(
        (each) => each.kind !== 'runner' && each.kind !== 'secret',
      ),
    };

    expect(workspaceTerraform(quiet).map((each) => each.path)).not.toContain(
      'variables.tf',
    );
  });

  it('asks for the Spotlight provider', () => {
    expect(mainOf(HELD)).toMatch(
      /^terraform {\n {2}required_providers {\n {4}spotlight = {\n {6}source = "usespotlightai\/spotlight"\n/,
    );
  });

  it('adopts the workspace by its slug and never creates one', () => {
    const main = mainOf(HELD);

    expect(main).toContain(
      'import {\n  to = spotlight_workspace.acme\n  id = "acme"\n}\n\nresource "spotlight_workspace" "acme" {\n  name = "Acme"\n  slug = "acme"\n}\n',
    );
    expect(main.match(/resource "spotlight_workspace"/g)).toHaveLength(1);
    expect(main.match(/to = spotlight_workspace\./g)).toHaveLength(1);
  });

  it('imports every other resource by its workspace id and address', () => {
    const main = mainOf(HELD);

    for (const [type, name, address] of [
      ['spotlight_secret', 'linear_api_key', 'LINEAR_API_KEY'],
      ['spotlight_runner', 'build-1', 'build-1'],
      ['spotlight_runner_trust', 'production-cluster', 'production-cluster'],
      ['spotlight_workspace_runners', 'acme', 'acme'],
      ['spotlight_team', 'core', 'core'],
      ['spotlight_line', 'core_delivery', 'core/delivery'],
      ['spotlight_skill', 'core_grafana', 'core/grafana'],
      ['spotlight_integration', 'core_linear', 'core/linear'],
      ['spotlight_harness_profile', 'core_careful', 'core/careful'],
    ]) {
      expect(main).toContain(
        `import {\n  to = ${type}.${name}\n  id = "${WORKSPACE_ID}/${address}"\n}\n\nresource "${type}" "${name}" {\n`,
      );
    }
  });

  it('refers to the team and the workspace rather than naming their ids', () => {
    const main = mainOf(HELD);

    expect(main).toContain(
      'resource "spotlight_team" "core" {\n  workspace_id = spotlight_workspace.acme.id\n  key          = "core"\n  name         = "Core"\n}\n',
    );
    expect(main).toContain(LINE_RESOURCE);
  });

  it('keeps each prompt in its own file byte for byte, read with file()', () => {
    expect(fileOf(HELD, 'prompts/core/delivery/implementation.md')).toBe(
      'Implement the task.\n\n',
    );
  });

  it('keeps each skill file as it is, read with file()', () => {
    expect(mainOf(HELD)).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      '  files = {\n    "SKILL.md"               = file("${path.module}/skills/core/grafana/SKILL.md")\n    "queries/latency.promql" = file("${path.module}/skills/core/grafana/queries/latency.promql")\n  }\n',
    );
    expect(fileOf(HELD, 'skills/core/grafana/queries/latency.promql')).toBe(
      'histogram_quantile(0.99, rate(x[5m]))',
    );
  });

  it('writes an integration as its definition, keeping its expressions from Terraform', () => {
    const main = mainOf(HELD);

    expect(main).toContain(
      'resource "spotlight_integration" "core_linear" {\n  team_id = spotlight_team.core.id\n  definition = {\n    actions = {\n',
    );
    expect(main).toContain('query = "$${{ inputs.body }}"');
    expect(main).toContain(
      '        description = <<EOT\nComment on the issue.\nUse it to say what you did.\nEOT\n        does        = "comment"\n',
    );
  });

  it('refers to the secrets an integration wears, and leaves a secret it does not hold as written', () => {
    const main = mainOf(HELD);

    expect(main).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      'secrets = ["secret.${spotlight_secret.linear_api_key.name}", "secret.ELSEWHERE"]',
    );
    expect(main).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      'secret = "secret.${spotlight_secret.linear_signing.name}"',
    );
  });

  it('writes a secret without its value, reading it from a sensitive variable', () => {
    expect(mainOf(HELD)).toContain(
      [
        'resource "spotlight_secret" "linear_api_key" {',
        '  workspace_id = spotlight_workspace.acme.id',
        '  name         = "LINEAR_API_KEY"',
        '  source = {',
        '    kind = "built-in"',
        '  }',
        '  bindings = [',
        '    {',
        '      header = "authorization"',
        '      host   = "api.linear.app"',
        '      prefix = "Bearer "',
        '    },',
        '  ]',
        '  value_wo         = var.secret_linear_api_key',
        '  value_wo_version = 3',
        '}',
      ].join('\n'),
    );
    expect(fileOf(HELD, 'variables.tf')).toContain(
      [
        'variable "secret_linear_api_key" {',
        '  description = "The value of the secret LINEAR_API_KEY, which Spotlight keeps and never answers"',
        '  type        = string',
        '  sensitive   = true',
        '}',
      ].join('\n'),
    );
  });

  it('asks no value of a secret read from elsewhere', () => {
    const main = mainOf(HELD);
    const signing = main.slice(
      main.indexOf('resource "spotlight_secret" "linear_signing"'),
    );

    expect(signing.slice(0, signing.indexOf('\n}\n'))).not.toContain(
      'value_wo',
    );
    expect(fileOf(HELD, 'variables.tf')).not.toContain('secret_linear_signing');
  });

  it('writes a runner with its token read from an optional sensitive variable', () => {
    expect(mainOf(HELD)).toContain(
      'resource "spotlight_runner" "build-1" {\n  workspace_id = spotlight_workspace.acme.id\n  name         = "build-1"\n  labels       = ["vpc-internal"]\n  token        = var.runner_build-1_token\n}\n',
    );
    expect(fileOf(HELD, 'variables.tf')).toContain(
      'variable "runner_build-1_token" {\n  description = "The token the runner build-1 calls with; left null, Spotlight issues one when it creates the runner"\n  type        = string\n  sensitive   = true\n  default     = null\n}\n',
    );
  });

  it('writes a runner trust and refers to what the workspace declares', () => {
    const main = mainOf(HELD);

    expect(main).toContain(
      'resource "spotlight_runner_trust" "production-cluster" {\n  workspace_id = spotlight_workspace.acme.id\n  key          = "production-cluster"\n',
    );
    expect(main).toContain(
      'resource "spotlight_workspace_runners" "acme" {\n  workspace_id = spotlight_workspace.acme.id\n  runners      = [spotlight_runner.build-1.name, "gone-1"]\n  trusts       = [spotlight_runner_trust.production-cluster.key]\n}\n',
    );
  });

  it('writes a harness profile as its settings, its MCP servers’ env as it is', () => {
    expect(mainOf(HELD)).toContain(
      [
        'resource "spotlight_harness_profile" "core_careful" {',
        '  team_id = spotlight_team.core.id',
        '  key     = "careful"',
        '  permissions = {',
        '    allow = ["read", "execute(npm test *)"]',
        '    ask   = []',
        '    deny  = ["read(.env)"]',
        '  }',
        '  mcp_servers = [',
        '    {',
        '      args    = ["-y", "linear-mcp"]',
        '      command = "npx"',
        '      env = {',
        '        LINEAR_WORKSPACE = "acme"',
        '        "log.level"      = "debug"',
        '      }',
        '      name = "linear"',
        '    },',
        '  ]',
        '  native = {',
        '    claude-code = {',
        '      includeCoAuthoredBy = false',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('names a resource whose key starts with a digit so Terraform accepts it', () => {
    expect(mainOf(HELD)).toContain('resource "spotlight_team" "_3d" {');
  });

  it('writes what the workspace holds first, then each team in key order with what it holds', () => {
    const main = mainOf(HELD);
    const at = (header: string): number => main.indexOf(`resource ${header} {`);
    const headers = [
      '"spotlight_workspace" "acme"',
      '"spotlight_secret" "linear_api_key"',
      '"spotlight_secret" "linear_signing"',
      '"spotlight_runner" "build-1"',
      '"spotlight_runner_trust" "production-cluster"',
      '"spotlight_workspace_runners" "acme"',
      '"spotlight_team" "_3d"',
      '"spotlight_team" "core"',
      '"spotlight_line" "core_delivery"',
      '"spotlight_skill" "core_grafana"',
      '"spotlight_integration" "core_linear"',
      '"spotlight_harness_profile" "core_careful"',
    ];

    expect(headers.map(at).every((each) => each >= 0)).toBe(true);
    expect([...headers].sort((one, other) => at(one) - at(other))).toEqual(
      headers,
    );
  });

  it('writes the same files however the resources were held', () => {
    const reversed: HeldConfigurationDto = {
      ...HELD,
      resources: [...HELD.resources].reverse(),
    };

    expect(workspaceTerraform(reversed)).toEqual(workspaceTerraform(HELD));
  });

  it('writes the same files however the definitions were ordered', () => {
    const reordered: HeldConfigurationDto = {
      ...HELD,
      resources: HELD.resources.map((each) =>
        each.kind === 'integration'
          ? {
              ...each,
              definition: Object.fromEntries(
                Object.entries(each.definition).reverse(),
              ),
            }
          : each,
      ),
    };

    expect(workspaceTerraform(reordered)).toEqual(workspaceTerraform(HELD));
  });
});

describe('resourceHcl', () => {
  it('writes one resource after the import block that adopts it, referring to its neighbours', () => {
    expect(resourceHcl(HELD, heldAs('line')).hcl).toBe(
      `import {\n  to = spotlight_line.core_delivery\n  id = "${WORKSPACE_ID}/core/delivery"\n}\n\n${LINE_RESOURCE}`,
    );
  });

  it('hands over only the files that resource reads', () => {
    expect(resourceHcl(HELD, heldAs('line')).files).toEqual([
      {
        path: 'prompts/core/delivery/implementation.md',
        content: 'Implement the task.\n\n',
      },
    ]);
  });

  it('writes a secret after the variable its value is read from', () => {
    expect(resourceHcl(HELD, heldAs('secret')).hcl).toMatch(
      /^variable "secret_linear_api_key" {\n[\s\S]*\n}\n\nimport {\n {2}to = spotlight_secret\.linear_api_key\n/,
    );
  });
});

describe.skipIf(!TERRAFORM_INSTALLED)('checked by terraform', () => {
  it.each(['main.tf', 'variables.tf'])(
    'writes %s already formatted as terraform fmt would',
    (path) => {
      expect(formattedByTerraform(fileOf(HELD, path))).toBe(fileOf(HELD, path));
    },
  );

  it('writes each resource already formatted as terraform fmt would', () => {
    for (const each of HELD.resources) {
      const { hcl } = resourceHcl(HELD, each);

      expect(formattedByTerraform(hcl)).toBe(hcl);
    }
  });
});
