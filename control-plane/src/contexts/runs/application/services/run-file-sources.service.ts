import type {
  RunFileFacts,
  RunFileSource,
  RunFilesPort,
} from '@runs/application/ports/run-files.port';
import type { Run } from '@runs/domain/aggregates/run.aggregate';

export class RunFileSources implements RunFilesPort {
  private readonly sources = new Map<string, RunFileSource>();

  register(source: RunFileSource): void {
    this.sources.set(source.owner, source);
  }

  async uploadedBy(
    run: Run,
    ids: readonly string[],
  ): Promise<readonly RunFileFacts[]> {
    const source = this.sourceOf(run);

    return source && ids.length > 0
      ? source.uploadedBy(run.id, run.workspaceId, ids)
      : [];
  }

  async take(run: Run, files: readonly RunFileFacts[]): Promise<void> {
    const source = this.sourceOf(run);

    if (source && files.length > 0) {
      await source.take(run.workspaceId, files);
    }
  }

  private sourceOf(run: Run): RunFileSource | null {
    return this.sources.get(run.requester.owner.value) ?? null;
  }
}
