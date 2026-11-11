import type {
  WarmCheckout,
  WarmLine,
} from '@runs/domain/value-objects/warm-line.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const checkoutOf = (
  path: string,
  setup: string | null = null,
): WarmCheckout => ({ path, setup });

export const warmLineOf = (
  input: {
    id?: string;
    warm?: number;
    checkouts?: readonly WarmCheckout[];
    placement?: RunnerPlacement;
  } = {},
): WarmLine => ({
  id: LineId.of(input.id ?? 'line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  checkouts: input.checkouts ?? [checkoutOf('widgets', 'npm ci')],
  placement: input.placement ?? RunnerPlacement.anywhere(),
  warmSandboxes: input.warm ?? 1,
});
