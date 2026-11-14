import type {
  RunApiGrantContract,
  RunOrderContract,
  RunPlacementContract,
  RunPolicyContract,
  RunRefusalContract,
  RunRequesterContract,
  RunRestoreContract,
  RunWorkingCopyContract,
} from '@runs/application/contracts/run-order.contract';
import type {
  AttachmentShape,
  HarnessSetupShape,
  RunCheckoutShape,
  RunCommandShape,
  RunResumeShape,
  RunSpecShape,
  SkillFileShape,
  ToolManifestShape,
} from '@runs/application/contracts/run-spec.contract';
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

const present = <K extends string, T>(
  key: K,
  value: JsonValue | undefined,
  decode: (value: JsonValue) => T,
): { [P in K]?: T } =>
  (value === undefined ? {} : { [key]: decode(value) }) as { [P in K]?: T };

const runCheckoutOf = (value: JsonValue): RunCheckoutShape => {
  const checkout = objectAt(value, 'spec checkout');

  return {
    remote: textAt(checkout.remote, 'spec checkout remote'),
    ...present('path', checkout.path, (each) =>
      textAt(each, 'spec checkout path'),
    ),
    ...present('branch', checkout.branch, (each) =>
      textAt(each, 'spec checkout branch'),
    ),
    ...present('ref', checkout.ref, (each) =>
      textAt(each, 'spec checkout ref'),
    ),
    ...present('diffOf', checkout.diffOf, (each) =>
      each === 'commits'
        ? ('commits' as const)
        : unreadable('spec checkout diff'),
    ),
    ...present('setup', checkout.setup, (each) =>
      textAt(each, 'spec checkout setup'),
    ),
  };
};

const commandOf = (value: JsonValue | undefined): RunCommandShape => {
  const command = objectAt(value, 'spec command');

  return {
    executable: textAt(command.executable, 'spec command executable'),
    args: textsAt(command.args, 'spec command args'),
    ...present('protocol', command.protocol, (each) =>
      each === 'acp/1' || each === 'acp/2'
        ? each
        : unreadable('spec command protocol'),
    ),
    ...present('env', command.env, (each) =>
      textRecordAt(each, 'spec command env'),
    ),
    ...present('sessionOptions', command.sessionOptions, (each) =>
      listAt(each, 'spec session options', (item) => {
        const option = objectAt(item, 'spec session option');

        return {
          id: textAt(option.id, 'spec session option id'),
          value: textAt(option.value, 'spec session option value'),
          ...present('optional', option.optional, (flag) =>
            flagAt(flag, 'spec session option optional'),
          ),
        };
      }),
    ),
  };
};

const handoverOf = (value: JsonValue | undefined): RunSpecShape['handover'] => {
  const handover = objectAt(value, 'spec handover');

  return {
    options: textsAt(handover.options, 'spec handover options'),
    noteLimit: numberAt(handover.noteLimit, 'spec handover note limit'),
  };
};

const resumeOf = (value: JsonValue | undefined): RunResumeShape => {
  const resume = objectAt(value, 'spec resume');

  return {
    ...present('sessionId', resume.sessionId, (each) =>
      textAt(each, 'spec resume session'),
    ),
    ...present('resumeSession', resume.resumeSession, (each) =>
      flagAt(each, 'spec resume session flag'),
    ),
  };
};

const skillFileOf = (value: JsonValue): SkillFileShape => {
  const file = objectAt(value, 'spec file');

  return {
    path: textAt(file.path, 'spec file path'),
    text: textAt(file.text, 'spec file text'),
  };
};

const manifestOf = (value: JsonValue): ToolManifestShape => {
  const tool = objectAt(value, 'spec tool');

  return {
    name: textAt(tool.name, 'spec tool name'),
    description: textAt(tool.description, 'spec tool description'),
    inputs: listAt(tool.inputs, 'spec tool inputs', (item) => {
      const input = objectAt(item, 'spec tool input');

      return {
        name: textAt(input.name, 'spec tool input name'),
        schema: objectAt(input.schema, 'spec tool input schema'),
        ...present('description', input.description, (each) =>
          textAt(each, 'spec tool input description'),
        ),
        required: flagAt(input.required, 'spec tool input required'),
        defaulted: flagAt(input.defaulted, 'spec tool input defaulted'),
        stdin: flagAt(input.stdin, 'spec tool input stdin'),
      };
    }),
    approval:
      tool.approval === null
        ? null
        : {
            because: textAt(
              objectAt(tool.approval, 'spec tool approval').because,
              'spec tool approval',
            ),
          },
    ...present('integration', tool.integration, (each) =>
      textAt(each, 'spec tool integration'),
    ),
    ...present('output', tool.output, (each) =>
      objectAt(each, 'spec tool output'),
    ),
  };
};

