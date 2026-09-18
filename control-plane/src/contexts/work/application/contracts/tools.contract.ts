export const TOOL_INPUT_TYPES = ['string', 'number', 'boolean'] as const;

export type ToolInputType = (typeof TOOL_INPUT_TYPES)[number];

export type ToolInputValue = string | number | boolean;

export type ToolInputValues = Readonly<Record<string, ToolInputValue>>;

export interface ToolInputDeclaration {
  readonly name: string;
  readonly type: ToolInputType;
  readonly description: string | null;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly piped: boolean;
}

export interface ApprovalDeclaration {
  readonly because: string;
}

export interface ToolDeclaration {
  readonly tool: string;
  readonly description: string;
  readonly inputs: readonly ToolInputDeclaration[];
  readonly approval: ApprovalDeclaration | null;
}
