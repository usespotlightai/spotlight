import { type INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { ALLOW_ANONYMOUS } from '@platform/http/decorators/allow-anonymous.decorator';
import { ALLOW_WORKSPACE_TOKENS } from '@platform/http/decorators/allow-workspace-tokens.decorator';
import { RUNNER_ONLY } from '@platform/http/decorators/runner-only.decorator';
import {
  EXPRESSIONS,
  HOOK_CALLBACKS,
  RESOURCES,
  WORKSPACE_TOKEN_EXCHANGE,
} from '@platform/http/routes';

const AUDIENCES = ['web', 'resources', 'insights', 'hosts', 'public'] as const;

export type Audience = (typeof AUDIENCES)[number];

type Credential = 'session' | 'workspace-token' | 'runner' | 'anonymous';

export interface Route {
  readonly method: string;
  readonly path: string;
  readonly credential: Credential;
}

interface Rule {
  readonly credential: Credential;
  readonly under?: readonly string[];
}

const RULES: Readonly<Record<Audience, readonly Rule[]>> = {
  web: [
    { credential: 'session' },
    { credential: 'anonymous', under: ['invites', 'error-reporting'] },
  ],
  resources: [
    { credential: 'workspace-token', under: [RESOURCES, EXPRESSIONS] },
    { credential: 'anonymous', under: [WORKSPACE_TOKEN_EXCHANGE] },
  ],
  insights: [{ credential: 'workspace-token', under: ['teams'] }],
  hosts: [
    { credential: 'runner' },
    {
      credential: 'anonymous',
      under: ['hosts', 'egress', 'sandboxes', 'pools', 'health'],
    },
  ],
  public: [{ credential: 'anonymous', under: ['.well-known', HOOK_CALLBACKS] }],
};

const MARKERS: readonly (readonly [symbol, Credential])[] = [
  [RUNNER_ONLY, 'runner'],
  [ALLOW_ANONYMOUS, 'anonymous'],
  [ALLOW_WORKSPACE_TOKENS, 'workspace-token'],
];

const isUnder = (path: string, prefix: string): boolean =>
  path === `/${prefix}` || path.startsWith(`/${prefix}/`);

const matches = (route: Route, rule: Rule): boolean =>
  route.credential === rule.credential &&
  (!rule.under || rule.under.some((prefix) => isUnder(route.path, prefix)));

export const audienceOf = (route: Route): Audience => {
  const found = AUDIENCES.filter((audience) =>
    RULES[audience].some((rule) => matches(route, rule)),
  );

  if (found.length !== 1) {
    throw new Error(
      `${route.method.toUpperCase()} ${route.path} (${route.credential}) must belong to exactly one audience, but belongs to ${found.length === 0 ? 'none' : found.join(' and ')}.`,
    );
  }

  return found[0];
};

const joined = (...parts: string[]): string =>
  `/${parts
    .join('/')
    .split('/')
    .filter((part) => part !== '')
    .map((part) => (part.startsWith(':') ? `{${part.slice(1)}}` : part))
    .join('/')}`;

const pathsOf = (metadata: unknown): string[] =>
  Array.isArray(metadata) ? metadata : [String(metadata ?? '')];

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
        const own = Reflect.getMetadata(PATH_METADATA, handler);

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
    AUDIENCES.map((audience) => [audience, {} as OpenAPIObject['paths']]),
  ) as Record<Audience, OpenAPIObject['paths']>;

  for (const [path, operations] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
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
