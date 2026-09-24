import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
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
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { openApp, TEST_USER_HEADER } from './support/app';
import { definitionOf } from './support/line-definition';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const VALUE = 'lin_api_exported_never_7c1f';

const RUNNER_TOKEN = 'r'.repeat(40);

const BUILT_IN = definitionOf(BUILT_IN_LINES[0] as LineOpening);

const PROMPTED = BUILT_IN.stations.find(
  (station) => station.prompt !== undefined,
);

const DELIVERY = {
  ...BUILT_IN,
  runners: ['build-1', 'vpc-internal'],
  stations: BUILT_IN.stations.map((station) =>
    station.key === PROMPTED?.key
      ? {
          ...station,
          harness: 'claude-code',
          profile: 'careful',
          skills: ['grafana'],
          tools: ['linear.comment'],
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

interface Written {
  readonly path: string;
  readonly content: string;
}

describe('a workspace exported as Terraform (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let held: string;
  let seat: Awaited<ReturnType<typeof seatTeam>>;
  const made: Record<string, string> = {};

  const http = () => request(app.getHttpServer());

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
      `/api/resources/workspaces/${held}/export`,
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
    held = `export-${randomUUID().slice(0, 8)}`;
    seat = await seatTeam(db, held);

    for (const [kind, collection, body] of [
      [
        'secret',
        `workspaces/${held}/secrets`,
        {
          name: 'LINEAR_API_KEY',
          bindings: [{ host: 'api.linear.app', prefix: 'Bearer ' }],
          valueWo: VALUE,
          valueWoVersion: 1,
        },
      ],
      [
        'runner',
        `workspaces/${held}/runners`,
        { name: 'build-1', labels: ['vpc-internal'], token: RUNNER_TOKEN },
      ],
      [
        'runner-trust',
        `workspaces/${held}/runner-trusts`,
        {
          key: 'production',
          issuer: 'https://oidc.example.com/cluster',
          subject: 'system:serviceaccount:spotlight:runner',
        },
      ],
      [
        'workspace-runners',
        `workspaces/${held}/workspace-runners`,
        { runners: ['build-1'], trusts: ['production'] },
      ],
      ['skill', `teams/${held}/skills`, GRAFANA],
      ['integration', `teams/${held}/integrations`, LINEAR],
      ['harness-profile', `teams/${held}/harness-profiles`, CAREFUL],
      ['line', `teams/${held}/lines`, DELIVERY],
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
      .delete(schema.integrationDefinition)
      .where(eq(schema.integrationDefinition.teamId, held));
    await db.delete(schema.secret).where(eq(schema.secret.workspaceId, held));
    await db
      .delete(schema.secretDataKey)
      .where(eq(schema.secretDataKey.workspaceId, held));
    await db
      .delete(schema.workspaceToken)
      .where(eq(schema.workspaceToken.workspaceId, held));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, held));
    await db
      .delete(schema.idempotentCreate)
      .where(
        inArray(schema.idempotentCreate.scope, [
          `person:${seat.owner}`,
          `person:${seat.member}`,
        ]),
      );
    await forgetRunnersOf(db, held);
    await seat.unseat();
  });

  it('writes main.tf, variables.tf and the files main.tf reads, importing everything the workspace holds', async () => {
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
      ]),
    );

    for (const [type, name, id] of [
      ['spotlight_workspace', held, held],
      ['spotlight_secret', 'linear_api_key', `${held}/LINEAR_API_KEY`],
      ['spotlight_runner', 'build-1', `${held}/build-1`],
      ['spotlight_runner_trust', 'production', `${held}/production`],
      ['spotlight_workspace_runners', held, `${held}/${held}`],
      ['spotlight_team', 'team', `${held}/team`],
      ['spotlight_line', 'team_delivery', `${held}/team/delivery`],
      ['spotlight_skill', 'team_grafana', `${held}/team/grafana`],
      ['spotlight_integration', 'team_linear', `${held}/team/linear`],
      ['spotlight_harness_profile', 'team_careful', `${held}/team/careful`],
    ]) {
      expect(main).toContain(
        `import {\n  to = ${type}.${name}\n  id = "${id}"\n}\n\nresource "${type}" "${name}" {\n`,
      );
    }
  });

  it('refers to what each resource names, so a first apply creates them in order', async () => {
    const main = fileOf(await exported(), 'main.tf');

    for (const reference of [
      `workspace_id = spotlight_workspace.${held}.id`,
      'team_id = spotlight_team.team.id',
      'skills    = [spotlight_skill.team_grafana.key]',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      'tools     = ["${spotlight_integration.team_linear.source}.comment"]',
      'profile   = spotlight_harness_profile.team_careful.key',
      'runners      = [spotlight_runner.build-1.name, "vpc-internal"]',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      'secrets = ["secret.${spotlight_secret.linear_api_key.name}"]',
      'runners      = [spotlight_runner.build-1.name]',
      'trusts       = [spotlight_runner_trust.production.key]',
    ]) {
      expect(main).toContain(reference);
    }
  });

  it('never writes a secret value or a runner token, asking for them as sensitive variables', async () => {
    const files = await exported();
    const main = fileOf(files, 'main.tf');
    const variables = fileOf(files, 'variables.tf');

    for (const file of files) {
      expect(file.content).not.toContain(VALUE);
      expect(file.content).not.toContain(RUNNER_TOKEN);
    }
    expect(main).toContain(
      '  value_wo         = var.secret_linear_api_key\n  value_wo_version = 1\n',
    );
    expect(main).toContain('  token        = var.runner_build-1_token\n');
    expect(variables).toContain(
      'variable "secret_linear_api_key" {\n  description = "The value of the secret LINEAR_API_KEY, which Spotlight keeps and never answers"\n  type        = string\n  sensitive   = true\n}\n',
    );
    expect(variables).toContain('variable "runner_build-1_token" {');
  });

  it('keeps each prompt and skill file byte for byte', async () => {
    const files = await exported();

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
      `/api/resources/workspaces/${held}/tokens`,
      { name: 'survey', scopes: ['read'] },
    );
    const answered = await http()
      .get(`/api/resources/workspaces/${held}/export`)
      .set(
        'Authorization',
        `Bearer ${issued.headers['spotlight-workspace-token']}`,
      )
      .set('Spotlight-Client', 'cli/0.1.0');

    expect(answered.status).toBe(200);
    expect(answered.body.files).toEqual(await exported());
  });

  it('answers each kind of resource as HCL, after the import block that adopts it', async () => {
    for (const [collection, id, type] of [
      ['workspaces', held, 'spotlight_workspace'],
      ['teams', held, 'spotlight_team'],
      ['lines', made.line, 'spotlight_line'],
      ['skills', made.skill, 'spotlight_skill'],
      ['integrations', made.integration, 'spotlight_integration'],
      [
        'harness-profiles',
        made['harness-profile'],
        'spotlight_harness_profile',
      ],
      ['secrets', made.secret, 'spotlight_secret'],
      ['runners', made.runner, 'spotlight_runner'],
      ['runner-trusts', made['runner-trust'], 'spotlight_runner_trust'],
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
      (await as(stranger).get(`/api/resources/workspaces/${held}/export`))
        .status,
    ).toBe(404);
    expect(
      (await as(stranger).get(`/api/resources/lines/${made.line}/hcl`)).status,
    ).toBe(404);
  });

  it('knows no collection it does not render', async () => {
    const answered = await as(seat.owner).get(
      `/api/resources/tokens/${held}/hcl`,
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
