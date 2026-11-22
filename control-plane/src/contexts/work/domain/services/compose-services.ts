import { isEnvironmentVariableName } from '@shared-kernel/domain/value-objects/environment-variable-name';

/** The Compose files a checkout may have at its top, the preferred first, as Compose itself looks for them. */
export const COMPOSE_FILES = [
  'compose.yaml',
  'compose.yml',
  'docker-compose.yaml',
  'docker-compose.yml',
] as const;

const SERVICE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/;

export interface ServiceHealth {
  readonly test: readonly string[];
  readonly intervalMs?: number;
  readonly timeoutMs?: number;
  readonly startPeriodMs?: number;
  readonly retries?: number;
}

/** A service as a Compose file declares it, before Spotlight decides whether a run can start it. */
export interface DeclaredService {
  readonly name: string;
  readonly image: string | null;
  readonly builds: boolean;
  readonly profiled: boolean;
  readonly command: readonly string[] | null;
  readonly env: readonly { readonly name: string; readonly value: string }[];
  /** Null where the image's own health check counts. */
  readonly health: ServiceHealth | null;
  readonly dependsOn: readonly string[];
}

/** A Compose file at the top of a checkout: its services, or null where it cannot be read. */
export interface ComposeFile {
  /** Where it is, relative to the working copy, as "api/compose.yml". */
  readonly from: string;
  readonly name: string;
  readonly services: readonly DeclaredService[] | null;
}

/** A service a run starts beside its sandbox. */
export interface ServiceToStart {
  readonly name: string;
  readonly image: string;
  readonly command?: readonly string[];
  readonly env?: readonly { readonly name: string; readonly value: string }[];
  readonly health?: ServiceHealth;
  /** Services that come before it and must be ready before it starts. */
  readonly dependsOn?: readonly string[];
  readonly from: string;
}

interface LeftOutService {
  readonly name: string;
  readonly from: string;
  readonly why: string;
}

export interface ServicesToStart {
  readonly services: readonly ServiceToStart[];
  readonly leftOut: readonly LeftOutService[];
}

/** The Compose file Compose itself would read among those at a checkout's top. */
export const preferredComposeFile = (
  found: readonly ComposeFile[],
): ComposeFile | null =>
  COMPOSE_FILES.flatMap((name) =>
    found.filter((each) => each.name === name),
  )[0] ?? null;

const whyLeftOut = (service: DeclaredService): string | null => {
  if (!SERVICE_NAME.test(service.name)) {
    return 'its name cannot be a host name';
  }
  if (service.builds) {
    return 'it builds its own image';
  }
  if (service.profiled) {
    return 'it only starts under a profile';
  }
  if (!service.image?.trim()) {
    return 'it names no image';
  }
  return null;
};

const toStart = (service: DeclaredService, from: string): ServiceToStart => {
  const env = service.env.filter(({ name }) => isEnvironmentVariableName(name));

  return {
    name: service.name,
    image: (service.image ?? '').trim(),
    ...(service.command?.length ? { command: service.command } : {}),
    ...(env.length ? { env } : {}),
    ...(service.health ? { health: service.health } : {}),
    ...(service.dependsOn.length ? { dependsOn: service.dependsOn } : {}),
    from,
  };
};

/**
 * Orders the services of one file so each follows the ones it depends on. A service that depends on one left out,
 * or on itself through others, is left out too.
 */
const ordered = (
  candidates: Map<string, ServiceToStart>,
  leftOut: LeftOutService[],
): ServiceToStart[] => {
  const placed = new Set<string>();
  const visiting = new Set<string>();
  const order: ServiceToStart[] = [];

  const place = (name: string): boolean => {
    if (placed.has(name)) {
      return true;
    }
    const service = candidates.get(name);
    if (!service || visiting.has(name)) {
      return false;
    }
    visiting.add(name);
    const missing = (service.dependsOn ?? []).find((each) => !place(each));
    visiting.delete(name);
    if (missing !== undefined) {
      candidates.delete(name);
      leftOut.push({
        name,
        from: service.from,
        why: `it depends on ${missing}, which cannot start before it`,
      });
      return false;
    }
    placed.add(name);
    order.push(service);
    return true;
  };
  for (const name of candidates.keys()) {
    place(name);
  }

  return order;
};

/**
 * Decides which services a run starts, from the preferred Compose file of each checkout in turn. Only services that
 * run from an image start: one that builds its image, only starts under a profile, or names no image is left out,
 * saying why. A name an earlier checkout already took, and any service past the most a run starts, is left out
 * too.
 */
export const servicesToStart = (
  checkouts: readonly (readonly ComposeFile[])[],
  most: number,
): ServicesToStart => {
  const services: ServiceToStart[] = [];
  const leftOut: LeftOutService[] = [];

  for (const found of checkouts) {
    const file = preferredComposeFile(found);
    if (!file) {
      continue;
    }
    if (!file.services) {
      leftOut.push({ name: file.name, from: file.from, why: 'it is not YAML' });
      continue;
    }

    const candidates = new Map<string, ServiceToStart>();
    for (const service of file.services) {
      const why = whyLeftOut(service);
      if (why) {
        leftOut.push({ name: service.name, from: file.from, why });
      } else {
        candidates.set(service.name, toStart(service, file.from));
      }
    }

    for (const service of ordered(candidates, leftOut)) {
      const missing = (service.dependsOn ?? []).find(
        (each) => !services.some((taken) => taken.name === each),
      );
      if (missing !== undefined) {
        leftOut.push({
          name: service.name,
          from: service.from,
          why: `it depends on ${missing}, which does not start`,
        });
      } else if (services.some((taken) => taken.name === service.name)) {
        leftOut.push({
          name: service.name,
          from: service.from,
          why: 'another checkout has a service of that name',
        });
      } else if (services.length >= most) {
        leftOut.push({
          name: service.name,
          from: service.from,
          why: `a run starts at most ${most} services`,
        });
      } else {
        services.push(service);
      }
    }
  }

  return { services, leftOut };
};
