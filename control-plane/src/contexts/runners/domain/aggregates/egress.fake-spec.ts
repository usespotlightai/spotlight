import { Egress } from '@runners/domain/aggregates/egress.aggregate';
import { hashOf } from '@runners/domain/aggregates/runner-pool.fake-spec';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const EGRESS_ID = EgressId.of('egress_1');

export const anEgress = (
  input: {
    id?: EgressId;
    workspaceId?: WorkspaceId;
    url?: string;
    tokenVersion?: number | null;
  } = {},
): Egress =>
  Egress.create({
    id: input.id ?? EGRESS_ID,
    workspaceId: input.workspaceId ?? WorkspaceId.of('ws_1'),
    key: EgressKey.of('shared'),
    url: EgressUrl.of(input.url ?? 'https://egress.example.com'),
    token: { tokenHash: hashOf('9'), tokenVersion: input.tokenVersion ?? 1 },
    by: changeActorIn(),
  });
