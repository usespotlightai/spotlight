import type { ServicesAt } from '@work/application/ports/compose-files.port';
import { RunServices } from '@work/application/services/run-services';
import type { ComposeFile } from '@work/domain/services/compose-services';

const QUIET = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** RunServices over Compose files a test lays out, recording where each checkout was read. */
export const servicesOver = (
  filesAt: (checkout: ServicesAt) => readonly ComposeFile[],
): { services: RunServices; asked: ServicesAt[] } => {
  const asked: ServicesAt[] = [];
  const services = new RunServices(
    {
      at: async (_workspace, checkout) => {
        asked.push(checkout);
        return filesAt(checkout);
      },
    },
    QUIET,
  );
  return { services, asked };
};
