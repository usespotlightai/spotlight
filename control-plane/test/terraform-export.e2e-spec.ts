import { randomUUID } from 'node:crypto';
import type { ExportableResourceDto } from '@configuration/application/dto/exportable-configuration.dto';
import { CONFIGURATION } from '@configuration/presentation/terraform/exportable-configuration.fake-spec';
import { workspaceTerraform } from '@configuration/presentation/terraform/terraform-configuration';
import type { INestApplication } from '@nestjs/common';
import { blockOf } from '@platform/hcl/hcl-block.fake-spec';
import {
  formattedByTerraform,
  TERRAFORM_INSTALLED,
} from '@platform/hcl/terraform-cli.fake-spec';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { eq, inArray } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { definitionOf } from './support/line-definition';
import { deleteRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const VALUE = 'lin_api_exported_never_7c1f';

const POOL_TOKEN = `pool${randomUUID().replaceAll('-', '')}`;

const EGRESS_TOKEN = `egress${randomUUID().replaceAll('-', '')}`;

const PROVISION_SECRET = `whsec_${Buffer.from('s'.repeat(32)).toString('base64')}`;

const HOOK_SECRET = `whsec_${Buffer.from('h'.repeat(32)).toString('base64')}`;

const BUILT_IN = definitionOf(BUILT_IN_LINES[0] as LineOpening);

const PROMPTED = BUILT_IN.stations.find(
  (station) => station.prompt !== undefined,
);

const RUBRIC = 'A good run changes only what the task asks for.\n\n';

const DELIVERY = {
  ...BUILT_IN,
  repositories: [
    { name: 'acme/api', image: 'ghcr.io/acme/api:main', setup: 'npm ci' },
  ],
  runners: ['build-1', 'vpc-internal'],
  stations: BUILT_IN.stations.map((station) =>
    station.key === PROMPTED?.key
      ? {
          ...station,
          harness: 'claude-code',
          profile: 'careful',
          skills: ['grafana'],
          tools: ['linear.comment'],
          judge: { rubric: RUBRIC, sample: 0.2, trust: 0.6 },
          alerts: [
            { measure: 'sent_back_rate', risesBy: 0.2, over: 20 },
            { measure: 'cost_per_run', above: 5, over: 10 },
            { measure: 'accepted_rate', fallsBy: 0.1, over: 20 },
            { measure: 'merged_rate', below: 0.4, over: 20 },
          ],
        }
      : station,
  ),
};

const GRAFANA = {
  key: 'grafana',
  files: {
    'SKILL.md':
      '---\nname: grafana\ndescription: Look up dashboards\n---\nSearch before you guess.\n',
    'queries/latency.promql': 'histogram_quantile(0.99, rate(x[5m]))',
  },
};

const LINEAR = {
  integration: 'linear',
  name: 'Linear',
  actions: {
    comment: {
      request: {
        method: 'POST',
        url: 'https://api.linear.app/graphql',
        headers: { 'Content-Type': 'application/json' },
        auth: { secrets: ['secret.LINEAR_API_KEY'] },
      },
    },
  },
  tools: {
    comment: {
      description: 'Comment on an issue.\nSay what you did.\n',
      does: 'comment',
    },
  },
};

const CAREFUL = {
  key: 'careful',
  permissions: { allow: ['read'], ask: [], deny: ['read(.env)'] },
  mcpServers: [
    {
      name: 'linear',
      command: 'npx',
      args: ['-y', 'linear-mcp'],
      env: { LINEAR_TEAM: 'core' },
    },
  ],
};

const AUDIT = {
  key: 'audit',
  on: 'tool.used',
  match: { tools: ['linear.comment'] },
  steps: [
    {
      name: 'record',
      request: {
        url: 'https://127.0.0.1/events',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: a hook expression
        body: { tool: '${{ event.tool }}' },
      },
    },
  ],
  signing: { secret: HOOK_SECRET, secretVersion: 1 },
};

interface Written {
  readonly path: string;
  readonly content: string;
}

describe('a workspace exported as Terraform (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let seat: Awaited<ReturnType<typeof seatTeam>>;
  const made: Record<string, string> = {};

  const http = () => served(app);

  const as = (user: string) => ({
    get: (path: string) => http().get(path).set(TEST_USER_HEADER, user),
    put: (path: string, version: number, body: object) =>
      http()
        .put(path)
        .set(TEST_USER_HEADER, user)
        .set('If-Match', `"${version}"`)
        .send(body),
    post: (path: string, body: object) =>
      http()
        .post(path)
        .set(TEST_USER_HEADER, user)
        .set('Idempotency-Key', randomUUID())
        .send(body),
  });

  const exported = async (): Promise<readonly Written[]> => {
    const answered = await as(seat.owner).get(
      `/api/resources/workspaces/${workspaceId}/export`,
    );

    expect(answered.status).toBe(200);

    return answered.body.files;
  };

  const fileOf = (files: readonly Written[], path: string): string =>
    files.find((each) => each.path === path)?.content ?? '';

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspaceId = `export-${randomUUID().slice(0, 8)}`;
    seat = await seatTeam(db, workspaceId);

    for (const [kind, collection, body] of [
      [
        'secret',
        `workspaces/${workspaceId}/secrets`,
        {
          name: 'LINEAR_API_KEY',
          bindings: [{ host: 'api.linear.app', prefix: 'Bearer ' }],
          valueWo: VALUE,
          valueWoVersion: 1,
        },
      ],
      [
        'runner-trust',
        `workspaces/${workspaceId}/runner-trusts`,
        {
          key: 'production',
          issuer: 'https://oidc.example.com/cluster',
          subject: 'system:serviceaccount:spotlight:runner',
        },
      ],
      [
        'runner-pool',
        `workspaces/${workspaceId}/runner-pools`,
        {
          key: 'ephemeral',
          labels: ['linux'],
          token: POOL_TOKEN,
          tokenVersion: 1,
        },
      ],
      [
        'workspace-runners',
        `workspaces/${workspaceId}/workspace-runners`,
        { trusts: ['production'], pools: ['ephemeral'] },
      ],
      ['skill', `teams/${workspaceId}/skills`, GRAFANA],
      ['integration', `teams/${workspaceId}/integrations`, LINEAR],
      ['hook', `teams/${workspaceId}/hooks`, AUDIT],
      ['harness-profile', `teams/${workspaceId}/harness-profiles`, CAREFUL],
      ['line', `teams/${workspaceId}/lines`, DELIVERY],
    ] as const) {
      const created = await as(seat.owner).post(
        `/api/resources/${collection}`,
        body,
      );

      expect(created.status, `${kind}: ${JSON.stringify(created.body)}`).toBe(
        201,
      );
      made[kind] = created.body.id;
    }
  });

  afterEach(async () => {
    await db
      .delete(schema.hookDefinition)
      .where(eq(schema.hookDefinition.teamId, workspaceId));
    await db
      .delete(schema.integrationDefinition)
      .where(eq(schema.integrationDefinition.teamId, workspaceId));
    await db
      .delete(schema.secret)
      .where(eq(schema.secret.workspaceId, workspaceId));
    await db
      .delete(schema.secretDataKey)
      .where(eq(schema.secretDataKey.workspaceId, workspaceId));
    await db
      .delete(schema.workspaceToken)
      .where(eq(schema.workspaceToken.workspaceId, workspaceId));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId));
    await db
      .delete(schema.idempotentCreate)
      .where(
        inArray(schema.idempotentCreate.scope, [
          `person:${seat.owner}`,
          `person:${seat.member}`,
        ]),
      );
    await deleteRunnersOf(db, workspaceId);
    await seat.unseat();
  });

  it('writes main.tf, variables.tf and the files main.tf reads, importing everything the workspace has', async () => {
    const files = await exported();
    const main = fileOf(files, 'main.tf');

    expect(files.map((each) => each.path)).toEqual(
      [...files.map((each) => each.path)].sort(),
    );
    expect(files.map((each) => each.path)).toEqual(
      expect.arrayContaining([
        'main.tf',
        'variables.tf',
        'skills/team/grafana/SKILL.md',
        'skills/team/grafana/queries/latency.promql',
        ...DELIVERY.stations
          .filter((station) => station.prompt !== undefined)
          .map((station) => `prompts/team/delivery/${station.key}.md`),
        `judges/team/delivery/${PROMPTED?.key}.md`,
      ]),
    );

    for (const [type, name, id] of [
      ['spotlight_workspace', workspaceId, workspaceId],
      ['spotlight_secret', 'linear_api_key', `${workspaceId}/LINEAR_API_KEY`],
      ['spotlight_runner_trust', 'production', `${workspaceId}/production`],
      ['spotlight_runner_pool', 'ephemeral', `${workspaceId}/ephemeral`],
      [
        'spotlight_workspace_runners',
        workspaceId,
        `${workspaceId}/${workspaceId}`,
      ],
      ['spotlight_team', 'team', `${workspaceId}/team`],
      ['spotlight_line', 'team_delivery', `${workspaceId}/team/delivery`],
      ['spotlight_skill', 'team_grafana', `${workspaceId}/team/grafana`],
      ['spotlight_integration', 'team_linear', `${workspaceId}/team/linear`],
      ['spotlight_hook', 'team_audit', `${workspaceId}/team/audit`],
      [
        'spotlight_harness_profile',
        'team_careful',
        `${workspaceId}/team/careful`,
      ],
    ]) {
      expect(main).toContain(
        `import {\n  to = ${type}.${name}\n  id = "${id}"\n}\n\nresource "${type}" "${name}" {\n`,
      );
    }
  });

  it('refers to what each resource names, so a first apply creates them in order', async () => {
    const main = fileOf(await exported(), 'main.tf');

    for (const reference of [
      `workspace_id = spotlight_workspace.${workspaceId}.id`,
      'team_id = spotlight_team.team.id',
      'skills    = [spotlight_skill.team_grafana.key]',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      'tools     = ["${spotlight_integration.team_linear.source}.comment"]',
      'profile   = spotlight_harness_profile.team_careful.key',
      'runners = ["build-1", "vpc-internal"]',
      '  repository {\n    name  = "acme/api"\n    image = "ghcr.io/acme/api:main"\n    setup = "npm ci"\n  }\n',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      'secrets = ["secret.${spotlight_secret.linear_api_key.name}"]',
      'trusts       = [spotlight_runner_trust.production.key]',
      'pools        = [spotlight_runner_pool.ephemeral.key]',
    ]) {
      expect(main).toContain(reference);
    }
  });

  it('writes a hook referring to the integration whose tool it matches, its signing secret read from a variable', async () => {
    const files = await exported();

    expect(
      blockOf(
        fileOf(files, 'main.tf'),
        'resource "spotlight_hook" "team_audit"',
      ),
    ).toBe(
      [
        'resource "spotlight_hook" "team_audit" {',
        '  team_id = spotlight_team.team.id',
        '  key     = "audit"',
        '  on      = "tool.used"',
        '  match = {',
        '    tools = [spotlight_integration.team_linear.tools["comment"]]',
        '  }',
        '  signing = {',
        '    secret_wo         = var.hook_team_audit_signing_secret',
        '    secret_wo_version = 1',
        '  }',
        '  steps = [',
        '    {',
        '      name = "record"',
        '      request = {',
        '        url = "https://127.0.0.1/events"',
        '        body = {',
        '          tool = "$${{ event.tool }}"',
        '        }',
        '      }',
        '    },',
        '  ]',
        '}',
      ].join('\n'),
    );
    expect(fileOf(files, 'variables.tf')).toContain(
      'variable "hook_team_audit_signing_secret" {',
    );

    for (const file of files) {
      expect(file.content).not.toContain(HOOK_SECRET);
    }
  });

  it('never writes a secret value or a pool token, asking for them as sensitive variables', async () => {
    const files = await exported();
    const main = fileOf(files, 'main.tf');
    const variables = fileOf(files, 'variables.tf');

    for (const file of files) {
      expect(file.content).not.toContain(VALUE);
      expect(file.content).not.toContain(POOL_TOKEN);
    }
    expect(main).toContain(
      '  value_wo         = var.secret_linear_api_key\n  value_wo_version = 1\n',
    );
    expect(variables).toContain(
      'variable "secret_linear_api_key" {\n  description = "The value of the secret LINEAR_API_KEY, which Spotlight keeps and never answers"\n  type        = string\n  sensitive   = true\n}\n',
    );
    expect(
      blockOf(main, 'resource "spotlight_runner_pool" "ephemeral"'),
    ).toMatch(
      /\n {2}token +?= var\.runner_pool_ephemeral_token\n {2}token_version += 1\n/,
    );
    expect(variables).toContain('variable "runner_pool_ephemeral_token" {');
  });

  it('writes each secret’s value version exactly as the API answers it, so adopting one plans no rotation', async () => {
    const unversioned = await as(seat.owner).post(
      `/api/resources/workspaces/${workspaceId}/secrets`,
      {
        name: 'SENTRY_TOKEN',
        bindings: [{ host: 'sentry.io', prefix: 'Bearer ' }],
        valueWo: VALUE,
      },
    );

    expect(unversioned.status).toBe(201);

    const main = fileOf(await exported(), 'main.tf');

    for (const id of [made.secret, unversioned.body.id]) {
      const answered = await as(seat.owner).get(`/api/resources/secrets/${id}`);
      const block = blockOf(
        main,
        `resource "spotlight_secret" "${answered.body.name.toLowerCase()}"`,
      );

      expect(block).toMatch(/\n {2}value_wo += var\.secret_/);
      expect(block.match(/value_wo_version += (\d+)/)?.[1] ?? null).toBe(
        answered.body.valueWoVersion === null
          ? null
          : String(answered.body.valueWoVersion),
      );
    }
  });

  it('writes a station’s judge reading its rubric with file(), and its alerts in order', async () => {
    const main = fileOf(await exported(), 'main.tf');

    expect(main).toContain(
      `    judge {\n      rubric = file("\${path.module}/judges/team/delivery/${PROMPTED?.key}.md")\n      sample = 0.2\n      trust  = 0.6\n    }\n\n    alert {\n      measure  = "sent_back_rate"\n      rises_by = 0.2\n      over     = 20\n    }\n\n    alert {\n      measure = "cost_per_run"\n      above   = 5\n      over    = 10\n    }\n\n    alert {\n      measure  = "accepted_rate"\n      falls_by = 0.1\n      over     = 20\n    }\n\n    alert {\n      measure = "merged_rate"\n      below   = 0.4\n      over    = 20\n    }\n  }\n`,
    );
  });

  it('keeps each prompt, judge rubric and skill file byte for byte', async () => {
    const files = await exported();

    expect(fileOf(files, `judges/team/delivery/${PROMPTED?.key}.md`)).toBe(
      RUBRIC,
    );
    expect(fileOf(files, `prompts/team/delivery/${PROMPTED?.key}.md`)).toBe(
      PROMPTED?.prompt,
    );
    expect(fileOf(files, 'skills/team/grafana/SKILL.md')).toBe(
      GRAFANA.files['SKILL.md'],
    );
  });

  it('exports the same files again, even after each resource is written back as it reads', async () => {
    const before = await exported();

    for (const [collection, id] of [
      ['lines', made.line],
      ['skills', made.skill],
      ['integrations', made.integration],
    ]) {
      const read = await as(seat.owner).get(
        `/api/resources/${collection}/${id}`,
      );
      const body =
        collection === 'skills'
          ? { key: read.body.key, files: read.body.files }
          : read.body.definition;
      const written = await as(seat.owner).put(
        `/api/resources/${collection}/${id}`,
        read.body.version,
        body,
      );

      expect(written.status).toBe(200);
    }

    expect(await exported()).toEqual(before);
  });

  it('lets a token that may only read export the workspace', async () => {
    const issued = await as(seat.owner).post(
      `/api/resources/workspaces/${workspaceId}/tokens`,
      { name: 'survey', scopes: ['read'] },
    );
    const answered = await http()
      .get(`/api/resources/workspaces/${workspaceId}/export`)
      .set(
        'Authorization',
        `Bearer ${issued.headers['spotlight-workspace-token']}`,
      );

    expect(answered.status).toBe(200);
    expect(answered.body.files).toEqual(await exported());
  });

  it('answers each kind of resource as HCL, after the import block that adopts it', async () => {
    for (const [collection, id, type] of [
      ['workspaces', workspaceId, 'spotlight_workspace'],
      ['teams', workspaceId, 'spotlight_team'],
      ['lines', made.line, 'spotlight_line'],
      ['skills', made.skill, 'spotlight_skill'],
      ['integrations', made.integration, 'spotlight_integration'],
      ['hooks', made.hook, 'spotlight_hook'],
      [
        'harness-profiles',
        made['harness-profile'],
        'spotlight_harness_profile',
      ],
      ['secrets', made.secret, 'spotlight_secret'],
      ['runner-trusts', made['runner-trust'], 'spotlight_runner_trust'],
      ['runner-pools', made['runner-pool'], 'spotlight_runner_pool'],
      [
        'workspace-runners',
        made['workspace-runners'],
        'spotlight_workspace_runners',
      ],
    ]) {
      const answered = await as(seat.member).get(
        `/api/resources/${collection}/${id}/hcl`,
      );

      expect(answered.status, collection).toBe(200);
      expect(answered.body.hcl).toMatch(
        new RegExp(
          `import {\\n  to = ${type}\\.[^\\n]+\\n[\\s\\S]*\\nresource "${type}" `,
        ),
      );
    }
  });

  it('answers a skill as HCL with the files it reads', async () => {
    const answered = await as(seat.member).get(
      `/api/resources/skills/${made.skill}/hcl`,
    );

    expect(answered.body.files.map((each: Written) => each.path)).toEqual([
      'skills/team/grafana/SKILL.md',
      'skills/team/grafana/queries/latency.promql',
    ]);
  });

  it('shows nothing to someone outside the workspace', async () => {
    const stranger = randomUUID();

    expect(
      (
        await as(stranger).get(
          `/api/resources/workspaces/${workspaceId}/export`,
        )
      ).status,
    ).toBe(404);
    expect(
      (await as(stranger).get(`/api/resources/lines/${made.line}/hcl`)).status,
    ).toBe(404);
  });

  it('knows no collection it does not render', async () => {
    const answered = await as(seat.owner).get(
      `/api/resources/tokens/${workspaceId}/hcl`,
    );

    expect(answered.status).toBe(404);
    expect(answered.headers['content-type']).toContain(
      'application/problem+json',
    );
  });

  it.skipIf(!TERRAFORM_INSTALLED)(
    'writes main.tf and variables.tf already formatted as terraform fmt would',
    async () => {
      const files = await exported();

      for (const path of ['main.tf', 'variables.tf']) {
        const written = fileOf(files, path);

        expect(formattedByTerraform(written)).toBe(written);
      }
    },
  );
});

