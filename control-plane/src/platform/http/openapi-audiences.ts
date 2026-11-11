import { type INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { ALLOW_ANONYMOUS } from '@platform/http/decorators/allow-anonymous.decorator';
import { ALLOW_WORKSPACE_TOKENS } from '@platform/http/decorators/allow-workspace-tokens.decorator';
import {
  AUDIENCES,
  type Audience,
  IN_AUDIENCE,
} from '@platform/http/decorators/in-audience.decorator';
import { MACHINE_ONLY } from '@platform/http/decorators/machine-only.decorator';

type Credential = 'session' | 'workspace-token' | 'machine' | 'anonymous';

export interface Route {
  readonly method: string;
  readonly path: string;
  readonly credential: Credential;
  readonly audience: Audience | null;
}

const CREDENTIALS: Readonly<Record<Audience, readonly Credential[]>> = {
  web: ['session', 'anonymous'],
  resources: ['workspace-token', 'anonymous'],
  automation: ['workspace-token'],
  hosts: ['machine', 'anonymous'],
  public: ['anonymous'],
};

const IMPLIED: Readonly<Partial<Record<Credential, Audience>>> = {
  session: 'web',
  machine: 'hosts',
};

const MARKERS: readonly (readonly [symbol, Credential])[] = [
  [MACHINE_ONLY, 'machine'],
  [ALLOW_ANONYMOUS, 'anonymous'],
  [ALLOW_WORKSPACE_TOKENS, 'workspace-token'],
];

export const audienceOf = (route: Route): Audience => {
  const audience = route.audience ?? IMPLIED[route.credential];
  const named = `${route.method.toUpperCase()} ${route.path} (${route.credential})`;

  if (!audience) {
    throw new Error(
      `${named} must name its audience with @InAudience; ${route.credential} routes have none by default.`,
    );
  }
  if (!CREDENTIALS[audience].includes(route.credential)) {
    throw new Error(
      `${named} is in the ${audience} audience, which takes ${CREDENTIALS[audience].join(' or ')} routes only.`,
    );
  }

  return audience;
};

const joined = (...parts: string[]): string =>
  `/${parts
    .join('/')
    .split('/')
    .filter((part) => part !== '')
    .map((part) => (part.startsWith(':') ? `{${part.slice(1)}}` : part))
    .join('/')}`;

const pathsOf = (metadata: unknown): string[] => {
  if (Array.isArray(metadata)) {
    return metadata as string[];
  }

  return [typeof metadata === 'string' ? metadata : ''];
};

export const routesOf = (app: INestApplication): Route[] => {
  const reflector = app.get(Reflector);
  const scanner = app.get(MetadataScanner);

  return app
    .get(DiscoveryService)
    .getControllers()
    .flatMap(({ metatype }) => {
      if (!metatype) {
        return [];
      }

      const controller = metatype as new (...args: never[]) => unknown;
      const prototype = controller.prototype as Record<string, () => unknown>;

      return scanner.getAllMethodNames(prototype).flatMap((name) => {
        const handler = prototype[name];
        const own: unknown = Reflect.getMetadata(PATH_METADATA, handler);

        if (own === undefined) {
          return [];
        }

        const marked = MARKERS.filter(([marker]) =>
          reflector.getAllAndOverride<boolean>(marker, [handler, controller]),
        ).map(([, credential]) => credential);

        if (marked.length > 1) {
          throw new Error(
            `${controller.name}.${name} is marked ${marked.join(' and ')}; a route takes one kind of credential.`,
          );
        }

        const audience =
          reflector.getAllAndOverride<Audience | undefined>(IN_AUDIENCE, [
            handler,
            controller,
          ]) ?? null;
        const method =
          RequestMethod[
            Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod
          ].toLowerCase();

        return pathsOf(Reflect.getMetadata(PATH_METADATA, controller)).flatMap(
          (base) =>
            pathsOf(own).map((path) => ({
              method,
              path: joined(base, path),
              credential: marked[0] ?? 'session',
              audience,
            })),
        );
      });
    });
};

const refsIn = (value: unknown, into: Set<string>): Set<string> => {
  if (Array.isArray(value)) {
    for (const each of value) {
      refsIn(each, into);
    }
  } else if (value && typeof value === 'object') {
    for (const [key, each] of Object.entries(value)) {
      if (key === '$ref' && typeof each === 'string') {
        into.add(each);
      } else {
        refsIn(each, into);
      }
    }
  }

  return into;
};

const SCHEMA_REF = '#/components/schemas/';

const schemasReachedFrom = (
  paths: OpenAPIObject['paths'],
  schemas: Record<string, unknown>,
): Record<string, unknown> => {
  const reached = new Set<string>();
  const pending = [...refsIn(paths, new Set())];

  while (pending.length > 0) {
    const ref = pending.pop() as string;
    const name = ref.startsWith(SCHEMA_REF) ? ref.slice(SCHEMA_REF.length) : '';

    if (name === '' || reached.has(name) || !(name in schemas)) {
      continue;
    }

    reached.add(name);
    pending.push(...refsIn(schemas[name], new Set()));
  }

  return Object.fromEntries(
    Object.entries(schemas).filter(([name]) => reached.has(name)),
  );
};

export const documentsByAudience = (
  document: OpenAPIObject,
  routes: readonly Route[],
): Record<Audience, OpenAPIObject> => {
  const byOperation = new Map(
    routes.map((route) => [`${route.method} ${route.path}`, route]),
  );
  const paths = Object.fromEntries(
    AUDIENCES.map((audience) => [audience, {}]),
  ) as Record<Audience, OpenAPIObject['paths']>;

  for (const [path, operations] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(operations) as [
      string,
      unknown,
    ][]) {
      const route = byOperation.get(`${method} ${path}`);

      if (!route) {
        throw new Error(
          `${method.toUpperCase()} ${path} is in the document but matches no controller route.`,
        );
      }

      const audience = audienceOf(route);
      paths[audience][path] = { ...paths[audience][path], [method]: operation };
    }
  }

  return Object.fromEntries(
    AUDIENCES.map((audience) => {
      const used = paths[audience];
      const tags = new Set(
        Object.values(used).flatMap((operations) =>
          Object.values(operations).flatMap(
            (operation: { tags?: string[] }) => operation.tags ?? [],
          ),
        ),
      );

      return [
        audience,
        {
          ...document,
          tags: document.tags?.filter((tag) => tags.has(tag.name)),
          paths: used,
          components: {
            ...document.components,
            schemas: schemasReachedFrom(
              used,
              document.components?.schemas ?? {},
            ),
          },
        },
      ];
    }),
  ) as Record<Audience, OpenAPIObject>;
};
