import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxVersionConflictError } from '@runners/domain/exceptions/sandbox-version-conflict.error';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';

const ATTEMPTS = 3;

export const reviseSandbox = async (
  sandboxes: SandboxRepository,
  loaded: Sandbox,
  change: (sandbox: Sandbox) => Sandbox,
): Promise<Sandbox | null> => {
  let found: Sandbox | null = loaded;

  for (let attempt = 1; ; attempt++) {
    if (!found) {
      return null;
    }

    const changed = change(found);

    if (changed === found) {
      return found;
    }

    try {
      await sandboxes.save(changed);
      return changed;
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
