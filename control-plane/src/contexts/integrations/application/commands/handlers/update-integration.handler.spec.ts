import { UpdateIntegrationHandler } from '@integrations/application/commands/handlers/update-integration.handler';
import { UpdateIntegrationCommand } from '@integrations/application/commands/update-integration.command';
import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationDefinitionVersionConflictError } from '@integrations/domain/exceptions/integration-definition-version-conflict.error';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import {
  access,
  definitions,
  LINEAR,
  SLACK,
  sources,
  storedAt,
  toolsGiven,
  transaction,
} from '@integrations/integrations.resources.fake-spec';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

const updating = (
  over: {
    administers?: boolean;
    given?: ToolUses;
  } & Parameters<typeof definitions>[0] = {},
) => {
  const kept = definitions({ stored: storedAt(3), ...over });
  const handler = new UpdateIntegrationHandler(
    access(over.administers),
    sources,
    kept,
    toolsGiven(over.given),
    transaction,
  );

  return {
    update: (definition: unknown, version = 3) =>
      handler.execute(
        new UpdateIntegrationCommand(
          'integration_1',
          actorFor('user_1'),
          version,
          definition,
        ),
      ),
    kept,
  };
};

describe('UpdateIntegrationHandler', () => {
  it('replaces the definition of the version it was based on', async () => {
    const { update, kept } = updating();

    expect(await update(LINEAR)).toEqual({
      outcome: 'updated',
      id: 'integration_1',
    });

    const [saved] = kept.save.mock.calls[0] as [IntegrationDefinition];

    expect(saved.version).toBe(3);
    expect(saved.document.says('name', 'Linear')).toBe(true);
  });

  it('rejects a change based on a version no longer current, naming the current one', async () => {
    const { update, kept } = updating();

    expect(await update(LINEAR, 2)).toEqual({
      outcome: 'version-conflict',
      currentVersion: 3,
    });
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('names the version that won when another change got there first', async () => {
    const { update } = updating({
      failing: new IntegrationDefinitionVersionConflictError('linear'),
      thenAt: storedAt(4),
    });

    expect(await update(LINEAR)).toEqual({
      outcome: 'version-conflict',
      currentVersion: 4,
    });
  });

  it('answers nothing when the integration was deleted while it changed it', async () => {
    const { update } = updating({
      failing: new IntegrationDefinitionVersionConflictError('linear'),
      thenAt: null,
    });

    expect(await update(LINEAR)).toBeNull();
  });

  it('keeps the host it was created for, pointing at the field that tried to move it', async () => {
    const { update, kept } = updating();

    expect(await update(SLACK)).toMatchObject({
      outcome: 'invalid',
      problems: [{ field: FieldPath.dotted('integration') }],
    });
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('will not stop offering a tool a station gives', async () => {
    const { update, kept } = updating({
      stored: storedAt(3, ['linear.comment']),
      given: ToolUses.of([
        { tool: 'linear.comment', by: 'the station delivery/implementation' },
      ]),
    });

    expect(await update(LINEAR)).toMatchObject({
      outcome: 'in-use',
      reason: expect.stringContaining('delivery/implementation'),
    });
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('says what is wrong with one that will not compile', async () => {
    const { update } = updating();

    expect(await update({ integration: 'linear' })).toMatchObject({
      outcome: 'invalid',
    });
  });

  it('answers nothing for an integration it cannot find, and forbids one it may not change', async () => {
    expect(await updating({ stored: null }).update(LINEAR)).toBeNull();
    expect(await updating({ administers: false }).update(LINEAR)).toEqual(
      forbiddenTo('configure'),
    );
  });
});
