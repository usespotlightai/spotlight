import type {
  HeldConfigurationDto,
  HeldResourceDto,
} from '@configuration/application/dto/held-configuration.dto';
import {
  HELD,
  heldAs,
  WORKSPACE_ID,
} from '@configuration/presentation/terraform/held-configuration.fake-spec';
import {
  resourceHcl,
  workspaceTerraform,
} from '@configuration/presentation/terraform/terraform-configuration';
import { blockOf } from '@platform/hcl/hcl-block.fake-spec';
import {
  formattedByTerraform,
  TERRAFORM_INSTALLED,
} from '@platform/hcl/terraform-cli.fake-spec';
import { describe, expect, it } from 'vitest';

type HeldBy<K extends HeldResourceDto['kind']> = Extract<
  HeldResourceDto,
  { kind: K }
>;

const fileOf = (configuration: HeldConfigurationDto, path: string): string =>
  workspaceTerraform(configuration).find((each) => each.path === path)
    ?.content ?? '';

const mainOf = (configuration: HeldConfigurationDto): string =>
  fileOf(configuration, 'main.tf');

const LINE_RESOURCE = `resource "spotlight_line" "core_delivery" {
  team_id = spotlight_team.core.id
  key     = "delivery"
  name    = "Delivery"
  role    = "delivery"
  runners = ["build-1", "vpc-internal"]

  repository {
    name  = "acme/api"
    image = "ghcr.io/acme/api:main"
    setup = "npm ci"
  }

  station {
    key       = "backlog"
    name      = "Backlog"
    kind      = "backlog"
    color     = "#a3a8b0"
    diffs     = false
    decisions = false
    memories  = false
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
    runners   = ["gpu"]
    diffs     = true
    decisions = true
    memories  = false
    tools     = ["\${spotlight_integration.core_linear.source}.comment", "github.comment", "catalog.web-search@1.1.0"]
    skills    = [spotlight_skill.core_grafana.key, "catalog.research@1.0.0"]
    passes_to = []
    ends      = true
  }

  station {
    key       = "completed"
    name      = "Completed"
    kind      = "completed"
    color     = "#3fb950"
    diffs     = false
    decisions = false
    memories  = false
    tools     = []
    skills    = []
    passes_to = []
    ends      = false
  }

  reaction {
    happening = "github.checks.failed"
    from      = "implementation"
    to        = "implementation"
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
        (each) =>
          each.kind !== 'runner-pool' &&
          each.kind !== 'secret' &&
          each.kind !== 'hook',
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
      ['spotlight_workspace_token_trust', 'github-main', 'github-main'],
      ['spotlight_runner_trust', 'production-cluster', 'production-cluster'],
      ['spotlight_runner_pool', 'burst', 'burst'],
      ['spotlight_runner_pool', 'k8s-jobs', 'k8s-jobs'],
      ['spotlight_workspace_runners', 'acme', 'acme'],
      ['spotlight_team', 'core', 'core'],
      ['spotlight_line', 'core_delivery', 'core/delivery'],
      ['spotlight_line', 'core_review', 'core/review'],
      ['spotlight_skill', 'core_grafana', 'core/grafana'],
      ['spotlight_integration', 'core_linear', 'core/linear'],
      ['spotlight_hook', 'core_linear-comments', 'core/linear-comments'],
      ['spotlight_hook', 'core_merged', 'core/merged'],
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
      'secret    = "secret.${spotlight_secret.linear_signing.name}"',
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

  it('writes no value version for a secret that holds none, as the API answers it', () => {
    expect(
      blockOf(mainOf(HELD), 'resource "spotlight_secret" "sentry_token"'),
    ).toMatch(/\n {2}value_wo = var\.secret_sentry_token\n}$/);
    expect(fileOf(HELD, 'variables.tf')).toContain(
      'variable "secret_sentry_token" {',
    );
  });

  it('writes exactly the value version each secret holds, so importing it plans no rotation', () => {
    const main = mainOf(HELD);

    for (const each of HELD.resources) {
      if (each.kind !== 'secret') {
        continue;
      }

      const version = blockOf(
        main,
        `resource "spotlight_secret" "${each.name.toLowerCase()}"`,
      ).match(/\n {2}value_wo_version = (\d+)/)?.[1];

      expect(version === undefined ? null : Number(version)).toBe(
        each.valueVersion,
      );
    }
  });

  it('asks no value of a secret read from elsewhere', () => {
    expect(
      blockOf(mainOf(HELD), 'resource "spotlight_secret" "linear_signing"'),
    ).not.toContain('value_wo');
    expect(fileOf(HELD, 'variables.tf')).not.toContain('secret_linear_signing');
  });

  it('writes the runners a line and a station ask for as the labels they are, never as references', () => {
    const line = resourceHcl(HELD, heldAs('line', 'core/delivery')).hcl;

    expect(line).toContain('  runners = ["build-1", "vpc-internal"]\n');
    expect(line).toContain('    runners   = ["gpu"]\n');
    expect(mainOf(HELD)).not.toContain('spotlight_runner.');
    expect(fileOf(HELD, 'variables.tf')).not.toMatch(/variable "runner_[^p]/);
  });

  it('writes a token trust with its claims only when it names any', () => {
    const main = mainOf(HELD);

    expect(main).toContain(
      [
        'resource "spotlight_workspace_token_trust" "github-main" {',
        '  workspace_id = spotlight_workspace.acme.id',
        '  key          = "github-main"',
        '  issuer       = "https://token.actions.githubusercontent.com"',
        '  audience     = "spotlight"',
        '  subject      = "repo:acme/platform:ref:refs/heads/main"',
        '  claims = {',
        '    repository = "acme/platform"',
        '  }',
        '  scopes           = ["configure", "secrets"]',
        '  lifetime_minutes = 15',
        '}',
      ].join('\n'),
    );
    expect(main).toContain(
      [
        '  subject          = "repo:acme/platform:pull_request"',
        '  scopes           = ["plan"]',
        '  lifetime_minutes = 10',
        '}',
      ].join('\n'),
    );
  });

  it('writes a runner trust and refers to what the workspace declares', () => {
    const main = mainOf(HELD);

    expect(main).toContain(
      'resource "spotlight_runner_trust" "production-cluster" {\n  workspace_id = spotlight_workspace.acme.id\n  key          = "production-cluster"\n',
    );
    expect(main).toContain(
      'resource "spotlight_workspace_runners" "acme" {\n  workspace_id = spotlight_workspace.acme.id\n  trusts       = [spotlight_runner_trust.production-cluster.key]\n',
    );
  });

  it('writes a pool that pulls with its token read from an optional sensitive variable', () => {
    expect(mainOf(HELD)).toContain(
      [
        'resource "spotlight_runner_pool" "burst" {',
        '  workspace_id  = spotlight_workspace.acme.id',
        '  key           = "burst"',
        '  labels        = ["gpu"]',
        '  max_runs      = 4',
        '  token         = var.runner_pool_burst_token',
        '  token_version = 2',
        '}',
      ].join('\n'),
    );
    expect(fileOf(HELD, 'variables.tf')).toContain(
      'variable "runner_pool_burst_token" {\n  description = "The token the runner pool burst claims with; left null, Spotlight issues one when it creates the pool"\n  type        = string\n  sensitive   = true\n  default     = null\n}\n',
    );
  });

  it('writes a pool that is pushed to with where it is called and its signing secret read from a variable', () => {
    const pool = blockOf(
      mainOf(HELD),
      'resource "spotlight_runner_pool" "k8s-jobs"',
    );

    expect(pool).toBe(
      [
        'resource "spotlight_runner_pool" "k8s-jobs" {',
        '  workspace_id = spotlight_workspace.acme.id',
        '  key          = "k8s-jobs"',
        '  labels       = []',
        '  provision = {',
        '    url            = "https://provisioner.acme.dev/runs"',
        '    secret         = var.runner_pool_k8s-jobs_provision_secret',
        '    secret_version = 1',
        '  }',
        '}',
      ].join('\n'),
    );
    expect(fileOf(HELD, 'variables.tf')).toContain(
      'variable "runner_pool_k8s-jobs_provision_secret" {\n  description = "The secret the runner pool k8s-jobs signs its provision calls with, as whsec_ and base64 bytes"\n  type        = string\n  sensitive   = true\n}\n',
    );
    expect(fileOf(HELD, 'variables.tf')).not.toContain(
      'runner_pool_k8s-jobs_token',
    );
  });

  it('writes no limit, token version or secret version a pool does not hold', () => {
    const configuration: HeldConfigurationDto = {
      ...HELD,
      resources: HELD.resources.map((each) =>
        each.kind === 'runner-pool'
          ? {
              ...each,
              maxRuns: null,
              tokenVersion: null,
              provision: each.provision
                ? { ...each.provision, secretVersion: null }
                : null,
            }
          : each,
      ),
    };
    const main = mainOf(configuration);

    expect(
      blockOf(main, 'resource "spotlight_runner_pool" "burst"'),
    ).not.toMatch(/max_runs|token_version/);
    expect(
      blockOf(main, 'resource "spotlight_runner_pool" "k8s-jobs"'),
    ).not.toContain('secret_version');
  });

  it('refers to the pools the workspace declares, and leaves a pool it does not hold as written', () => {
    expect(
      blockOf(mainOf(HELD), 'resource "spotlight_workspace_runners" "acme"'),
    ).toContain(
      '  pools        = [spotlight_runner_pool.burst.key, spotlight_runner_pool.k8s-jobs.key, "retired"]\n',
    );
  });

  it('writes a harness profile as its settings, its MCP servers’ env as it is but for the secrets it wears, which refer to them', () => {
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
        // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
        '        LINEAR_API_KEY   = "secret.${spotlight_secret.linear_signing.name}"',
        '        LINEAR_WORKSPACE = "acme"',
        '        LOG_LEVEL        = "debug"',
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

  it('writes the review policy of the line whose role reviews pull requests', () => {
    expect(resourceHcl(HELD, heldAs('line', 'core/review')).hcl).toContain(
      [
        '  reviews {',
        '    start   = "opened"',
        '    mention = "@spotlight"',
        '',
        '    skip {',
        '      spotlight = true',
        '      drafts    = true',
        '      authors   = ["dependabot[bot]", "renovate[bot]"]',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );
    expect(LINE_RESOURCE).not.toContain('reviews');
  });

  it('writes a hook with its match, condition, vars, signing and steps, keeping its expressions from Terraform', () => {
    expect(
      blockOf(mainOf(HELD), 'resource "spotlight_hook" "core_linear-comments"'),
    ).toBe(
      [
        'resource "spotlight_hook" "core_linear-comments" {',
        '  team_id = spotlight_team.core.id',
        '  key     = "linear-comments"',
        '  on      = "tool.using"',
        '  match = {',
        '    tools    = [spotlight_integration.core_linear.tools["comment"]]',
        '    stations = ["implementation"]',
        '  }',
        '  when = "event.inputs.body != \'\'"',
        '  vars = {',
        '    channel = "C024BE91L"',
        '  }',
        '  signing = {',
        '    secret_wo         = var.hook_core_linear-comments_signing_secret',
        '    secret_wo_version = 2',
        '  }',
        '  failure         = "block"',
        '  timeout_seconds = 20',
        '  steps = [',
        '    {',

        '      name = "notify"',
        '      call = spotlight_integration.core_linear.tools["comment"]',
        '      with = {',
        '        body = "Agent commented: $${{ event.inputs.body }}"',
        '      }',
        '    },',
        '    {',

        '      name = "audit"',
        '      request = {',
        '        url = "https://audit.acme.dev/events"',
        '        headers = {',
        '          x-team = "core"',
        '        }',
        '        body = {',
        '          tool = "$${{ event.tool }}"',
        '        }',
        '        from = "network"',
        '      }',
        '    },',
        '  ]',
        '}',
      ].join('\n'),
    );
  });

  it('writes no match, condition, vars, signing, failure or timeout the hook was not written with', () => {
    expect(
      blockOf(mainOf(HELD), 'resource "spotlight_hook" "core_merged"'),
    ).toBe(
      [
        'resource "spotlight_hook" "core_merged" {',
        '  team_id = spotlight_team.core.id',
        '  key     = "merged"',
        '  on      = "pull-request.merged"',
        '  steps = [',
        '    {',

        '      name = "tell"',
        '      call = spotlight_integration.core_linear.tools["comment"]',
        '      with = {',
        '        body = "A pull request merged"',
        '      }',
        '    },',
        '  ]',
        '}',
      ].join('\n'),
    );
  });

  it('writes a failure and timeout the hook was written with, even where they say what it would do anyway', () => {
    const hook: HeldBy<'hook'> = {
      ...heldAs('hook', 'core/merged'),
      failure: 'continue',
      timeoutSeconds: 10,
    };

    expect(resourceHcl(HELD, hook).hcl).toContain(
      ['  failure         = "continue"', '  timeout_seconds = 10'].join('\n'),
    );
  });

  it('writes a hook signed with OIDC by its audience, and a request by its url alone when it holds only defaults', () => {
    const hook: HeldBy<'hook'> = {
      ...heldAs('hook', 'core/merged'),
      steps: [
        {
          name: 'review',
          request: {
            url: 'https://dba.acme.dev/review',
            headers: {},
            body: undefined,
            from: 'spotlight',
          },
        },
        { name: 'tell', call: 'linear.comment', with: {} },
      ],
      signing: { oidc: { audience: 'https://dba.acme.dev' } },
    };
    const { hcl } = resourceHcl(HELD, hook);

    expect(hcl).toContain(
      [
        '  signing = {',
        '    oidc = {',
        '      audience = "https://dba.acme.dev"',
        '    }',
        '  }',
        '  steps = [',
        '    {',

        '      name = "review"',
        '      request = {',
        '        url = "https://dba.acme.dev/review"',
        '      }',
        '    },',
        '    {',

        '      name = "tell"',
        '      call = spotlight_integration.core_linear.tools["comment"]',
        '    },',
        '  ]',
        '}',
      ].join('\n'),
    );
    expect(hcl).not.toContain('variable');
  });

  it('reads the secret a hook signs with from a sensitive variable, and asks none of a hook that does not sign', () => {
    const variables = fileOf(HELD, 'variables.tf');

    expect(variables).toContain(
      'variable "hook_core_linear-comments_signing_secret" {\n  description = "The secret the hook core/linear-comments signs its requests with, as whsec_ and base64 bytes"\n  type        = string\n  sensitive   = true\n}\n',
    );
    expect(variables).not.toContain('hook_core_merged');
  });

  it('writes the tools a hook matches and calls as written when no integration exported beside it offers them', () => {
    const configuration: HeldConfigurationDto = {
      ...HELD,
      resources: HELD.resources.filter((each) => each.kind !== 'integration'),
    };
    const { hcl } = resourceHcl(
      configuration,
      heldAs('hook', 'core/linear-comments'),
    );

    expect(hcl).toContain('    tools    = ["linear.comment"]\n');
    expect(hcl).toContain('    call = "linear.comment"\n');
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
      '"spotlight_secret" "sentry_token"',
      '"spotlight_workspace_token_trust" "github-main"',
      '"spotlight_workspace_token_trust" "github-pull-requests"',
      '"spotlight_runner_trust" "production-cluster"',
      '"spotlight_runner_pool" "burst"',
      '"spotlight_runner_pool" "k8s-jobs"',
      '"spotlight_workspace_runners" "acme"',
      '"spotlight_team" "_3d"',
      '"spotlight_team" "core"',
      '"spotlight_line" "core_delivery"',
      '"spotlight_line" "core_review"',
      '"spotlight_skill" "core_grafana"',
      '"spotlight_integration" "core_linear"',
      '"spotlight_hook" "core_linear-comments"',
      '"spotlight_hook" "core_merged"',
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

  it('writes a pool after the variable its token is read from', () => {
    expect(resourceHcl(HELD, heldAs('runner-pool', 'burst')).hcl).toMatch(
      /^variable "runner_pool_burst_token" {\n[\s\S]*\n}\n\nimport {\n {2}to = spotlight_runner_pool\.burst\n/,
    );
  });

  it('writes a hook after the variable its signing secret is read from', () => {
    expect(
      resourceHcl(HELD, heldAs('hook', 'core/linear-comments')).hcl,
    ).toMatch(
      /^variable "hook_core_linear-comments_signing_secret" {\n[\s\S]*\n}\n\nimport {\n {2}to = spotlight_hook\.core_linear-comments\n/,
    );
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
