import type { INestApplication } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import {
  controllerMethodsOf,
  pathsOf,
  requestMethodOf,
} from '@platform/http/controller-routes';
import { ADMIN_ONLY } from '@platform/http/decorators/admin-only.decorator';
import { ALLOW_ANONYMOUS } from '@platform/http/decorators/allow-anonymous.decorator';
import { ALLOW_WORKSPACE_TOKENS } from '@platform/http/decorators/allow-workspace-tokens.decorator';
import {
  type Audience,
  perAudience,
  IN_AUDIENCE,
} from '@platform/http/decorators/in-audience.decorator';
import { MACHINE_ONLY } from '@platform/http/decorators/machine-only.decorator';
import { ADMIN } from '@platform/http/routes';

type Credential =
  | 'session'
  | 'workspace-token'
  | 'machine'
  | 'admin'
  | 'anonymous';

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
  admin: ['admin'],
};

const IMPLIED: Readonly<Partial<Record<Credential, Audience>>> = {
  session: 'web',
  machine: 'hosts',
  admin: 'admin',
};

// What the bearer token is in an audience where it is not a workspace token.
const BEARER_TOKENS: Readonly<Partial<Record<Audience, string>>> = {
  admin:
    'The admin token of this Spotlight (SPOTLIGHT_ADMIN_TOKEN). Without it set, every admin route answers 404',
};

const securitySchemesFor = (
  audience: Audience,
  schemes: NonNullable<OpenAPIObject['components']>['securitySchemes'],
): NonNullable<OpenAPIObject['components']>['securitySchemes'] => {
  const bearer = schemes?.bearer;
  const description = BEARER_TOKENS[audience];

  return bearer &&
    description !== undefined &&
    description !== '' &&
    !('$ref' in bearer)
    ? { ...schemes, bearer: { ...bearer, description } }
    : schemes;
};

const MARKERS: readonly (readonly [symbol, Credential])[] = [
  [MACHINE_ONLY, 'machine'],
  [ADMIN_ONLY, 'admin'],
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
  if ((route.credential === 'admin') !== route.path.startsWith(`/${ADMIN}/`)) {
    throw new Error(
      `${named} must be an admin route under /${ADMIN}, and only admin routes may be there.`,
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

export const routesOf = (app: INestApplication): Route[] => {
  const reflector = app.get(Reflector);

  return controllerMethodsOf(app).flatMap((each) => {
    const { controller, name, handler, own } = each;
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
    const method = requestMethodOf(each);

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
};

const refsIn = (value: unknown, into: Set<string>): Set<string> => {
  if (Array.isArray(value)) {
    for (const each of value) {
      refsIn(each, into);
    }
  } else if (typeof value === 'object' && value !== null) {
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

const schemasReachedFrom = <Schema>(
  paths: OpenAPIObject['paths'],
  schemas: Record<string, Schema>,
): Record<string, Schema> => {
  const reached = new Set<string>();
  const pending = [...refsIn(paths, new Set())];

  for (let ref = pending.pop(); ref !== undefined; ref = pending.pop()) {
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
  const paths = perAudience((): OpenAPIObject['paths'] => ({}));

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

  return perAudience((audience): OpenAPIObject => {
    const used = paths[audience];
    const tags = new Set(
      Object.values(used).flatMap((operations) =>
        Object.values(operations).flatMap(
          (operation: { tags?: string[] }) => operation.tags ?? [],
        ),
      ),
    );

    return {
      ...document,
      tags: document.tags?.filter((tag) => tags.has(tag.name)),
      paths: used,
      components: {
        ...document.components,
        securitySchemes: securitySchemesFor(
          audience,
          document.components?.securitySchemes,
        ),
        schemas: schemasReachedFrom(used, document.components?.schemas ?? {}),
      },
    };
  });
};
