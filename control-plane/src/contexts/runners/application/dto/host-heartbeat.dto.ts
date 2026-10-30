import type { Forbidden } from '@shared-kernel/application/dto/resource-outcomes.dto';

export type HostHeartbeatDto =
  | {
      readonly outcome: 'accepted';
      readonly workspaceId: string;
      readonly drain: readonly string[];
    }
  | { readonly outcome: 'host-in-use' }
  | { readonly outcome: 'unauthorized' };

export type HostDeregisteredDto =
  | { readonly outcome: 'deregistered' }
  | { readonly outcome: 'unauthorized' };

export type HostDeletedDto = { readonly outcome: 'deleted' } | Forbidden;
