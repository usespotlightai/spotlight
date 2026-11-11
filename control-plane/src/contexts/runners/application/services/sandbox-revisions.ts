import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxVersionConflictError } from '@runners/domain/exceptions/sandbox-version-conflict.error';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';

const ATTEMPTS = 3;

export type SandboxRevision =
  | { readonly kind: 'saved' | 'unchanged'; readonly sandbox: Sandbox }
  | { readonly kind: 'removed' | 'gone' };

export const reviseOrRemoveSandbox = async (
  sandboxes: SandboxRepository,
  loaded: Sandbox,
  change: (sandbox: Sandbox) => Sandbox | 'removed',
): Promise<SandboxRevision> => {
  let found: Sandbox | null = loaded;

  for (let attempt = 1; ; attempt++) {
    if (!found) {
      return { kind: 'gone' };
    }

    const changed = change(found);

    if (changed === found) {
      return { kind: 'unchanged', sandbox: found };
    }

    try {
      if (changed === 'removed') {
        await sandboxes.remove(found);
        return { kind: 'removed' };
      }

      await sandboxes.save(changed);
      return { kind: 'saved', sandbox: changed };
    } catch (error) {
      if (
        !(error instanceof SandboxVersionConflictError) ||
        attempt >= ATTEMPTS
      ) {
        throw error;
      }
    }

    found = await sandboxes.find(loaded.id);
  }
};

export const reviseSandbox = async (
  sandboxes: SandboxRepository,
  loaded: Sandbox,
  change: (sandbox: Sandbox) => Sandbox,
): Promise<Sandbox | null> => {
  const revised = await reviseOrRemoveSandbox(sandboxes, loaded, change);

  return revised.kind === 'saved' || revised.kind === 'unchanged'
    ? revised.sandbox
    : null;
};
