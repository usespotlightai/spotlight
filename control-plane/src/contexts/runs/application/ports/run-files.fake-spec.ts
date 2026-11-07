import type { RunFileSource } from '@runs/application/ports/run-files.port';
import { RunFileSources } from '@runs/application/services/run-file-sources.service';

export const runFilesFrom = (
  ...sources: readonly RunFileSource[]
): RunFileSources => {
  const registry = new RunFileSources();

  for (const source of sources) {
    registry.register(source);
  }

  return registry;
};
