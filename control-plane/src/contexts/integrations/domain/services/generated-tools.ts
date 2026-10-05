import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import type { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import type { OperationFilter } from '@integrations/domain/value-objects/operation-filter.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { APPROVAL_INTENT_INPUT } from '@shared-kernel/domain/value-objects/approval-intent-input';

export const GENERATED_AT_MOST = 1000;

export type ApprovalOverride = ApprovalNeeded | false;

export interface GeneratedTools {
  readonly tools: readonly OfferedTool[];
  readonly passedOver: readonly string[];
}

const approvalFor = (
  operation: DescribedOperation,
  integration: string,
  overrides: ReadonlyMap<string, ApprovalOverride>,
  by: string,
): ApprovalNeeded | null => {
  const override = overrides.get(operation.name);

  if (override !== undefined) {
    return override === false ? null : override;
  }

  return operation.writes
    ? ApprovalNeeded.of({ because: `It changes data in ${integration}.` }, by)
    : null;
};

export const generatedTools = (input: {
  source: SourceKey;
  integration: string;
  described: DescribedSource;
  hash: ContentHash;
  operations: readonly DescribedOperation[];
  filter: OperationFilter;
  approvals: ReadonlyMap<string, ApprovalOverride>;
  handWritten: readonly string[];
}): GeneratedTools => {
  const kind = input.described.kind;
  const chosen = input.operations.filter(
    (each) =>
      input.filter.admits(each.name) && !input.handWritten.includes(each.name),
  );

  if (chosen.length > GENERATED_AT_MOST) {
    throw new InvalidIntegrationError(
      input.source.value,
      `offers ${chosen.length} tools from its ${input.described.described}, more than the ${GENERATED_AT_MOST} a station can choose between; name the ones it offers in ${kind}.tools.include`,
    );
  }

  const tools: OfferedTool[] = [];
  const passedOver: string[] = [];

  for (const operation of chosen) {
    const approval = approvalFor(
      operation,
      input.integration,
      input.approvals,
      `${kind}.tools.approval.${operation.name}`,
    );

    if (approval && operation.takes(APPROVAL_INTENT_INPUT)) {
      passedOver.push(
        `passes over ${operation.name}, which needs approval and takes ${APPROVAL_INTENT_INPUT}, the input Spotlight keeps for the agent to say what it wants to do; switch its approval off in ${kind}.tools.approval to offer it`,
      );
      continue;
    }

    tools.push(
      OfferedTool.of({
        source: input.source,
        name: operation.name,
        description: operation.description,
        backing: ToolBacking.operation(input.hash, operation.name),
        approval,
        inputs: operation.inputs.map((each) => ({
          name: each.name,
          schema: each.schema,
          description: each.description,
          required: each.required,
          defaulted: false,
          piped: false,
        })),
      }),
    );
  }

  return { tools, passedOver };
};
