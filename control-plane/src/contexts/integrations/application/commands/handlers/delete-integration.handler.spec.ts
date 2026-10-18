import { DeleteIntegrationCommand } from '@integrations/application/commands/delete-integration.command';
import { DeleteIntegrationHandler } from '@integrations/application/commands/handlers/delete-integration.handler';
import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationDefinitionVersionConflictError } from '@integrations/domain/exceptions/integration-definition-version-conflict.error';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import {
  access,
  definitions,
  enabledTools,
  storedAt,
  transaction,
} from '@integrations/integrations.resources.fake-spec';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { describe, expect, it } from 'vitest';

const deleting = (
  over: {
    isAdmin?: boolean;
    enabled?: ToolUses;
  } & Parameters<typeof definitions>[0] = {},
) => {
  const repository = definitions({ stored: storedAt(3), ...over });
  const handler = new DeleteIntegrationHandler(
    access(over.isAdmin),
    repository,
    enabledTools(over.enabled),
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
    repository,
  };
};

describe('DeleteIntegrationHandler', () => {
  it('deletes the requested version', async () => {
    const { remove, repository } = deleting();

    expect(await remove()).toEqual({ outcome: 'deleted' });

    const [saved] = repository.save.mock.calls[0] as [IntegrationDefinition];

    expect(saved.isDeleted).toBe(true);
  });

  it('does not delete a version no longer current, naming the current one', async () => {
    const { remove, repository } = deleting();

    expect(await remove(2)).toEqual({
      outcome: 'version-conflict',
      currentVersion: 3,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('names the version that won when a change got there first', async () => {
    const { remove } = deleting({
      failing: new IntegrationDefinitionVersionConflictError('linear'),
      thenAt: storedAt(4),
    });

    expect(await remove()).toEqual({
      outcome: 'version-conflict',
      currentVersion: 4,
    });
  });

  it('will not delete an integration whose tools a station enables', async () => {
    const { remove, repository } = deleting({
      stored: storedAt(3, ['linear.comment']),
      enabled: ToolUses.of([
        { tool: 'linear.comment', by: 'the station delivery/implementation' },
      ]),
    });

    expect(await remove()).toMatchObject({ outcome: 'in-use' });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('answers nothing for an integration it cannot find, and forbids one it may not delete', async () => {
    expect(await deleting({ stored: null }).remove()).toBeNull();
    expect(await deleting({ isAdmin: false }).remove()).toEqual(
      forbiddenTo('configure'),
    );
  });
});
