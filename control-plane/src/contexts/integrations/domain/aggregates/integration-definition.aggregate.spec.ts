import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import { IntegrationCreated } from '@integrations/domain/events/integration-created.event';
import { IntegrationDeleted } from '@integrations/domain/events/integration-deleted.event';
import { IntegrationReread } from '@integrations/domain/events/integration-reread.event';
import { IntegrationUpdated } from '@integrations/domain/events/integration-updated.event';
import { IntegrationDefinitionVersionConflictError } from '@integrations/domain/exceptions/integration-definition-version-conflict.error';
import { IntegrationToolsInUseError } from '@integrations/domain/exceptions/integration-tools-in-use.error';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import { RereadDetail } from '@integrations/domain/value-objects/reread-detail.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { SourceReading } from '@integrations/domain/value-objects/source-reading.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const ID = IntegrationDefinitionId.of('integration_1');

const HASH = ContentHash.of('a'.repeat(64));

const OTHER_HASH = ContentHash.of('b'.repeat(64));

const DESCRIBED = DescribedSource.of({
  kind: 'graphql',
  url: 'https://api.linear.app/graphql',
  fingerprint: 'linear-graphql',
});

const READ_AT = new Date('2026-10-05T12:00:00.000Z');

const readingOf = (hash: ContentHash | null = HASH) =>
  hash
    ? SourceReading.read({ source: DESCRIBED, hash, readAt: READ_AT })
    : SourceReading.failed({
        source: DESCRIBED,
        readAt: READ_AT,
        problem: 'could not be read: api.linear.app answered 401',
      });

const compiled = (
  source: string,
  {
    named = source,
    offers = [] as string[],
    generated = [] as string[],
    from = HASH,
    described = false,
  } = {},
) => {
  const key = SourceKey.of(source);
  const tool = (name: string, backing: ToolBacking) =>
    OfferedTool.of({ source: key, name, description: name, backing });

  return {
    integration: Integration.of({
      source: key,
      actions: DefinedActions.of(['comment']),
      offers: [
        ...offers.map((name) => tool(name, ToolBacking.action('comment'))),
        ...generated.map((name) =>
          tool(name, ToolBacking.operation(from, name)),
        ),
      ],
    }),
    document: DefinitionDocument.of({ integration: named, name: 'Linear' }),
    source: described || generated.length > 0 ? DESCRIBED : null,
  };
};

const rehydrated = (
  offers: string[] = [],
  version = 3,
  reading: SourceReading | null = null,
) =>
  IntegrationDefinition.rehydrate({
    id: ID,
    teamId: TEAM,
    source: SourceKey.of('linear'),
    document: DefinitionDocument.of({ integration: 'linear', name: 'Linear' }),
    offers,
    reading,
    version,
  });

const BY = attributedIn();

const LINEAR = {
  resource: 'integration' as const,
  id: ID.value,
  key: 'linear',
};

const ENABLED = ToolUses.of([
  { tool: 'linear.comment', by: 'the station delivery/implementation' },
]);

