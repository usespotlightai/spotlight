import type { JsonObject } from '@shared-kernel/domain/json-value';

// Do not send a host address to a runner. Name each remote as Spotlight serves it.
export const REMOTE_VIA_GIT_PROXY = 'spotlight:repository';

export const TRACE_PARENT_VAR = 'TRACEPARENT';

export const SKILL_FILE = 'SKILL.md';

export const checkoutPathOf = (repository: { readonly name: string }): string =>
  repository.name;

export interface RunCheckoutShape {
  readonly remote: string;
  readonly path?: string;
  readonly branch?: string;
  readonly ref?: string;
  readonly diffOf?: 'commits';
  readonly setup?: string;
}

interface SessionOptionShape {
  readonly id: string;
  readonly value: string;
  readonly optional?: boolean;
}

export interface RunCommandShape {
  readonly executable: string;
  readonly args: readonly string[];
  readonly protocol?: 'acp/1' | 'acp/2';
  readonly env?: Readonly<Record<string, string>>;
  readonly sessionOptions?: readonly SessionOptionShape[];
}

interface RunHandoverShape {
  readonly options: readonly string[];
  readonly noteLimit: number;
}

export interface RunResumeShape {
  readonly sessionId?: string;
  readonly resumeSession?: boolean;
}

interface ToolInputShape {
  readonly name: string;
  readonly schema: JsonObject;
  readonly description?: string;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly stdin: boolean;
}

export interface ToolManifestShape {
  readonly name: string;
  readonly description: string;
  readonly inputs: readonly ToolInputShape[];
  readonly approval: { readonly because: string } | null;
  readonly integration?: string;
  readonly output?: JsonObject;
}

export interface SkillFileShape {
  readonly path: string;
  readonly text: string;
}

interface McpServerSetupShape {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: readonly { readonly name: string; readonly value: string }[];
}

export interface HarnessSetupShape {
  readonly files: readonly SkillFileShape[];
  readonly session?: Readonly<Record<string, unknown>>;
  readonly mcpServers: readonly McpServerSetupShape[];
  readonly askKinds: readonly string[];
}

export interface AttachmentShape {
  readonly id: string;
  readonly path: string;
}

export interface RunSpecShape {
  readonly checkouts?: readonly RunCheckoutShape[];
  readonly command: RunCommandShape;
  readonly briefing: string;
  readonly handover: RunHandoverShape;
  readonly resume: RunResumeShape;
  readonly skills?: readonly SkillFileShape[];
  readonly skillHomes?: readonly string[];
  readonly manifest?: readonly ToolManifestShape[];
  readonly catalog?: readonly string[];
  readonly attachments?: readonly AttachmentShape[];
  readonly diffs?: boolean;
  readonly check?: string;
  readonly startingPoint?: boolean;
  readonly harnessSetup?: HarnessSetupShape;
  readonly settingFiles?: readonly string[];
  readonly injectedSecrets?: readonly string[];
  readonly harnessKeys?: readonly string[];
  readonly spotlightApi?: boolean;
}
