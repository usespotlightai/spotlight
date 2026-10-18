import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { WorkspaceKeysPort } from '@secrets/application/ports/workspace-keys.port';
import type {
  KeyContext,
  KeyManagement,
} from '@secrets/infrastructure/kms/key-management';
import { secretDataKey } from '@secrets/infrastructure/persistence/drizzle/schemas/secret.schema';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq } from 'drizzle-orm';

const PURPOSE = 'spotlight-secrets';

const contextFor = (workspaceId: WorkspaceId): KeyContext => ({
  purpose: PURPOSE,
  workspace: workspaceId.value,
});

export class WorkspaceKeys implements WorkspaceKeysPort {
  readonly #unwrapped = new Map<string, Uint8Array>();

  constructor(
    private readonly context: DrizzleContext,
    private readonly kms: KeyManagement,
  ) {}

  async of(workspaceId: WorkspaceId): Promise<Uint8Array> {
    const existing = await this.storedKey(workspaceId);

    if (existing) {
      return this.unwrapped(workspaceId, existing);
    }

    const issued = await this.kms.issue(contextFor(workspaceId));
    const [inserted] = await this.context.db
      .insert(secretDataKey)
      .values({
        workspaceId: workspaceId.value,
        keyId: this.kms.keyId,
        wrapped: issued.wrapped,
      })
      .onConflictDoNothing({ target: secretDataKey.workspaceId })
      .returning({ wrapped: secretDataKey.wrapped });

    if (inserted) {
      this.#unwrapped.set(issued.wrapped, issued.plain);
      return issued.plain;
    }

    const first = await this.storedKey(workspaceId);

    if (!first) {
      throw new Error(
        `The data key for workspace ${workspaceId.value} vanished while it was issued`,
      );
    }

    return this.unwrapped(workspaceId, first);
  }

  async deleteDataKey(workspaceId: WorkspaceId): Promise<void> {
    const deleted = await this.context.db
      .delete(secretDataKey)
      .where(eq(secretDataKey.workspaceId, workspaceId.value))
      .returning({ wrapped: secretDataKey.wrapped });

    for (const each of deleted) {
      this.#unwrapped.delete(each.wrapped);
    }
  }

  private async storedKey(workspaceId: WorkspaceId): Promise<string | null> {
    const [found] = await this.context.db
      .select({ wrapped: secretDataKey.wrapped })
      .from(secretDataKey)
      .where(eq(secretDataKey.workspaceId, workspaceId.value))
      .limit(1);

    return found?.wrapped ?? null;
  }

  private async unwrapped(
    workspaceId: WorkspaceId,
    wrapped: string,
  ): Promise<Uint8Array> {
    const cached = this.#unwrapped.get(wrapped);

    if (cached) {
      return cached;
    }

    const plain = await this.kms.unwrap(wrapped, contextFor(workspaceId));
    this.#unwrapped.set(wrapped, plain);

    return plain;
  }
}