describe('IntegrationDefinition', () => {
  it('is created for the host its compiled integration names, and says so', () => {
    const created = IntegrationDefinition.create({
      ...compiled('linear', { offers: ['comment'] }),
      id: ID,
      teamId: TEAM,
      reading: null,
      by: BY,
    });

    expect(created.source).toEqual(SourceKey.of('linear'));
    expect(created.offers).toEqual(['linear.comment']);
    expect(created.isNew).toBe(true);
    expect(created.pullEvents()).toEqual([
      new IntegrationCreated(
        ID,
        TEAM,
        SourceKey.of('linear'),
        ['linear.comment'],
        ConfigurationChange.created(LINEAR, BY),
      ),
    ]);
  });

  it('rejects a definition compiled for another host', () => {
    expect(() =>
      IntegrationDefinition.create({
        ...compiled('linear', { named: 'slack' }),
        id: ID,
        teamId: TEAM,
        reading: null,
        by: BY,
      }),
    ).toThrow(/compiled for another host/);
  });

  it('takes a new definition of its own host, keeping its id and version', () => {
    const updated = rehydrated().update(
      compiled('linear', { offers: ['comment'] }),
      null,
      ToolUses.none(),
      BY,
    );

    expect(updated.id).toEqual(ID);
    expect(updated.version).toBe(3);
    expect(updated.offers).toEqual(['linear.comment']);
    expect(updated.document.hasValue('name', 'Linear')).toBe(true);
    expect(updated.pullEvents()).toEqual([
      new IntegrationUpdated(
        ID,
        TEAM,
        SourceKey.of('linear'),
        ['linear.comment'],
        ConfigurationChange.updated(LINEAR, BY),
      ),
    ]);
  });

  it('keeps the host it was created for, pointing at the field that tried to move it', () => {
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
        compiled('linear', { offers: ['comment'] }),
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
        SourceKey.of('linear'),
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

  it('will not be read back without a version, or under a host it does not define', () => {
    expect(() => rehydrated([], 0)).toThrow(/without a version/);
    expect(() =>
      IntegrationDefinition.rehydrate({
        id: ID,
        teamId: TEAM,
        source: SourceKey.of('linear'),
        document: DefinitionDocument.of({ integration: 'slack' }),
        offers: [],
        reading: null,
        version: 1,
      }),
    ).toThrow(/does not define/);
  });

  it('keeps the reading of the description it names, and the tools generated from it', () => {
    const created = IntegrationDefinition.create({
      ...compiled('linear', {
        offers: ['comment'],
        generated: ['issue-create'],
      }),
      id: ID,
      teamId: TEAM,
      reading: readingOf(),
      by: BY,
    });

    expect(created.offers).toEqual(['linear.comment', 'linear.issue-create']);
    expect(created.reading?.hash).toEqual(HASH);
  });

  it('will not be created without a reading of the description it names', () => {
    const naming = compiled('linear', { described: true });

    expect(() =>
      IntegrationDefinition.create({
        ...naming,
        id: ID,
        teamId: TEAM,
        reading: null,
        by: BY,
      }),
    ).toThrow(/did not receive a reading of it/);
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

  it('rejects tools generated from another reading than the one it stores', () => {
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
    ).toThrow(/another reading/);
  });

  it('keeps a description that could not be read, offering nothing from it', () => {
    const created = IntegrationDefinition.create({
      ...compiled('linear', { described: true }),
      id: ID,
      teamId: TEAM,
      reading: readingOf(null),
      by: BY,
    });

    expect(created.offers).toEqual([]);
    expect(created.reading?.problem).toMatch(/401/);
  });

  it('is reread from upstream, stranding the tools upstream no longer offers', () => {
    const existing = rehydrated(
      ['linear.issue-create', 'linear.issue-delete'],
      3,
      readingOf(),
    );
    const again = SourceReading.read({
      source: DESCRIBED,
      hash: OTHER_HASH,
      readAt: READ_AT,
    });

    expect(existing.rereads(readingOf())).toBe(false);
    expect(existing.rereads(again)).toBe(true);

    const reread = existing.reread(
      compiled('linear', { generated: ['issue-create'], from: OTHER_HASH }),
      again,
      BY,
    );

    expect(reread.offers).toEqual(['linear.issue-create']);
    expect(reread.pullEvents()).toEqual([
      new IntegrationReread(
        ID,
        TEAM,
        SourceKey.of('linear'),
        ['linear.issue-create'],
        ['linear.issue-delete'],
        ConfigurationChange.updated(
          LINEAR,
          BY,
          RereadDetail.of({
            hash: OTHER_HASH.value,
            problem: null,
            stranded: ['linear.issue-delete'],
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

    expect(existing.rereads(failed)).toBe(true);

    const reread = existing.reread(
      compiled('linear', { generated: ['issue-create'] }),
      failed,
      BY,
    );

    expect(reread.offers).toEqual(['linear.issue-create']);
    expect(reread.reading?.problem).toMatch(/ENOTFOUND/);
    expect(reread.pullEvents()).toEqual([
      expect.objectContaining({ stranded: [] }),
    ]);
  });

  it('is reread only from the definition it stores', () => {
    expect(() =>
      rehydrated([], 3, readingOf()).reread(
        compiled('linear', { named: 'linear', generated: ['issue-create'] }),
        readingOf(),
        BY,
      ),
    ).not.toThrow();
    expect(() =>
      rehydrated([], 3, readingOf()).reread(
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
        SourceKey.of('linear'),
        ['linear.comment'],
        ConfigurationChange.deleted(LINEAR, BY),
      ),
    ]);
  });
});
