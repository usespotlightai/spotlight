import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import { IntegrationCreated } from '@integrations/domain/events/integration-created.event';
import { IntegrationDeleted } from '@integrations/domain/events/integration-deleted.event';
import { IntegrationSpecRefreshed } from '@integrations/domain/events/integration-spec-refreshed.event';
import { IntegrationUpdated } from '@integrations/domain/events/integration-updated.event';
import { IntegrationDefinitionVersionConflictError } from '@integrations/domain/exceptions/integration-definition-version-conflict.error';
import { IntegrationToolsInUseError } from '@integrations/domain/exceptions/integration-tools-in-use.error';
import { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import { SpecFetchResult } from '@integrations/domain/value-objects/spec-fetch-result.vo';
import { SpecRefreshDetail } from '@integrations/domain/value-objects/spec-refresh-detail.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const ID = IntegrationDefinitionId.of('integration_1');

const HASH = ContentHash.of('a'.repeat(64));

const OTHER_HASH = ContentHash.of('b'.repeat(64));

const SPEC = ApiSpec.of({
  kind: 'graphql',
  url: 'https://api.linear.app/graphql',
  fingerprint: 'linear-graphql',
});

const READ_AT = new Date('2026-10-05T12:00:00.000Z');

const readingOf = (hash: ContentHash | null = HASH) =>
  hash
    ? SpecFetchResult.read({ spec: SPEC, hash, readAt: READ_AT })
    : SpecFetchResult.failed({
        spec: SPEC,
        readAt: READ_AT,
        problem: 'could not be read: api.linear.app answered 401',
      });

const compiled = (
  integration: string,
  {
    named = integration,
    tools = [] as string[],
    generated = [] as string[],
    from = HASH,
    withSpec = false,
  } = {},
) => {
  const key = IntegrationKey.of(integration);
  const tool = (name: string, backing: ToolBacking) =>
    ProvidedTool.of({ integration: key, name, description: name, backing });

  return {
    integration: Integration.of({
      key,
      actions: DefinedActions.of(['comment']),
      tools: [
        ...tools.map((name) => tool(name, ToolBacking.action('comment'))),
        ...generated.map((name) =>
          tool(name, ToolBacking.operation(from, name)),
        ),
      ],
    }),
    document: DefinitionDocument.of({ integration: named, name: 'Linear' }),
    spec: withSpec || generated.length > 0 ? SPEC : null,
  };
};

const rehydrated = (
  tools: string[] = [],
  version = 3,
  reading: SpecFetchResult | null = null,
) =>
  IntegrationDefinition.rehydrate({
    id: ID,
    teamId: TEAM,
    integration: IntegrationKey.of('linear'),
    document: DefinitionDocument.of({ integration: 'linear', name: 'Linear' }),
    tools,
    reading,
    version,
  });

const BY = changeActorIn();

const LINEAR = {
  resource: 'integration' as const,
  id: ID.value,
  key: 'linear',
};

const ENABLED = ToolUses.of([
  { tool: 'linear.comment', by: 'the station delivery/implementation' },
]);

describe('IntegrationDefinition', () => {
  it('is created for the integration its compiled definition names, and says so', () => {
    const created = IntegrationDefinition.create({
      ...compiled('linear', { tools: ['comment'] }),
      id: ID,
      teamId: TEAM,
      reading: null,
      by: BY,
    });

    expect(created.integration).toEqual(IntegrationKey.of('linear'));
    expect(created.tools).toEqual(['linear.comment']);
    expect(created.isNew).toBe(true);
    expect(created.pullEvents()).toEqual([
      new IntegrationCreated(
        ID,
        TEAM,
        IntegrationKey.of('linear'),
        ['linear.comment'],
        ConfigurationChange.created(LINEAR, BY),
      ),
    ]);
  });

  it('rejects a definition compiled for another integration', () => {
    expect(() =>
      IntegrationDefinition.create({
        ...compiled('linear', { named: 'slack' }),
        id: ID,
        teamId: TEAM,
        reading: null,
        by: BY,
      }),
    ).toThrow(/compiled for another integration/);
  });

  it('takes a new definition of its own integration, keeping its id and version', () => {
    const updated = rehydrated().update(
      compiled('linear', { tools: ['comment'] }),
      null,
      ToolUses.none(),
      BY,
    );

    expect(updated.id).toEqual(ID);
    expect(updated.version).toBe(3);
    expect(updated.tools).toEqual(['linear.comment']);
    expect(updated.document.hasValue('name', 'Linear')).toBe(true);
    expect(updated.pullEvents()).toEqual([
      new IntegrationUpdated(
        ID,
        TEAM,
        IntegrationKey.of('linear'),
        ['linear.comment'],
        ConfigurationChange.updated(LINEAR, BY),
      ),
    ]);
  });

  it('keeps the integration name it was created for, pointing at the field that tried to move it', () => {
    const moved = () =>
      rehydrated().update(compiled('slack'), null, ToolUses.none(), BY);

    expect(moved).toThrow(ImmutableFieldError);
    expect(moved).toThrow(expect.objectContaining({ field: 'integration' }));
  });

  it('will not stop offering a tool a station enables', () => {
    expect(() =>
      rehydrated(['linear.comment']).update(
        compiled('linear'),
        null,
        ENABLED,
        BY,
      ),
    ).toThrow(IntegrationToolsInUseError);
    expect(() =>
      rehydrated(['linear.comment']).update(
        compiled('linear', { tools: ['comment'] }),
        null,
        ENABLED,
        BY,
      ),
    ).not.toThrow();
  });

  it('is deleted only once no station enables what it offers', () => {
    expect(() => rehydrated(['linear.comment']).delete(ENABLED, BY)).toThrow(
      /linear.comment \(used by the station delivery\/implementation\)/,
    );

    const deleted = rehydrated(['linear.comment']).delete(ToolUses.none(), BY);

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.pullEvents()).toEqual([
      new IntegrationDeleted(
        ID,
        TEAM,
        IntegrationKey.of('linear'),
        ['linear.comment'],
        ConfigurationChange.deleted(LINEAR, BY),
      ),
    ]);
  });

  it('changes nothing once deleted', () => {
    const deleted = rehydrated().delete(ToolUses.none(), BY);

    expect(() =>
      deleted.update(compiled('linear'), null, ToolUses.none(), BY),
    ).toThrow(InconsistentStateError);
    expect(() => deleted.delete(ToolUses.none(), BY)).toThrow(
      InconsistentStateError,
    );
  });

  it('rejects a change based on a version that is no longer current', () => {
    expect(() => rehydrated([], 3).assertVersion(3)).not.toThrow();
    expect(() => rehydrated([], 3).assertVersion(2)).toThrow(
      IntegrationDefinitionVersionConflictError,
    );
  });

  it('will not be read back without a version, or under an integration name it does not define', () => {
    expect(() => rehydrated([], 0)).toThrow(/without a version/);
    expect(() =>
      IntegrationDefinition.rehydrate({
        id: ID,
        teamId: TEAM,
        integration: IntegrationKey.of('linear'),
        document: DefinitionDocument.of({ integration: 'slack' }),
        tools: [],
        reading: null,
        version: 1,
      }),
    ).toThrow(/does not define/);
  });

  it('keeps the fetched spec it names, and the tools generated from it', () => {
    const created = IntegrationDefinition.create({
      ...compiled('linear', {
        tools: ['comment'],
        generated: ['issue-create'],
      }),
      id: ID,
      teamId: TEAM,
      reading: readingOf(),
      by: BY,
    });

    expect(created.tools).toEqual(['linear.comment', 'linear.issue-create']);
    expect(created.reading?.hash).toEqual(HASH);
  });

  it('will not be created without a fetch of the spec it names', () => {
    const naming = compiled('linear', { withSpec: true });

    expect(() =>
      IntegrationDefinition.create({
        ...naming,
        id: ID,
        teamId: TEAM,
        reading: null,
        by: BY,
      }),
    ).toThrow(/did not receive a fetched spec/);
    expect(() =>
      IntegrationDefinition.create({
        ...compiled('linear'),
        id: ID,
        teamId: TEAM,
        reading: readingOf(),
        by: BY,
      }),
    ).toThrow(/does not name/);
  });

  it('rejects tools generated from another fetch than the one it stores', () => {
    expect(() =>
      IntegrationDefinition.create({
        ...compiled('linear', {
          generated: ['issue-create'],
          from: OTHER_HASH,
        }),
        id: ID,
        teamId: TEAM,
        reading: readingOf(),
        by: BY,
      }),
    ).toThrow(/another fetch/);
  });

  it('keeps a spec that could not be fetched, and provides nothing from it', () => {
    const created = IntegrationDefinition.create({
      ...compiled('linear', { withSpec: true }),
      id: ID,
      teamId: TEAM,
      reading: readingOf(null),
      by: BY,
    });

    expect(created.tools).toEqual([]);
    expect(created.reading?.problem).toMatch(/401/);
  });

  it('refreshes its spec from upstream, and orphans the tools upstream no longer provides', () => {
    const existing = rehydrated(
      ['linear.issue-create', 'linear.issue-delete'],
      3,
      readingOf(),
    );
    const again = SpecFetchResult.read({
      spec: SPEC,
      hash: OTHER_HASH,
      readAt: READ_AT,
    });

    expect(existing.changesSpec(readingOf())).toBe(false);
    expect(existing.changesSpec(again)).toBe(true);

    const refreshed = existing.refreshSpec(
      compiled('linear', { generated: ['issue-create'], from: OTHER_HASH }),
      again,
      BY,
    );

    expect(refreshed.tools).toEqual(['linear.issue-create']);
    expect(refreshed.pullEvents()).toEqual([
      new IntegrationSpecRefreshed(
        ID,
        TEAM,
        IntegrationKey.of('linear'),
        ['linear.issue-create'],
        ['linear.issue-delete'],
        ConfigurationChange.updated(
          LINEAR,
          BY,
          SpecRefreshDetail.of({
            hash: OTHER_HASH.value,
            problem: null,
            orphanedTools: ['linear.issue-delete'],
          }),
        ),
      ),
    ]);
  });

  it('keeps its tools when reading again fails, recording only why', () => {
    const existing = rehydrated(['linear.issue-create'], 3, readingOf());
    const failed = readingOf().stillAfter(
      'could not be read: api.linear.app: ENOTFOUND',
    );

    expect(existing.changesSpec(failed)).toBe(true);

    const refreshed = existing.refreshSpec(
      compiled('linear', { generated: ['issue-create'] }),
      failed,
      BY,
    );

    expect(refreshed.tools).toEqual(['linear.issue-create']);
    expect(refreshed.reading?.problem).toMatch(/ENOTFOUND/);
    expect(refreshed.pullEvents()).toEqual([
      expect.objectContaining({ orphanedTools: [] }),
    ]);
  });

  it('refreshes its spec only from the definition it stores', () => {
    expect(() =>
      rehydrated([], 3, readingOf()).refreshSpec(
        compiled('linear', { named: 'linear', generated: ['issue-create'] }),
        readingOf(),
        BY,
      ),
    ).not.toThrow();
    expect(() =>
      rehydrated([], 3, readingOf()).refreshSpec(
        {
          ...compiled('linear', { generated: ['issue-create'] }),
          document: DefinitionDocument.of({ integration: 'linear', name: 'X' }),
        },
        readingOf(),
        BY,
      ),
    ).toThrow(/other than the one it stores/);
  });

  it('is deleted with its team, whatever stations enable its tools', () => {
    const deleted = rehydrated(['linear.comment']).cascadeDelete(BY);

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.pullEvents()).toEqual([
      new IntegrationDeleted(
        ID,
        TEAM,
        IntegrationKey.of('linear'),
        ['linear.comment'],
        ConfigurationChange.deleted(LINEAR, BY),
      ),
    ]);
  });
});
