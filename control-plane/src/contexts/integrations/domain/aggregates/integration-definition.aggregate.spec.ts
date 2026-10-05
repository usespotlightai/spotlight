import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import { IntegrationDefined } from '@integrations/domain/events/integration-defined.event';
import { IntegrationRedefined } from '@integrations/domain/events/integration-redefined.event';
import { IntegrationReread } from '@integrations/domain/events/integration-reread.event';
import { IntegrationRetired } from '@integrations/domain/events/integration-retired.event';
import { IntegrationDefinitionMovedOnError } from '@integrations/domain/exceptions/integration-definition-moved-on.error';
import { IntegrationHostFixedError } from '@integrations/domain/exceptions/integration-host-fixed.error';
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

const standing = (
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

const GIVEN = ToolUses.of([
  { tool: 'linear.comment', by: 'the station delivery/implementation' },
]);

describe('IntegrationDefinition', () => {
  it('is defined for the host its compiled integration names, and says so', () => {
    const defined = IntegrationDefinition.define({
      ...compiled('linear', { offers: ['comment'] }),
      id: ID,
      teamId: TEAM,
      reading: null,
      by: BY,
    });

    expect(defined.source).toEqual(SourceKey.of('linear'));
    expect(defined.offers).toEqual(['linear.comment']);
    expect(defined.isNew).toBe(true);
    expect(defined.pullEvents()).toEqual([
      new IntegrationDefined(
        ID,
        TEAM,
        SourceKey.of('linear'),
        ['linear.comment'],
        ConfigurationChange.created(LINEAR, BY),
      ),
    ]);
  });

  it('refuses a definition compiled for another host', () => {
    expect(() =>
      IntegrationDefinition.define({
        ...compiled('linear', { named: 'slack' }),
        id: ID,
        teamId: TEAM,
        reading: null,
        by: BY,
      }),
    ).toThrow(/definition of another host/);
  });

  it('takes a new definition of its own host, keeping its id and version', () => {
    const redefined = standing().redefinedAs(
      compiled('linear', { offers: ['comment'] }),
      null,
      ToolUses.none(),
      BY,
    );

    expect(redefined.id).toEqual(ID);
    expect(redefined.version).toBe(3);
    expect(redefined.offers).toEqual(['linear.comment']);
    expect(redefined.document.says('name', 'Linear')).toBe(true);
    expect(redefined.pullEvents()).toEqual([
      new IntegrationRedefined(
        ID,
        TEAM,
        SourceKey.of('linear'),
        ['linear.comment'],
        ConfigurationChange.updated(LINEAR, BY),
      ),
    ]);
  });

  it('keeps the host it was defined for, pointing at the field that tried to move it', () => {
    const moved = () =>
      standing().redefinedAs(compiled('slack'), null, ToolUses.none(), BY);

    expect(moved).toThrow(IntegrationHostFixedError);
    expect(moved).toThrow(expect.objectContaining({ field: 'integration' }));
  });

  it('will not stop offering a tool a station gives', () => {
    expect(() =>
      standing(['linear.comment']).redefinedAs(
        compiled('linear'),
        null,
        GIVEN,
        BY,
      ),
    ).toThrow(IntegrationToolsInUseError);
    expect(() =>
      standing(['linear.comment']).redefinedAs(
        compiled('linear', { offers: ['comment'] }),
        null,
        GIVEN,
        BY,
      ),
    ).not.toThrow();
  });

  it('is retired only once no station gives what it offers', () => {
    expect(() => standing(['linear.comment']).retired(GIVEN, BY)).toThrow(
      /linear.comment, which the station delivery\/implementation uses/,
    );

    const retired = standing(['linear.comment']).retired(ToolUses.none(), BY);

    expect(retired.isRetired).toBe(true);
    expect(retired.pullEvents()).toEqual([
      new IntegrationRetired(
        ID,
        TEAM,
        SourceKey.of('linear'),
        ['linear.comment'],
        ConfigurationChange.deleted(LINEAR, BY),
      ),
    ]);
  });

  it('changes nothing once retired', () => {
    const retired = standing().retired(ToolUses.none(), BY);

    expect(() =>
      retired.redefinedAs(compiled('linear'), null, ToolUses.none(), BY),
    ).toThrow(InconsistentStateError);
    expect(() => retired.retired(ToolUses.none(), BY)).toThrow(
      InconsistentStateError,
    );
  });

  it('refuses a change based on a version it has moved on from', () => {
    expect(() => standing([], 3).expecting(3)).not.toThrow();
    expect(() => standing([], 3).expecting(2)).toThrow(
      IntegrationDefinitionMovedOnError,
    );
  });

  it('will not be read back without a version, or under a host it does not define', () => {
    expect(() => standing([], 0)).toThrow(/without a version/);
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
    const defined = IntegrationDefinition.define({
      ...compiled('linear', {
        offers: ['comment'],
        generated: ['issue-create'],
      }),
      id: ID,
      teamId: TEAM,
      reading: readingOf(),
      by: BY,
    });

    expect(defined.offers).toEqual(['linear.comment', 'linear.issue-create']);
    expect(defined.reading?.hash).toEqual(HASH);
  });

  it('will not be defined without a reading of the description it names', () => {
    const naming = compiled('linear', { described: true });

    expect(() =>
      IntegrationDefinition.define({
        ...naming,
        id: ID,
        teamId: TEAM,
        reading: null,
        by: BY,
      }),
    ).toThrow(/was not given a reading of it/);
    expect(() =>
      IntegrationDefinition.define({
        ...compiled('linear'),
        id: ID,
        teamId: TEAM,
        reading: readingOf(),
        by: BY,
      }),
    ).toThrow(/does not name/);
  });

  it('refuses tools generated from another reading than the one it keeps', () => {
    expect(() =>
      IntegrationDefinition.define({
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
    const defined = IntegrationDefinition.define({
      ...compiled('linear', { described: true }),
      id: ID,
      teamId: TEAM,
      reading: readingOf(null),
      by: BY,
    });

    expect(defined.offers).toEqual([]);
    expect(defined.reading?.problem).toMatch(/401/);
  });

  it('is reread from upstream, stranding the tools upstream no longer offers', () => {
    const held = standing(
      ['linear.issue-create', 'linear.issue-delete'],
      3,
      readingOf(),
    );
    const again = SourceReading.read({
      source: DESCRIBED,
      hash: OTHER_HASH,
      readAt: READ_AT,
    });

    expect(held.rereads(readingOf())).toBe(false);
    expect(held.rereads(again)).toBe(true);

    const reread = held.reread(
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
    const held = standing(['linear.issue-create'], 3, readingOf());
    const failed = readingOf().stillAfter(
      'could not be read: api.linear.app: ENOTFOUND',
    );

    expect(held.rereads(failed)).toBe(true);

    const reread = held.reread(
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

  it('is reread only from the definition it keeps', () => {
    expect(() =>
      standing([], 3, readingOf()).reread(
        compiled('linear', { named: 'linear', generated: ['issue-create'] }),
        readingOf(),
        BY,
      ),
    ).not.toThrow();
    expect(() =>
      standing([], 3, readingOf()).reread(
        {
          ...compiled('linear', { generated: ['issue-create'] }),
          document: DefinitionDocument.of({ integration: 'linear', name: 'X' }),
        },
        readingOf(),
        BY,
      ),
    ).toThrow(/other than the one it keeps/);
  });

  it('is abandoned with its team, whatever its tools are given to', () => {
    const abandoned = standing(['linear.comment']).abandoned(BY);

    expect(abandoned.isRetired).toBe(true);
    expect(abandoned.pullEvents()).toEqual([
      new IntegrationRetired(
        ID,
        TEAM,
        SourceKey.of('linear'),
        ['linear.comment'],
        ConfigurationChange.deleted(LINEAR, BY),
      ),
    ]);
  });
});
