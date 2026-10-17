import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { OperationFilter } from '@integrations/domain/value-objects/operation-filter.vo';
import { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import type { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { APPROVAL_INTENT_INPUT } from '@shared-kernel/domain/value-objects/approval-intent-input';

export const MAX_GENERATED = 1000;

export type ApprovalOverride = ApprovalNeeded | false;

export interface GeneratedTools {
  readonly tools: readonly ProvidedTool[];
  readonly skipped: readonly string[];
}

const approvalFor = (
  operation: SpecOperation,
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
  integration: IntegrationKey;
  integrationName: string;
  spec: ApiSpec;
  hash: ContentHash;
  operations: readonly SpecOperation[];
  filter: OperationFilter;
  approvals: ReadonlyMap<string, ApprovalOverride>;
  handWritten: readonly string[];
}): GeneratedTools => {
  const kind = input.spec.kind;
  const chosen = input.operations.filter(
    (each) =>
      input.filter.matches(each.name) && !input.handWritten.includes(each.name),
  );

  if (chosen.length > MAX_GENERATED) {
    throw new InvalidIntegrationError(
      input.integration.value,
      `offers ${chosen.length} tools from its ${input.spec.label}. A station can choose between at most ${MAX_GENERATED} tools. Please name the tools to offer in ${kind}.tools.include`,
    );
  }

  const tools: ProvidedTool[] = [];
  const skipped: string[] = [];

  for (const operation of chosen) {
    const approval = approvalFor(
      operation,
      input.integrationName,
      input.approvals,
      `${kind}.tools.approval.${operation.name}`,
    );

    if (approval && operation.takes(APPROVAL_INTENT_INPUT)) {
      skipped.push(
        `skips ${operation.name}. It needs approval and takes ${APPROVAL_INTENT_INPUT}, an input that Spotlight reserves for the agent to say what it wants to do. To offer it, switch its approval off in ${kind}.tools.approval`,
      );
      continue;
    }

    tools.push(
      ProvidedTool.of({
        integration: input.integration,
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
          stdin: false,
        })),
      }),
    );
  }

  return { tools, skipped };
};
