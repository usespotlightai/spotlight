import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const compiled = (source: string, named = source) => ({
  integration: Integration.of({
    source: SourceKey.of(source),
    actions: DefinedActions.of(['comment']),
  }),
  document: DefinitionDocument.of({ integration: named, name: 'Linear' }),
});

describe('IntegrationDefinition', () => {
  it('is defined for the host its compiled integration names', () => {
    const defined = IntegrationDefinition.define({
      ...compiled('linear'),
      teamId: TEAM,
    });

    expect(defined.source).toEqual(SourceKey.of('linear'));
    expect(defined.document.says('name', 'Linear')).toBe(true);
    expect(defined.isNew).toBe(true);
  });

  it('refuses a definition compiled for another host', () => {
    expect(() =>
      IntegrationDefinition.define({
        ...compiled('linear', 'slack'),
        teamId: TEAM,
      }),
    ).toThrow(/definition of another host/);
  });

  it('takes a new definition of its own host, keeping its version', () => {
    const standing = IntegrationDefinition.rehydrate({
      teamId: TEAM,
      source: SourceKey.of('linear'),
      document: DefinitionDocument.of({ integration: 'linear' }),
      version: 3,
    });

    const redefined = standing.redefinedAs(compiled('linear'));

    expect(redefined.version).toBe(3);
    expect(redefined.document.says('name', 'Linear')).toBe(true);
  });

  it('refuses to be replaced by a definition of another host', () => {
    const standing = IntegrationDefinition.rehydrate({
      teamId: TEAM,
      source: SourceKey.of('linear'),
      document: DefinitionDocument.of({ integration: 'linear' }),
      version: 1,
    });

    expect(() => standing.redefinedAs(compiled('slack'))).toThrow(
      /cannot replace the definition of linear/,
    );
  });

  it('will not be read back without a version, or under a host it does not define', () => {
    expect(() =>
      IntegrationDefinition.rehydrate({
        teamId: TEAM,
        source: SourceKey.of('linear'),
        document: DefinitionDocument.of({ integration: 'linear' }),
        version: 0,
      }),
    ).toThrow(/without a version/);
    expect(() =>
      IntegrationDefinition.rehydrate({
        teamId: TEAM,
        source: SourceKey.of('linear'),
        document: DefinitionDocument.of({ integration: 'slack' }),
        version: 1,
      }),
    ).toThrow(/does not define/);
  });
});
