import type { RepositoryContentsPort } from '@github/application/ports/repository-contents.port';
import {
  checkoutPathOf,
  MAX_RUN_SERVICES,
  type RunServiceShape,
} from '@runs/application/contracts/run-spec.contract';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  CheckoutServicesPort,
  ServicesAt,
} from '@work/application/ports/checkout-services.port';
import {
  COMPOSE_ENV_FILE,
  COMPOSE_FILES,
  composeServicesOf,
  envFileOf,
  type LeftOutService,
} from '@work/infrastructure/compose/compose-file';

const NAMES = [...COMPOSE_FILES, COMPOSE_ENV_FILE];

export class GitHubCheckoutServices implements CheckoutServicesPort {
  constructor(
    private readonly contents: RepositoryContentsPort,
    private readonly logger: LoggerPort,
  ) {}

  async of(
    workspaceId: WorkspaceId,
    at: readonly ServicesAt[],
  ): Promise<readonly RunServiceShape[]> {
    const found = await Promise.all(
      at.map((checkout) => this.ofCheckout(workspaceId, checkout)),
    );

    const services: RunServiceShape[] = [];
    const leftOut: (LeftOutService & { readonly from: string })[] = [];
    for (const each of found) {
      for (const service of each.services) {
        if (services.some((taken) => taken.name === service.name)) {
          leftOut.push({
            ...service,
            why: 'another checkout has a service of that name',
          });
        } else if (services.length >= MAX_RUN_SERVICES) {
          leftOut.push({
            ...service,
            why: `a run starts at most ${MAX_RUN_SERVICES} services`,
          });
        } else {
          services.push(service);
        }
      }
      leftOut.push(...each.leftOut);
    }

    if (leftOut.length > 0) {
      this.logger.info(
        {
          workspaceId: workspaceId.value,
          leftOut: leftOut.map(({ name, from, why }) => ({ name, from, why })),
        },
        'Left out services of a Compose file that a run cannot start',
      );
    }
    return services;
  }

  private async ofCheckout(
    workspaceId: WorkspaceId,
    checkout: ServicesAt,
  ): Promise<{
    readonly services: readonly RunServiceShape[];
    readonly leftOut: readonly (LeftOutService & { readonly from: string })[];
  }> {
    try {
      const top = await this.contents.topFiles(
        workspaceId,
        checkout.repository,
        NAMES,
        checkout.ref,
      );
      const compose = COMPOSE_FILES.flatMap((name) =>
        top.files.filter((file) => file.path === name),
      )[0];
      if (!compose) {
        return { services: [], leftOut: [] };
      }

      const env = top.files.find((file) => file.path === COMPOSE_ENV_FILE);
      const from = `${checkoutPathOf(checkout.repository)}/${compose.path}`;
      const read = composeServicesOf(
        compose.content,
        from,
        envFileOf(env?.content ?? ''),
      );
      return {
        services: read.services,
        leftOut: read.leftOut.map((each) => ({ ...each, from })),
      };
    } catch (error: unknown) {
      this.logger.warn(
        {
          err: error,
          workspaceId: workspaceId.value,
          repository: checkout.repository.value,
        },
        'Ordering the run without the services of its Compose file, which could not be read',
      );
      return { services: [], leftOut: [] };
    }
  }
}
