import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import { IntegrationDefined } from '@integrations/domain/events/integration-defined.event';
import { IntegrationRedefined } from '@integrations/domain/events/integration-redefined.event';
import { IntegrationRetired } from '@integrations/domain/events/integration-retired.event';
import { IntegrationDefinitionMovedOnError } from '@integrations/domain/exceptions/integration-definition-moved-on.error';
import { IntegrationHostFixedError } from '@integrations/domain/exceptions/integration-host-fixed.error';
import { IntegrationToolsInUseError } from '@integrations/domain/exceptions/integration-tools-in-use.error';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const ID = IntegrationDefinitionId.of('integration_1');

const compiled = (
  source: string,
  { named = source, offers = [] as string[] } = {},
) => {
  const key = SourceKey.of(source);

  return {
    integration: Integration.of({
      source: key,
      actions: DefinedActions.of(['comment']),
      offers: offers.map((name) =>
        OfferedTool.of({
          source: key,
          name,
          description: name,
          does: 'comment',
        }),
      ),
    }),
    document: DefinitionDocument.of({ integration: named, name: 'Linear' }),
  };
};

const standing = (offers: string[] = [], version = 3) =>
  IntegrationDefinition.rehydrate({
    id: ID,
    teamId: TEAM,
    source: SourceKey.of('linear'),
    document: DefinitionDocument.of({ integration: 'linear' }),
    offers,
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
        by: BY,
      }),
    ).toThrow(/definition of another host/);
  });

  it('takes a new definition of its own host, keeping its id and version', () => {
    const redefined = standing().redefinedAs(
      compiled('linear', { offers: ['comment'] }),
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
      standing().redefinedAs(compiled('slack'), ToolUses.none(), BY);

    expect(moved).toThrow(IntegrationHostFixedError);
    expect(moved).toThrow(expect.objectContaining({ field: 'integration' }));
  });

  it('will not stop offering a tool a station gives', () => {
    expect(() =>
      standing(['linear.comment']).redefinedAs(compiled('linear'), GIVEN, BY),
    ).toThrow(IntegrationToolsInUseError);
    expect(() =>
      standing(['linear.comment']).redefinedAs(
        compiled('linear', { offers: ['comment'] }),
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
      retired.redefinedAs(compiled('linear'), ToolUses.none(), BY),
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
        version: 1,
      }),
    ).toThrow(/does not define/);
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
