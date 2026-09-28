import {
  compileHook,
  globToRegex,
  secretIn,
} from '@integrations/infrastructure/hooks/hook.compile';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { holds } from '@platform/expressions/readings';
import { describe, expect, it } from 'vitest';

const engine = new CelExpressionEngine();

const SECRET = `whsec_${Buffer.from('k'.repeat(32)).toString('base64')}`;

const GRAFANA_READS = {
  key: 'grafana-reads',
  on: 'tool.used',
  match: { tools: ['grafana.search'] },
  steps: [
    {
      name: 'notify',
      call: 'slack.post-message',
      with: {
        channel: 'C024BE91L',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
        text: 'Agent searched Grafana: ${{ event.inputs.query }}',
      },
    },
    {
      name: 'audit',
      request: {
        url: 'https://audit.example.com/',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
        body: '${{ {"said": step.notify.status} }}',
      },
    },
  ],
  signing: { secret: SECRET, secretVersion: 1 },
};

const MIGRATIONS = {
  key: 'migrations-need-a-dba',
  on: 'pull-request.opening',
  match: { paths: ['db/migrations/'] },
  when: 'event.changed.exists(path, path.startsWith(vars.migrations))',
  vars: { migrations: 'db/migrations/' },
  steps: [
    {
      name: 'tell',
      request: {
        url: 'https://dba.example.com/',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
        body: "${{ {'pr': event.title, 'files': event.changed.filter(path, path.startsWith(vars.migrations))} }}",
      },
    },
  ],
  signing: { oidc: { audience: 'https://dba.example.com' } },
  failure: 'block',
};

const moment = (event: Record<string, unknown>) => ({
  event: { at: '2026-09-26T10:00:00.000Z', ...event },
  task: {
    id: 't',
    title: 'Add a column',
    url: 'https://spotlight.example.com/t',
    line: 'delivery',
    station: 'Implementation',
    stationKey: 'implementation',
    marks: {},
    repositories: ['acme/api'],
    pullRequest: null,
  },
  run: { id: 'r' },
  vars: { migrations: 'db/migrations/' },
  hook: { key: 'k' },
});

const problemsOf = (held: unknown) => {
  const compiled = compileHook(held, engine);

  return compiled.ok
    ? []
    : compiled.problems.map((each) => [each.field.rendered, each.reason]);
};

