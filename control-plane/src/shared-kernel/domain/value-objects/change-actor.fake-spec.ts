import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
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

export const changeActorIn = (
  workspaceId: string | WorkspaceId = 'ws_1',
  actor: Actor = actorFor(),
): ChangeActor =>
  ChangeActor.of(
    actor,
    typeof workspaceId === 'string' ? WorkspaceId.of(workspaceId) : workspaceId,
  );

export const changed = (
  resource: ConfiguredResource,
  id: string,
  key: string,
): ConfigurationChange =>
  ConfigurationChange.updated({ resource, id, key }, changeActorIn());