const bodyOf = (
  resource: ExportableResourceDto,
  egresses: ReadonlyMap<string, string> = new Map(),
): object => {
  switch (resource.kind) {
    case 'workspace':
      return { slug: resource.slug, name: resource.name };
    case 'team':
      return { key: resource.key, name: resource.name };
    case 'secret':
      return {
        name: resource.name,
        source: {
          kind: resource.source.kind,
          ...(resource.source.secretId
            ? { secretId: resource.source.secretId }
            : {}),
          ...(resource.source.field ? { field: resource.source.field } : {}),
        },
        bindings: resource.bindings,
        ...(resource.keepsValue ? { valueWo: VALUE } : {}),
        ...(resource.valueVersion === null
          ? {}
          : { valueWoVersion: resource.valueVersion }),
      };
    case 'workspace-token-trust':
      return {
        key: resource.key,
        issuer: resource.issuer,
        audience: resource.audience,
        subject: resource.subject,
        claims: resource.claims,
        scopes: resource.scopes,
        lifetimeMinutes: resource.lifetimeMinutes,
      };
    case 'runner-trust':
      return {
        key: resource.key,
        issuer: resource.issuer,
        subject: resource.subject,
        audience: resource.audience,
        labels: resource.labels,
      };
    case 'runner-pool':
      return {
        key: resource.key,
        labels: resource.labels,
        ...(resource.maxRuns === null ? {} : { maxRuns: resource.maxRuns }),
        ...(resource.provision
          ? {
              provision: {
                url: resource.provision.url,
                secret: PROVISION_SECRET,
                secretVersion: resource.provision.secretVersion,
                ...(resource.provision.egress
                  ? {
                      egress:
                        egresses.get(resource.provision.egress) ??
                        resource.provision.egress,
                    }
                  : {}),
                ...(resource.provision.egressTraffic === 'bound'
                  ? { egressTraffic: 'bound' }
                  : {}),
              },
            }
          : { token: POOL_TOKEN, tokenVersion: resource.tokenVersion }),
      };
    case 'egress':
      return {
        key: resource.key,
        url: resource.url,
        token: EGRESS_TOKEN,
        tokenVersion: resource.tokenVersion,
      };
    case 'workspace-runners':
      return { trusts: resource.trusts, pools: resource.pools };
    case 'line':
    case 'integration':
      return resource.definition;
    case 'skill':
      return { key: resource.key, files: resource.files };
    case 'hook':
      return {
        key: resource.key,
        on: resource.on,
        match: resource.match,
        ...(resource.when === null ? {} : { when: resource.when }),
        vars: resource.vars,
        steps: resource.steps,
        signing:
          resource.signing && 'secretVersion' in resource.signing
            ? {
                secret: HOOK_SECRET,
                secretVersion: resource.signing.secretVersion,
              }
            : resource.signing,
        ...(resource.failure === null ? {} : { failure: resource.failure }),
        ...(resource.timeoutSeconds === null
          ? {}
          : { timeoutSeconds: resource.timeoutSeconds }),
      };
    case 'harness-profile':
      return {
        key: resource.key,
        permissions: resource.permissions,
        mcpServers: resource.mcpServers,
        native: resource.native,
      };
  }
};

