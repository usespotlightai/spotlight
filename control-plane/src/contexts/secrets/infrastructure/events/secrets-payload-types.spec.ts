import { EventCodec } from '@platform/events/event-codec';
import { PayloadTypes } from '@platform/events/payload-types';
import { SHARED_KERNEL_PAYLOAD_TYPES } from '@platform/events/shared-kernel-payload-types';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import { SECRETS_PAYLOAD_TYPES } from '@secrets/infrastructure/events/secrets-payload-types';
import { BY, definition, NOW } from '@secrets/testing/secrets.fakes.fake-spec';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { SECRET } from '@shared-kernel/domain/value-objects/secret';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const typesIn = (encoded: unknown): readonly string[] => {
  if (Array.isArray(encoded)) {
    return encoded.flatMap(typesIn);
  }

  if (typeof encoded !== 'object' || encoded === null) {
    return [];
  }

  return Object.entries(encoded).flatMap(([key, each]) =>
    key === '$type' && typeof each === 'string' ? [each] : typesIn(each),
  );
};

const everyEvent = (): readonly DomainEvent[] => {
  const created = Secret.create(definition(), {
    id: SecretId.of('secret_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    by: BY,
    at: NOW,
  });
  const stored = Secret.rehydrate({
    id: created.id,
    workspaceId: created.workspaceId,
    name: created.name,
    source: created.source,
    bindings: created.bindings,
    valueVersion: created.valueVersion,
    rotatedAt: created.rotatedAt,
    version: 1,
  });

  return [
    ...created.pullEvents(),
    ...stored
      .update(definition({ value: 'lin_api_2', valueVersion: 2 }), BY, NOW)
      .pullEvents(),
    ...stored.delete(SecretUses.none(), BY).pullEvents(),
  ];
};

describe('SECRETS_PAYLOAD_TYPES', () => {
  const types = new PayloadTypes();

  types.register('shared-kernel', SHARED_KERNEL_PAYLOAD_TYPES);
  types.register('secrets', SECRETS_PAYLOAD_TYPES);

  it('holds every class a secrets event carries, and nothing else', () => {
    const codec = new EventCodec(types);
    const carried = new Set(
      everyEvent().flatMap((event) => typesIn(codec.encode(event))),
    );

    expect(
      SECRETS_PAYLOAD_TYPES.map((type) => `secrets.${type.name}`).filter(
        (name) => !carried.has(name),
      ),
    ).toEqual([]);
  });

  it('contains no secret, which must never travel in an event', () => {
    expect(
      SECRETS_PAYLOAD_TYPES.filter((type) => SECRET in type.prototype).map(
        (type) => type.name,
      ),
    ).toEqual([]);
  });
});
