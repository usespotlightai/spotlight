import type { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { BranchPushRefusal } from '@work/domain/value-objects/branch-push-refusal';
import type { Branch } from '@work/domain/value-objects/branch.vo';

export type ChatRefusal =
  | { readonly kind: 'approval-needs-a-task'; readonly tool: Tool }
  | {
      readonly kind: 'connection-needs-a-task';
      readonly providedBy: string;
    }
  | BranchPushRefusal
  | { readonly kind: 'push-to-default-branch'; readonly branch: Branch }
  | { readonly kind: 'branch-of-another-task'; readonly branch: Branch }
  | {
      readonly kind: 'base-differs-from-task';
      readonly branch: Branch;
      readonly base: Branch | null;
    }
  | {
      readonly kind: 'branch-of-released-task';
      readonly branch: Branch;
      readonly completed: boolean;
    }
  | {
      readonly kind: 'branch-off-the-line';
      readonly branch: Branch;
      readonly line: LineName;
      readonly repository: Repository;
    };