const COLLECTIONS: Readonly<
  Record<Exclude<ExportableResourceDto['kind'], 'workspace'>, string>
> = {
  secret: 'secrets',
  'workspace-token-trust': 'token-trusts',
  'runner-trust': 'runner-trusts',
  egress: 'egresses',
  'runner-pool': 'runner-pools',
  'workspace-runners': 'workspace-runners',
  team: 'teams',
  skill: 'skills',
  integration: 'integrations',
  hook: 'hooks',
  'harness-profile': 'harness-profiles',
  line: 'lines',
};

const CREATION_ORDER = Object.keys(COLLECTIONS);

describe('the configuration the export spec renders (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let seat: Awaited<ReturnType<typeof seatTeam>>;
  const teams = new Map<string, string>();

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspaceId = `fixture-${randomUUID().slice(0, 8)}`;
    seat = await seatTeam(db, workspaceId);
    teams.clear();
    await db.insert(schema.workspacePlan).values({ workspaceId, plan: 'team' });
  });

  afterEach(async () => {
    const teamIds = [workspaceId, ...teams.values()];

    await db
      .delete(schema.hookDefinition)
      .where(inArray(schema.hookDefinition.teamId, teamIds));
    await db
      .delete(schema.integrationDefinition)
      .where(inArray(schema.integrationDefinition.teamId, teamIds));
    await db.delete(schema.line).where(inArray(schema.line.teamId, teamIds));
    await db
      .delete(schema.skillDefinition)
      .where(inArray(schema.skillDefinition.teamId, teamIds));
    await db
      .delete(schema.harnessProfile)
      .where(inArray(schema.harnessProfile.teamId, teamIds));
    await db
      .delete(schema.secret)
      .where(eq(schema.secret.workspaceId, workspaceId));
    await db
      .delete(schema.secretDataKey)
      .where(eq(schema.secretDataKey.workspaceId, workspaceId));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId));
    await db
      .delete(schema.idempotentCreate)
      .where(eq(schema.idempotentCreate.scope, `person:${seat.owner}`));
    await db
      .delete(schema.workspacePlan)
      .where(eq(schema.workspacePlan.workspaceId, workspaceId));
    await db
      .delete(schema.workspaceTokenTrust)
      .where(eq(schema.workspaceTokenTrust.workspaceId, workspaceId));
    await deleteRunnersOf(db, workspaceId);
    await seat.unseat();
  });

  it('is configuration the API accepts, and exports exactly as the spec renders it', async () => {
    const creating = CONFIGURATION.resources
      .filter(
        (each): each is Exclude<ExportableResourceDto, { kind: 'workspace' }> =>
          each.kind !== 'workspace',
      )
      .sort(
        (one, other) =>
          CREATION_ORDER.indexOf(one.kind) - CREATION_ORDER.indexOf(other.kind),
      );

    const egresses = new Map<string, string>();

    for (const each of creating) {
      const owner =
        each.ownedBy === 'team'
          ? `teams/${teams.get(each.teamKey)}`
          : `workspaces/${workspaceId}`;
      const created = await served(app)
        .post(`/api/resources/${owner}/${COLLECTIONS[each.kind]}`)
        .set(TEST_USER_HEADER, seat.owner)
        .set('Idempotency-Key', randomUUID())
        .send(bodyOf(each, egresses));

      expect(
        created.status,
        `${each.kind} ${each.address}: ${JSON.stringify(created.body)}`,
      ).toBe(201);

      if (each.kind === 'team') {
        teams.set(each.key, created.body.id);
      }

      if (each.kind === 'egress') {
        egresses.set(each.id, created.body.id);
      }
    }

    const exported = await served(app)
      .get(`/api/resources/workspaces/${workspaceId}/export`)
      .set(TEST_USER_HEADER, seat.owner);

    expect(exported.body.files).toEqual(
      workspaceTerraform({
        workspaceId,
        workspaceSlug: workspaceId,
        resources: [
          ...CONFIGURATION.resources.map((each) => {
            switch (each.kind) {
              case 'workspace':
                return {
                  ...each,
                  id: workspaceId,
                  address: workspaceId,
                  slug: workspaceId,
                  name: workspaceId,
                };
              case 'workspace-runners':
                return { ...each, address: workspaceId };
              default:
                return each;
            }
          }),
          {
            kind: 'team',
            ownedBy: 'workspace',
            id: workspaceId,
            address: 'team',
            key: 'team',
            name: workspaceId,
          },
        ],
      }),
    );
  });
});
