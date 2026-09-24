import { DeleteIntegrationCommand } from '@integrations/application/commands/delete-integration.command';
import { DeleteIntegrationHandler } from '@integrations/application/commands/handlers/delete-integration.handler';
import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationDefinitionMovedOnError } from '@integrations/domain/exceptions/integration-definition-moved-on.error';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import {
  access,
  definitions,
  standingAt,
  toolsGiven,
  transaction,
} from '@integrations/integrations.resources.fake-spec';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { describe, expect, it } from 'vitest';

const deleting = (
  over: {
    administers?: boolean;
    given?: ToolUses;
  } & Parameters<typeof definitions>[0] = {},
) => {
  const kept = definitions({ standing: standingAt(3), ...over });
  const handler = new DeleteIntegrationHandler(
    access(over.administers),
    kept,
    toolsGiven(over.given),
    transaction,
  );

  return {
    remove: (version = 3) =>
      handler.execute(
        new DeleteIntegrationCommand(
          'integration_1',
          actorFor('user_1'),
          version,
        ),
      ),
    kept,
  };
};

describe('DeleteIntegrationHandler', () => {
  it('retires the version it was asked to', async () => {
    const { remove, kept } = deleting();

    expect(await remove()).toEqual({ outcome: 'deleted' });

    const [saved] = kept.save.mock.calls[0] as [IntegrationDefinition];

    expect(saved.isRetired).toBe(true);
  });

  it('refuses to delete a version no longer current, naming the current one', async () => {
    const { remove, kept } = deleting();

    expect(await remove(2)).toEqual({ outcome: 'moved-on', currentVersion: 3 });
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('names the version that won when a change got there first', async () => {
    const { remove } = deleting({
      refusing: new IntegrationDefinitionMovedOnError('linear'),
      thenAt: standingAt(4),
    });

    expect(await remove()).toEqual({ outcome: 'moved-on', currentVersion: 4 });
  });

  it('will not delete an integration whose tools a station gives', async () => {
    const { remove, kept } = deleting({
      standing: standingAt(3, ['linear.comment']),
      given: ToolUses.of([
        { tool: 'linear.comment', by: 'delivery/implementation' },
      ]),
    });

    expect(await remove()).toMatchObject({ outcome: 'in-use' });
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('answers nothing for an integration it cannot find, and forbids one it may not delete', async () => {
    expect(await deleting({ standing: null }).remove()).toBeNull();
    expect(await deleting({ administers: false }).remove()).toEqual(
      forbiddenTo('configure'),
    );
  });
});
