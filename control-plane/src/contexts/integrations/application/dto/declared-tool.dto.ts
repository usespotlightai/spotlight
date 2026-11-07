import type { JsonObject, JsonValue } from '@shared-kernel/domain/json-value';

export type ToolCallInputs = Readonly<Record<string, JsonValue>>;

export interface DeclaredToolInput {
  readonly name: string;
  readonly schema: JsonObject;
  readonly description: string | null;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly stdin: boolean;
}

export interface DeclaredTool {
  readonly tool: string;
  readonly integrationName: string;
  readonly description: string;
  readonly inputs: readonly DeclaredToolInput[];
  readonly approval: { readonly because: string } | null;
  readonly inferredOutput: JsonObject | null;
}
