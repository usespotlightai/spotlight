import type {
  DeclaredTool,
  ToolCallInputs,
} from '@integrations/application/dto/declared-tool.dto';
import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { TaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { CallFailureFact } from '@integrations/domain/value-objects/hook-failure.vo';
import type { Integration } from '@integrations/domain/value-objects/integration.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import type { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import type { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
import type { VerifyingSecret } from '@secrets/application/contracts/verifying-secret.contract';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  Happened,
  TaskMark,
} from '@work/application/contracts/happenings.contract';

export interface NoticeFileView {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export const INTEGRATION_RUNTIME = Symbol('INTEGRATION_RUNTIME');

export interface Credentials {
  injectedFor(
    url: string,
    secrets: readonly string[],
  ): Promise<InjectedSecrets>;

  standInsFor(
    url: string,
    secrets: readonly string[],
  ): Promise<InjectedSecrets>;
}

export interface SigningSecrets {
  named(secret: string): Promise<VerifyingSecret>;
}

export interface ActiveConnection {
  readonly token: AccessToken;
  readonly owner: ConnectionOwner;
  readonly linkedAccount: string | null;
  unauthorized(token: AccessToken): Promise<AccessToken | null>;
}

export interface CallAuth {
  workspace(): Promise<string>;
  readonly connection: ActiveConnection | null;
  readonly credentials: Credentials;
}

export interface ServiceError {
  readonly status: number;
  readonly output: string;
}

export type ToolOutput =
  | null
  | boolean
  | number
  | string
  | readonly ToolOutput[]
  | { readonly [field: string]: ToolOutput };

export type PollResult =
  | {
      readonly kind: 'read';
      readonly cursor: string | null;
      readonly happenings: readonly Happened[];
    }
  | { readonly kind: 'failed'; readonly error: ServiceError };

export type ActionResult =
  | { readonly kind: 'done' }
  | { readonly kind: 'failed'; readonly error: ServiceError }
  | { readonly kind: 'nothing-to-do' };

export interface TaskPayload {
  readonly task: TaskView;
  readonly ask: {
    readonly body: string;
    readonly link: string | null;
    readonly station: string;
    readonly attachments: readonly NoticeFileView[];
  };
}

interface ProposalView {
  readonly number: number;
  readonly title: string;
  readonly line: string | null;
  readonly station: string | null;
}

export interface ChatPayload {
  readonly chat: { readonly marks: Readonly<Record<string, string>> };
  readonly reply: {
    readonly body: string;
    readonly link: string | null;
    readonly proposals: readonly ProposalView[];
  };
}

export type NoticePayload = TaskPayload | ChatPayload;

export type PostResult =
  | { readonly kind: 'posted'; readonly marks: readonly TaskMark[] }
  | { readonly kind: 'unaddressed' }
  | {
      readonly kind: 'failed';
      readonly error: ServiceError;
      readonly target: Readonly<Record<string, string>>;
    };

export type RefreshResult =
  | { readonly kind: 'refreshed'; readonly tokens: OAuthTokens }
  | { readonly kind: 'failed' }
  | { readonly kind: 'not-refreshable' };

export type CallAttempt =
  | { readonly kind: 'answered'; readonly output: ToolOutput }
  | { readonly kind: 'timed-out' }
  | { readonly kind: 'failed'; readonly fact: CallFailureFact };

export interface ResolvedTool {
  readonly integration: Integration;
  readonly provided: ProvidedTool;
  readonly declared: DeclaredTool;
  readonly injectedSecrets: readonly string[];
  defaultFor(input: string): unknown;
  call(inputs: ToolCallInputs, callAuth: CallAuth): Promise<ToolOutput>;
  attempt(
    inputs: ToolCallInputs,
    callAuth: CallAuth,
    withinMs: number,
  ): Promise<CallAttempt>;
}

export interface IntegrationRuntimePort {
  integrations(
    definitions: readonly DefinedIntegration[],
  ): readonly Integration[];

  poll(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    cursor: string | null,
    callAuth: CallAuth,
  ): Promise<PollResult>;

  runSchedule(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    callAuth: CallAuth,
  ): Promise<ActionResult>;

  post(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    event: string,
    payload: NoticePayload,
    callAuth: CallAuth,
  ): Promise<readonly PostResult[]>;

  tool(
    definitions: readonly DefinedIntegration[],
    tool: string,
    task: TaskView,
  ): Promise<ResolvedTool | null>;

  refresh(
    definitions: readonly DefinedIntegration[],
    owner: { readonly teamId: TeamId; readonly workspaceId: WorkspaceId },
    integration: IntegrationKey,
    refreshToken: AccessToken,
  ): Promise<RefreshResult>;
}
