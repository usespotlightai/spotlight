import type {
  JsonObject,
  JsonValue,
} from '@shared-kernel/domain/services/json-value';

export type ToolInputValues = Readonly<Record<string, JsonValue>>;

interface ToolInputDeclaration {
  readonly name: string;
  readonly schema: JsonObject;
  readonly description: string | null;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly piped: boolean;
}

interface ApprovalDeclaration {
  readonly because: string;
}

export interface ToolDeclaration {
  readonly tool: string;
  readonly integrationName: string;
  readonly description: string;
  readonly inputs: readonly ToolInputDeclaration[];
  readonly approval: ApprovalDeclaration | null;
}
