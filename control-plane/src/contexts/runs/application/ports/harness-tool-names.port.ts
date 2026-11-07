export const HARNESS_TOOL_NAMES = Symbol('HARNESS_TOOL_NAMES');

export interface HarnessToolName {
  readonly server: string;
  readonly tool: string;
}

export interface HarnessToolNamesPort {
  toolFor(title: string, kind: string): HarnessToolName | null;
}
