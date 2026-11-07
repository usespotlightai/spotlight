import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { HookResourcesPort } from '@integrations/application/ports/hook-resources.port';
import { HookConfigs } from '@integrations/infrastructure/acl/hook-configs.adapter';
import { compileHook } from '@integrations/infrastructure/hooks/hook.compile';
import { writtenHookDocumentOf } from '@integrations/infrastructure/hooks/written-hook-document';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const storedOf = (written: Record<string, unknown>) => {
  const compiled = compileHook(written, new CelExpressionEngine());

  if (!compiled.ok) {
    throw new Error(JSON.stringify(compiled.problems));
  }

  return compiled.document.fields;
};

const configsOf = (definition: Readonly<Record<string, unknown>>) =>
  new HookConfigs(
    {
      withId: async () => ({
        id: 'hook_1',
        teamId: TEAM,
        key: 'dba',
        version: 1,
        written: writtenHookDocumentOf('dba', definition),
      }),
      at: async () => null,
      ofTeam: async () => [],
    } satisfies HookResourcesPort,
    {
      find: async () => ({
        id: TEAM,
        key: 'core',
        name: 'Core',
        workspaceId: WorkspaceId.of('workspace_1'),
      }),
    } as unknown as TeamDirectoryPort,
  );

const HOOK = {
  key: 'dba',
  on: 'pull-request.merged',
  match: { paths: ['db/migrations/**'] },
  signing: { oidc: { audience: 'https://dba.example.com' } },
};

describe('HookConfigs', () => {
  it('names the from of a request only when it was written', async () => {
    const config = await configsOf(
      storedOf({
        ...HOOK,
        steps: [
          { name: 'unwritten', request: { url: 'https://dba.example.com/a' } },
          {
            name: 'written',
            request: { url: 'https://dba.example.com/b', from: 'spotlight' },
          },
        ],
      }),
    ).withId('hook_1');

    expect(config?.steps).toEqual([
      {
        name: 'unwritten',
        request: {
          url: 'https://dba.example.com/a',
          headers: {},
          body: undefined,
          from: null,
        },
      },
      {
        name: 'written',
        request: {
          url: 'https://dba.example.com/b',
          headers: {},
          body: undefined,
          from: 'spotlight',
        },
      },
    ]);
  });

  it('names the failure and timeout only when they were written', async () => {
    const steps = [{ name: 'tell', request: { url: 'https://a.example.com' } }];
    const unwritten = await configsOf(storedOf({ ...HOOK, steps })).withId(
      'hook_1',
    );
    const written = await configsOf(
      storedOf({ ...HOOK, steps, failure: 'continue', timeoutSeconds: 10 }),
    ).withId('hook_1');

    expect(unwritten).toMatchObject({ failure: null, timeoutSeconds: null });
    expect(written).toMatchObject({ failure: 'continue', timeoutSeconds: 10 });
  });

  it('reads the match block and signing the hook was written with', async () => {
    const config = await configsOf(
      storedOf({
        ...HOOK,
        steps: [{ name: 'tell', request: { url: 'https://a.example.com' } }],
      }),
    ).withId('hook_1');

    expect(config).toMatchObject({
      address: 'core/dba',
      on: 'pull-request.merged',
      match: {
        tools: [],
        lines: [],
        stations: [],
        repositories: [],
        paths: ['db/migrations/**'],
      },
      signing: { oidc: { audience: 'https://dba.example.com' } },
    });
  });
});
