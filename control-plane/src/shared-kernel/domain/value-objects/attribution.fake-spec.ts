import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import {
  ConfigurationChange,
  type ConfiguredResource,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const actorFor = (userId = 'user_1'): Actor =>
  Actor.of(PersonPrincipal.of(UserId.of(userId)), Client.named('web'));

export const attributedIn = (
  workspaceId: string | WorkspaceId = 'ws_1',
  actor: Actor = actorFor(),
): Attribution =>
  Attribution.of(
    actor,
    typeof workspaceId === 'string' ? WorkspaceId.of(workspaceId) : workspaceId,
  );

export const changed = (
  resource: ConfiguredResource,
  id: string,
  key: string,
): ConfigurationChange =>
  ConfigurationChange.updated({ resource, id, key }, attributedIn());