const attachmentOf = (value: JsonValue): AttachmentShape => {
  const attachment = objectAt(value, 'spec attachment');

  return {
    id: textAt(attachment.id, 'spec attachment id'),
    path: textAt(attachment.path, 'spec attachment path'),
  };
};

const harnessSetupOf = (value: JsonValue): HarnessSetupShape => {
  const setup = objectAt(value, 'spec harness setup');

  return {
    files: listAt(setup.files, 'spec harness files', skillFileOf),
    ...present('session', setup.session, (each) =>
      objectAt(each, 'spec harness session'),
    ),
    mcpServers: listAt(setup.mcpServers, 'spec mcp servers', (item) => {
      const server = objectAt(item, 'spec mcp server');

      return {
        name: textAt(server.name, 'spec mcp server name'),
        command: textAt(server.command, 'spec mcp server command'),
        args: textsAt(server.args, 'spec mcp server args'),
        env: listAt(server.env, 'spec mcp server env', (entry) => {
          const variable = objectAt(entry, 'spec mcp server variable');

          return {
            name: textAt(variable.name, 'spec mcp server variable name'),
            value: textAt(variable.value, 'spec mcp server variable value'),
          };
        }),
      };
    }),
    askKinds: textsAt(setup.askKinds, 'spec ask kinds'),
  };
};

const specOf = (value: JsonValue | undefined): RunSpecShape => {
  const spec = objectAt(value, 'spec');
  const flag = (what: string) => (each: JsonValue) => flagAt(each, what);
  const texts = (what: string) => (each: JsonValue) => textsAt(each, what);

  return {
    ...present('checkouts', spec.checkouts, (each) =>
      listAt(each, 'spec checkouts', runCheckoutOf),
    ),
    command: commandOf(spec.command),
    briefing: textAt(spec.briefing, 'spec briefing'),
    handover: handoverOf(spec.handover),
    resume: resumeOf(spec.resume),
    ...present('skills', spec.skills, (each) =>
      listAt(each, 'spec skills', skillFileOf),
    ),
    ...present('skillHomes', spec.skillHomes, texts('spec skill homes')),
    ...present('manifest', spec.manifest, (each) =>
      listAt(each, 'spec manifest', manifestOf),
    ),
    ...present('catalog', spec.catalog, texts('spec catalog')),
    ...present('attachments', spec.attachments, (each) =>
      listAt(each, 'spec attachments', attachmentOf),
    ),
    ...present('diffs', spec.diffs, flag('spec diffs')),
    ...present('check', spec.check, (each) => textAt(each, 'spec check')),
    ...present(
      'startingPoint',
      spec.startingPoint,
      flag('spec starting point'),
    ),
    ...present('harnessSetup', spec.harnessSetup, harnessSetupOf),
    ...present('settingFiles', spec.settingFiles, texts('spec setting files')),
    ...present(
      'injectedSecrets',
      spec.injectedSecrets,
      texts('spec injected secrets'),
    ),
    ...present('spotlightApi', spec.spotlightApi, flag('spec spotlight api')),
  };
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

const workingCopyJson = (
  workingCopy: RunWorkingCopyContract | null,
): JsonObject | null =>
  workingCopy && {
    key: workingCopy.key,
    rejoinable: workingCopy.rejoinable,
    restores: workingCopy.restores,
  };

const restoresOf = (
  value: JsonValue | undefined,
): RunWorkingCopyContract['restores'] =>
  value === 'always' || value === 'when-continuing'
    ? value
    : unreadable('working copy restores');

const workingCopyOf = (
  value: JsonValue | undefined,
): RunWorkingCopyContract | null => {
  if (value === null) {
    return null;
  }

  const workingCopy = objectAt(value, 'working copy');

  return {
    key: textAt(workingCopy.key, 'working copy key'),
    rejoinable: flagAt(workingCopy.rejoinable, 'working copy rejoinable'),
    restores: restoresOf(workingCopy.restores),
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
        workingCopy: workingCopyJson(order.workingCopy),
        restore: restoreJson(order.restore),
        extensions: jsonOf(order.extensions, 'extensions'),
        apiGrant: apiGrantJson(order.apiGrant),
        tags: { ...order.tags },
        line: order.line,
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
      workingCopy: workingCopyOf(stored.workingCopy),
      restore: restoreOf(stored.restore),
      extensions: objectAt(stored.extensions, 'extensions'),
      apiGrant: apiGrantOf(stored.apiGrant),
      tags: textRecordAt(stored.tags, 'tags'),
      line: stored.line === null ? null : textAt(stored.line, 'line'),
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
