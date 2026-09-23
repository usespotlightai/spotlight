import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type {
  Happened,
  MarkWorn,
} from '@work/application/contracts/happenings.contract';
import type {
  ToolDeclaration,
  ToolInputDeclaration,
  ToolInputValues,
} from '@work/application/contracts/tools.contract';

interface BoundTaskWaiting {
  readonly conversationId: string;
  readonly said: string;
  readonly awaitsApproval: boolean;
}

export interface BoundTask {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly line: string;
  readonly station: string;
  readonly stationKey: string;
  readonly marks: Readonly<Record<string, string>>;
  readonly waiting: BoundTaskWaiting | null;
}

export const INTEGRATION_RUNTIME = Symbol('INTEGRATION_RUNTIME');

export interface Reach {
  readonly connection: AccessToken | null;
}

export interface HostRefusal {
  readonly status: number;
  readonly said: string;
}

export type ToolOutput =
  | null
  | boolean
  | number
  | string
  | readonly ToolOutput[]
  | { readonly [field: string]: ToolOutput };

export type Polled =
  | {
      readonly kind: 'read';
      readonly cursor: string | null;
      readonly happenings: readonly Happened[];
    }
  | { readonly kind: 'refused'; readonly refusal: HostRefusal };

export type Acted =
  | { readonly kind: 'done' }
  | { readonly kind: 'refused'; readonly refusal: HostRefusal }
  | { readonly kind: 'nothing-to-do' };

export interface TaskWord {
  readonly task: BoundTask;
  readonly ask: {
    readonly body: string;
    readonly link: string | null;
    readonly station: string;
  };
}

export type Posted =
  | { readonly kind: 'posted'; readonly marks: readonly MarkWorn[] }
  | { readonly kind: 'unaddressed' }
  | {
      readonly kind: 'refused';
      readonly refusal: HostRefusal;
      readonly target: Readonly<Record<string, string>>;
    };

export type Renewed =
  | { readonly kind: 'renewed'; readonly grant: HostGrant }
  | { readonly kind: 'refused' }
  | { readonly kind: 'unrenewable' };

export interface ReachableTool {
  readonly integration: Integration;
  readonly declared: ToolDeclaration;
  defaultFor(input: ToolInputDeclaration): unknown;
  call(inputs: ToolInputValues, reach: Reach): Promise<ToolOutput>;
}

export interface IntegrationRuntimePort {
  integrations(
    definitions: readonly DefinedIntegration[],
  ): readonly Integration[];

  poll(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    cursor: string | null,
    reach: Reach,
  ): Promise<Polled>;

  runSchedule(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    reach: Reach,
  ): Promise<Acted>;

  post(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    event: string,
    word: TaskWord,
    reach: Reach,
  ): Promise<Posted>;

  tool(
    definitions: readonly DefinedIntegration[],
    tool: string,
    task: BoundTask,
  ): ReachableTool | null;

  renew(
    definitions: readonly DefinedIntegration[],
    source: SourceKey,
    refreshToken: AccessToken,
  ): Promise<Renewed>;
}
