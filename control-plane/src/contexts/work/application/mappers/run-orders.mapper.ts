import type {
  RunApiGrantContract,
  RunOrderContract,
  RunPlacementContract,
  RunPolicyContract,
  RunRefusalContract,
  RunRequesterContract,
  RunRestoreContract,
  RunWorkspaceContract,
} from '@runs/application/contracts/run-order.contract';
import type { RunSpecShape } from '@runs/application/contracts/run-spec.contract';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import {
  isJsonObject,
  isJsonValue,
  type JsonObject,
  type JsonValue,
} from '@shared-kernel/domain/json-value';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  TrialCheckout,
  TrialOrder,
  TrialOrdering,
} from '@work/application/ports/station-trials.port';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';

type OrderedTrial = Extract<TrialOrdering, { outcome: 'ordered' }>;

const unreadable = (what: string): never => {
  throw new InconsistentStateError(
    'dispatch',
    `has an order whose ${what} no longer reads`,
  );
};

const objectAt = (value: JsonValue | undefined, what: string): JsonObject =>
  isJsonObject(value) ? value : unreadable(what);

const textAt = (value: JsonValue | undefined, what: string): string =>
  typeof value === 'string' ? value : unreadable(what);

const textOrNullAt = (
  value: JsonValue | undefined,
  what: string,
): string | null => (value === null ? null : textAt(value, what));

const numberAt = (value: JsonValue | undefined, what: string): number =>
  typeof value === 'number' ? value : unreadable(what);

const flagAt = (value: JsonValue | undefined, what: string): boolean =>
  typeof value === 'boolean' ? value : unreadable(what);

const listAt = <T>(
  value: JsonValue | undefined,
  what: string,
  each: (item: JsonValue) => T,
): T[] => (Array.isArray(value) ? value.map(each) : unreadable(what));

const textsAt = (value: JsonValue | undefined, what: string): string[] =>
  listAt(value, what, (item) => textAt(item, what));

const textRecordAt = (
  value: JsonValue | undefined,
  what: string,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(objectAt(value, what)).map(([key, each]) => [
      key,
      textAt(each, what),
    ]),
  );

const jsonOf = (value: unknown, what: string): JsonValue => {
  const encoded: unknown = JSON.parse(JSON.stringify(value));

  return isJsonValue(encoded) ? encoded : unreadable(what);
};

const placementJson = (placement: RunPlacementContract): JsonObject => ({
  labelGroups: placement.labelGroups.map((group) => [...group]),
  image: placement.image,
});

const placementOf = (value: JsonValue | undefined): RunPlacementContract => {
  const placement = objectAt(value, 'placement');

  return {
    labelGroups: listAt(placement.labelGroups, 'label groups', (group) =>
      textsAt(group, 'label group'),
    ),
    image: textOrNullAt(placement.image, 'image'),
  };
};

const specOf = (value: JsonValue | undefined): RunSpecShape => {
  const spec = objectAt(value, 'spec');

  objectAt(spec.command, 'spec command');
  objectAt(spec.handover, 'spec handover');
  objectAt(spec.resume, 'spec resume');
  textAt(spec.briefing, 'spec briefing');

  return spec as unknown as RunSpecShape;
};

const requesterJson = (requester: RunRequesterContract): JsonObject => ({
  owner: requester.owner,
  kind: requester.kind,
  id: requester.id,
  token: requester.token,
  team: requester.team,
});

const requesterOf = (value: JsonValue | undefined): RunRequesterContract => {
  const requester = objectAt(value, 'requester');

  return {
    owner: textAt(requester.owner, 'requester owner'),
    kind: textAt(requester.kind, 'requester kind'),
    id: textAt(requester.id, 'requester id'),
    token: textOrNullAt(requester.token, 'requester token'),
    team: textOrNullAt(requester.team, 'requester team'),
  };
};

const policyJson = (policy: RunPolicyContract): JsonObject => ({
  holdsTurn: policy.holdsTurn,
  gated: policy.gated,
  actsBeyondItself: policy.actsBeyondItself,
  asks: policy.asks,
  listed: policy.listed,
  exclusive: policy.exclusive,
});

const asksOf = (value: JsonValue | undefined): RunPolicyContract['asks'] =>
  value === 'requester' || value === 'recorded'
    ? value
    : unreadable('policy asks');

const policyOf = (value: JsonValue | undefined): RunPolicyContract => {
  const policy = objectAt(value, 'policy');

  return {
    holdsTurn: flagAt(policy.holdsTurn, 'policy holdsTurn'),
    gated: flagAt(policy.gated, 'policy gated'),
    actsBeyondItself: flagAt(policy.actsBeyondItself, 'policy reach'),
    asks: asksOf(policy.asks),
    listed: flagAt(policy.listed, 'policy listed'),
    exclusive: flagAt(policy.exclusive, 'policy exclusive'),
  };
};

const workspaceJson = (
  workspace: RunWorkspaceContract | null,
): JsonObject | null =>
  workspace && {
    key: workspace.key,
    rejoinable: workspace.rejoinable,
    restores: workspace.restores,
  };

const restoresOf = (
  value: JsonValue | undefined,
): RunWorkspaceContract['restores'] =>
  value === 'always' || value === 'when-continuing'
    ? value
    : unreadable('workspace restores');

const workspaceOf = (
  value: JsonValue | undefined,
): RunWorkspaceContract | null => {
  if (value === null) {
    return null;
  }

  const workspace = objectAt(value, 'workspace');

  return {
    key: textAt(workspace.key, 'workspace key'),
    rejoinable: flagAt(workspace.rejoinable, 'workspace rejoinable'),
    restores: restoresOf(workspace.restores),
  };
};