describe('compileHook', () => {
  it('compiles the Grafana-to-Slack hook from the design', () => {
    const compiled = compileHook(GRAFANA_READS, engine);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    expect(compiled.ir.hook.tools.map((tool) => tool.value)).toEqual([
      'grafana.search',
      'slack.post-message',
    ]);
    expect(compiled.ir.signing).toEqual({ kind: 'hmac' });
    expect(compiled.document.fields.signing).toEqual({ secretVersion: 1 });
  });

  it('keeps in its document only the failure and timeout it was written with', () => {
    const unwritten = compileHook(GRAFANA_READS, engine);
    const written = compileHook(
      { ...GRAFANA_READS, failure: 'continue', timeoutSeconds: 10 },
      engine,
    );

    if (!unwritten.ok || !written.ok) throw new Error('did not compile');

    expect(unwritten.ir.hook.failure).toBe('continue');
    expect(unwritten.ir.hook.timeoutSeconds).toBe(10);
    expect(unwritten.document.fields).not.toHaveProperty('failure');
    expect(unwritten.document.fields).not.toHaveProperty('timeoutSeconds');
    expect(written.document.fields).toMatchObject({
      failure: 'continue',
      timeoutSeconds: 10,
    });
  });

  it('keeps the secret out of the document and hands it over apart', () => {
    expect(secretIn(GRAFANA_READS)).toEqual({ secret: SECRET, version: 1 });
    expect(JSON.stringify(compileHook(GRAFANA_READS, engine))).not.toContain(
      SECRET,
    );
  });

  it('matches the tools it names and no other', () => {
    const compiled = compileHook(GRAFANA_READS, engine);
    if (!compiled.ok) throw new Error('did not compile');

    const matched = (tool: string) =>
      compiled.ir.conditions.every((condition) =>
        holds(
          condition,
          moment({ tool, inputs: {}, output: null, failed: false }),
        ),
      );

    expect(matched('grafana.search')).toBe(true);
    expect(matched('grafana.dashboard')).toBe(false);
  });

  it('matches changed paths by glob, and a folder by its prefix', () => {
    const compiled = compileHook(MIGRATIONS, engine);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.problems));

    const matched = (changed: string[]) =>
      compiled.ir.conditions.every((condition) =>
        holds(
          condition,
          moment({
            repository: 'acme/api',
            branch: 'b',
            title: 'Add a column',
            changed,
          }),
        ),
      );

    expect(matched(['src/app.ts', 'db/migrations/0042_add.sql'])).toBe(true);
    expect(matched(['src/app.ts'])).toBe(false);
  });

  it('refuses a typo, pointing at where it is and what was meant', () => {
    expect(
      problemsOf({
        ...GRAFANA_READS,
        when: "event.argumnts.query != ''",
      }),
    ).toEqual([['when', expect.stringMatching(/argumnts/)]]);
  });

  it('refuses a when that does not return a bool', () => {
    expect(problemsOf({ ...GRAFANA_READS, when: 'event.tool' })).toEqual([
      ['when', 'must return a bool, not a string'],
    ]);
  });

  it('lets a step read only the steps before it', () => {
    expect(
      problemsOf({
        ...GRAFANA_READS,
        steps: [
          {
            name: 'notify',
            call: 'slack.post-message',
            // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
            with: { text: '${{ step.audit.status }}' },
          },
          GRAFANA_READS.steps[1],
        ],
      }),
    ).toEqual([['steps[0].with.text', expect.stringMatching(/audit/)]]);
  });

  it('does not let a hook after an event read a run it has none of', () => {
    expect(
      problemsOf({
        key: 'opened',
        on: 'task.opened',
        when: "run.id != ''",
        steps: [{ name: 'tell', call: 'slack.post-message' }],
      }),
    ).toEqual([['when', expect.stringMatching(/run/)]]);
  });

  it('refuses to block an event that has already happened', () => {
    expect(problemsOf({ ...GRAFANA_READS, failure: 'block' })).toEqual([
      ['failure', expect.stringMatching(/already happened/)],
    ]);
  });

  it('refuses tools matched on an event that is not about a tool', () => {
    expect(
      problemsOf({ ...MIGRATIONS, match: { tools: ['grafana.search'] } }),
    ).toEqual([['match.tools', expect.stringMatching(/not about a tool/)]]);
  });

  it('refuses a request with no signing', () => {
    expect(problemsOf({ ...MIGRATIONS, signing: null })).toEqual([
      ['signing', expect.stringMatching(/signs them/)],
    ]);
  });

  it('refuses plain http unless the team’s network sends it', () => {
    const plain = (from: string) => ({
      ...MIGRATIONS,
      steps: [
        { name: 'tell', request: { url: 'http://dba.acme.internal/', from } },
      ],
    });

    expect(problemsOf(plain('spotlight'))).toEqual([
      ['steps[0].request.url', expect.stringMatching(/not https/)],
    ]);
    expect(problemsOf(plain('network'))).toEqual([]);
  });

  it('refuses a step that both calls and requests', () => {
    expect(
      problemsOf({
        ...GRAFANA_READS,
        steps: [
          {
            name: 'both',
            call: 'slack.post-message',
            request: { url: 'https://a.example.com/' },
          },
        ],
      }),
    ).toEqual([['steps[0]', expect.stringMatching(/exactly one/)]]);
  });

  it('refuses reading a secret', () => {
    expect(
      problemsOf({
        ...GRAFANA_READS,
        when: 'secret.SLACK_TOKEN != ""',
      }),
    ).toEqual([['when', expect.stringMatching(/secret/)]]);
  });
});

describe('globToRegex', () => {
  it.each([
    ['db/migrations/**', 'db/migrations/a/b.sql', true],
    ['db/migrations/*', 'db/migrations/a/b.sql', false],
    ['db/migrations/', 'db/migrations/a.sql', true],
    ['**/*.sql', 'db/x.sql', true],
    ['src/?.ts', 'src/a.ts', true],
    ['a.b', 'axb', false],
  ])('%s against %s is %s', (glob, path, matched) => {
    expect(new RegExp(globToRegex(glob)).test(path)).toBe(matched);
  });
});