const restoreJson = (restore: RunRestoreContract | null): JsonObject | null =>
  restore && { archive: restore.archive };

const restoreOf = (value: JsonValue | undefined): RunRestoreContract | null =>
  value === null
    ? null
    : { archive: textAt(objectAt(value, 'restore').archive, 'archive') };

const apiGrantJson = (grant: RunApiGrantContract | null): JsonObject | null =>
  grant && {
    actingFor: grant.actingFor,
    scopes: [...grant.scopes],
    lifetimeMs: grant.lifetimeMs,
  };

const apiGrantOf = (
  value: JsonValue | undefined,
): RunApiGrantContract | null => {
  if (value === null) {
    return null;
  }

  const grant = objectAt(value, 'api grant');

  return {
    actingFor: textAt(grant.actingFor, 'api grant actor'),
    scopes: textsAt(grant.scopes, 'api grant scopes'),
    lifetimeMs: numberAt(grant.lifetimeMs, 'api grant lifetime'),
  };
};

const refusalJson = (
  refusal: readonly RunRefusalContract[] | null,
): JsonValue =>
  refusal?.map((each) => ({ description: each.description })) ?? null;

const refusalOf = (
  value: JsonValue | undefined,
): readonly RunRefusalContract[] | null =>
  value === null
    ? null
    : listAt(value, 'refusals', (each) => ({
        description: textAt(objectAt(each, 'refusal').description, 'refusal'),
      }));

const trialOrderJson = (order: TrialOrder): JsonObject => ({
  runId: order.runId,
  workspaceId: order.workspaceId,
  team: order.team,
  harness: order.harness,
  priority: order.priority,
  placement: placementJson(order.placement),
  spec: jsonOf(order.spec, 'spec'),
  restore: restoreJson(order.restore),
  refusal: refusalJson(order.refusal),
});

const trialOrderOf = (value: JsonValue | undefined): TrialOrder => {
  const order = objectAt(value, 'trial order');

  return {
    runId: textAt(order.runId, 'run id'),
    workspaceId: textAt(order.workspaceId, 'workspace'),
    team: textAt(order.team, 'team'),
    harness: textAt(order.harness, 'harness'),
    priority: numberAt(order.priority, 'priority'),
    placement: placementOf(order.placement),
    spec: specOf(order.spec),
    restore: restoreOf(order.restore),
    refusal: refusalOf(order.refusal),
  };
};

const checkoutJson = (checkout: TrialCheckout): JsonObject => ({
  path: checkout.path,
  repository: checkout.repository,
  commit: checkout.commit,
});

const checkoutOf = (value: JsonValue): TrialCheckout => {
  const checkout = objectAt(value, 'trial checkout');

  return {
    path: textAt(checkout.path, 'checkout path'),
    repository: textAt(checkout.repository, 'checkout repository'),
    commit: textAt(checkout.commit, 'checkout commit'),
  };
};

export const RunOrdersMapper = {
  toDispatchOrder(order: RunOrderContract): DispatchOrder {
    return DispatchOrder.of({
      kind: 'run',
      runId: RunId.of(order.runId),
      snapshot: {
        runId: order.runId,
        workspaceId: order.workspaceId,
        harness: order.harness,
        priority: order.priority,
        placement: placementJson(order.placement),
        spec: jsonOf(order.spec, 'spec'),
        requester: requesterJson(order.requester),
        policy: policyJson(order.policy),
        workspace: workspaceJson(order.workspace),
        restore: restoreJson(order.restore),
        extensions: jsonOf(order.extensions, 'extensions'),
        apiGrant: apiGrantJson(order.apiGrant),
        tags: { ...order.tags },
        refusal: refusalJson(order.refusal),
      },
    });
  },

  toRunOrder(order: DispatchOrder): RunOrderContract {
    if (order.kind !== 'run') {
      return unreadable('kind');
    }

    const stored = order.snapshot;

    return {
      runId: textAt(stored.runId, 'run id'),
      workspaceId: textAt(stored.workspaceId, 'workspace'),
      harness: textAt(stored.harness, 'harness'),
      priority: numberAt(stored.priority, 'priority'),
      placement: placementOf(stored.placement),
      spec: specOf(stored.spec),
      requester: requesterOf(stored.requester),
      policy: policyOf(stored.policy),
      workspace: workspaceOf(stored.workspace),
      restore: restoreOf(stored.restore),
      extensions: objectAt(stored.extensions, 'extensions'),
      apiGrant: apiGrantOf(stored.apiGrant),
      tags: textRecordAt(stored.tags, 'tags'),
      refusal: refusalOf(stored.refusal),
    };
  },

  fromTrialOrdering(ordering: OrderedTrial): DispatchOrder {
    return DispatchOrder.of({
      kind: 'trial',
      runId: RunId.of(ordering.order.runId),
      snapshot: {
        order: trialOrderJson(ordering.order),
        fingerprint: ordering.fingerprint,
        checkouts: ordering.checkouts.map(checkoutJson),
        movesOnAfter: [...ordering.movesOnAfter],
      },
    });
  },

  toTrialOrdering(order: DispatchOrder): OrderedTrial {
    if (order.kind !== 'trial') {
      return unreadable('kind');
    }

    const stored = order.snapshot;

    return {
      outcome: 'ordered',
      order: trialOrderOf(stored.order),
      fingerprint: textOrNullAt(stored.fingerprint, 'fingerprint'),
      checkouts: listAt(stored.checkouts, 'trial checkouts', checkoutOf),
      movesOnAfter: textsAt(stored.movesOnAfter, 'moves on after'),
    };
  },
};
