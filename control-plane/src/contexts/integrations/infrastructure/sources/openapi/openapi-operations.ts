import type {
  HttpMethod,
  OperationParameter,
  ParameterPlace,
} from '@integrations/domain/value-objects/described-operation.vo';
import {
  DescriptionUnreadable,
  describedAs,
  isNameable,
  keepingFirst,
  type OperationRecord,
  type ReadOperations,
  toolWordsOf,
} from '@integrations/infrastructure/sources/operation-record';
import { SchemaBudget } from '@integrations/infrastructure/sources/schema-budget';

type Node = Readonly<Record<string, unknown>>;

const METHODS: readonly HttpMethod[] = [
  'GET',
  'PUT',
  'POST',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
];

const WRITING: readonly HttpMethod[] = ['POST', 'PUT', 'PATCH', 'DELETE'];

const PLACES: readonly ParameterPlace[] = ['path', 'query', 'header'];

const SENT_BY_SPOTLIGHT = ['accept', 'content-type', 'authorization'];

const DEEPEST = 8;

const BODY = 'body';

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const listOf = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

const pointerSegment = (segment: string): string | null => {
  try {
    return decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~');
  } catch {
    return null;
  }
};

class Walk {
  private budget = new SchemaBudget();

  constructor(private readonly document: Node) {}

  reset(): void {
    this.budget = new SchemaBudget();
  }

  referenced(reference: string): unknown {
    if (!reference.startsWith('#/')) {
      return undefined;
    }

    return reference
      .slice(2)
      .split('/')
      .map(pointerSegment)
      .reduce<unknown>(
        (at, segment) =>
          isNode(at) && segment !== null ? at[segment] : undefined,
        this.document,
      );
  }

  resolved(value: unknown, seen: ReadonlySet<string> = new Set()): unknown {
    if (!isNode(value) || typeof value.$ref !== 'string') {
      return value;
    }

    if (seen.has(value.$ref)) {
      return undefined;
    }

    return this.resolved(
      this.referenced(value.$ref),
      new Set([...seen, value.$ref]),
    );
  }

  schema(
    value: unknown,
    depth = 0,
    seen: ReadonlySet<string> = new Set(),
  ): Node {
    if (!this.budget.spend() || depth >= DEEPEST) {
      return {};
    }

    if (isNode(value) && typeof value.$ref === 'string') {
      if (seen.has(value.$ref)) {
        return {};
      }

      const target = this.referenced(value.$ref);

      return target === undefined
        ? {}
        : this.schema(target, depth, new Set([...seen, value.$ref]));
    }

    if (!isNode(value)) {
      return {};
    }

    const deeper = (each: unknown) => this.schema(each, depth + 1, seen);
    const shaped: Record<string, unknown> = { ...value };

    if (value.nullable === true && typeof value.type === 'string') {
      shaped.type = [value.type, 'null'];
    }

    if (isNode(value.properties)) {
      shaped.properties = Object.fromEntries(
        Object.entries(value.properties).map(([field, each]) => [
          field,
          deeper(each),
        ]),
      );
    }

    if (value.items !== undefined) {
      shaped.items = deeper(value.items);
    }

    for (const choice of ['allOf', 'anyOf', 'oneOf'] as const) {
      if (Array.isArray(value[choice])) {
        shaped[choice] = value[choice].map((each: unknown) =>
          this.schema(each, depth, seen),
        );
      }
    }

    return shaped;
  }
}

const serverVariables = (url: string, variables: unknown): string =>
  isNode(variables)
    ? Object.entries(variables).reduce(
        (written, [name, variable]) =>
          written.replaceAll(
            `{${name}}`,
            isNode(variable) && typeof variable.default === 'string'
              ? variable.default
              : '',
          ),
        url,
      )
    : url;

interface Reading {
  readonly url: string | null;
  readonly baseUrl: string | null;
  readonly connected: boolean;
}

const serverIn = (servers: unknown, url: string | null): string | null => {
  const [first] = listOf(servers).filter(isNode);
  const written =
    first && typeof first.url === 'string'
      ? serverVariables(first.url, first.variables)
      : null;

  if (written === null) {
    return null;
  }

  try {
    return new URL(written, url ?? undefined).href.replace(/\/+$/, '');
  } catch {
    throw new DescriptionUnreadable(
      `names the server ${JSON.stringify(written)}, which is not a web address; give the openapi block a baseUrl`,
    );
  }
};

const serverOf = (document: Node, at: Reading): string => {
  if (at.baseUrl) {
    return at.baseUrl.replace(/\/+$/, '');
  }

  const named = serverIn(document.servers, at.url);

  if (named) {
    return named;
  }

  if (at.url) {
    return new URL('/', at.url).href.replace(/\/+$/, '');
  }

  throw new DescriptionUnreadable(
    'names no server to call; give the openapi block a baseUrl',
  );
};

const hostOf = (url: string): string => new URL(url).host.toLowerCase();

interface Parameter {
  readonly name: string;
  readonly in: string;
  readonly required: boolean;
  readonly description: unknown;
  readonly schema: unknown;
  readonly style: string | null;
  readonly explode: boolean | null;
}

const parameterOf = (walk: Walk, raw: unknown): Parameter | null => {
  const resolved = walk.resolved(raw);

  if (
    !isNode(resolved) ||
    typeof resolved.name !== 'string' ||
    typeof resolved.in !== 'string'
  ) {
    return null;
  }

  return {
    name: resolved.name,
    in: resolved.in,
    required: resolved.in === 'path' || resolved.required === true,
    description: resolved.description,
    schema: resolved.schema,
    style: typeof resolved.style === 'string' ? resolved.style : null,
    explode: typeof resolved.explode === 'boolean' ? resolved.explode : null,
  };
};

const jsonBodyOf = (
  content: unknown,
): { readonly contentType: string; readonly schema: unknown } | null => {
  if (!isNode(content)) {
    return null;
  }

  const contentType = Object.keys(content).find(
    (each) =>
      each === 'application/json' ||
      /^application\/[\w.-]+\+json$/.test(each) ||
      each.startsWith('application/json;'),
  );
  const media = contentType ? content[contentType] : undefined;

  return contentType && isNode(media)
    ? { contentType, schema: media.schema }
    : null;
};

const operationOf = (
  walk: Walk,
  input: {
    method: HttpMethod;
    path: string;
    server: string;
    servers: unknown;
    at: Reading;
    shared: readonly unknown[];
    operation: Node;
  },
): OperationRecord | string => {
  const { method, path, operation, at } = input;
  const upstream =
    typeof operation.operationId === 'string' && operation.operationId.trim()
      ? operation.operationId.trim()
      : `${method} ${path}`;
  const name = toolWordsOf(
    upstream === `${method} ${path}`
      ? `${method.toLowerCase()} ${path.replace(/[{}]/g, '')}`
      : upstream,
  );
  const passOver = (because: string) => `passes over ${upstream}, ${because}`;

  if (name === '') {
    return passOver('which has no name a tool can take');
  }

  const server = at.baseUrl
    ? input.server
    : (serverIn(operation.servers, at.url) ??
      serverIn(input.servers, at.url) ??
      input.server);

  if (
    at.connected &&
    !at.baseUrl &&
    (at.url === null || hostOf(server) !== hostOf(at.url))
  ) {
    return passOver(
      `because it calls ${hostOf(server)}, and the connection is worn only toward the host the description came from or the one its baseUrl names`,
    );
  }

  walk.reset();

  const byPlace = new Map<string, Parameter>();
  for (const raw of [...input.shared, ...listOf(operation.parameters)]) {
    const parameter = parameterOf(walk, raw);

    if (!parameter) {
      return passOver('because one of its parameters cannot be read');
    }

    byPlace.set(`${parameter.in} ${parameter.name}`, parameter);
  }

  const inputs: OperationRecord['inputs'][number][] = [];
  const params: OperationParameter[] = [];

  for (const parameter of byPlace.values()) {
    const sendable =
      (PLACES as readonly string[]).includes(parameter.in) &&
      isNameable(parameter.name) &&
      !(
        parameter.in === 'header' &&
        SENT_BY_SPOTLIGHT.includes(parameter.name.toLowerCase())
      );

    if (!sendable) {
      if (parameter.required) {
        return passOver(
          `because it needs its ${parameter.in} parameter ${parameter.name}, which a tool cannot send`,
        );
      }
      continue;
    }

    if (inputs.some((each) => each.name === parameter.name)) {
      return passOver(`because it takes ${parameter.name} twice`);
    }

    inputs.push({
      name: parameter.name,
      schema: walk.schema(parameter.schema),
      required: parameter.required,
      description:
        typeof parameter.description === 'string' &&
        parameter.description.trim()
          ? parameter.description.trim()
          : null,
    });
    const style =
      parameter.style ?? (parameter.in === 'query' ? 'form' : 'simple');

    params.push({
      name: parameter.name,
      in: parameter.in as ParameterPlace,
      style,
      explode: parameter.explode ?? style === 'form',
    });
  }

  const requestBody = walk.resolved(operation.requestBody);
  const body = isNode(requestBody) ? jsonBodyOf(requestBody.content) : null;

  if (isNode(requestBody) && !body && requestBody.required === true) {
    return passOver(
      'because it sends a body that is not JSON, which a tool cannot send yet',
    );
  }

  if (body) {
    if (inputs.some((each) => each.name === BODY)) {
      return passOver(
        `because it takes a parameter called ${BODY} as well as a body`,
      );
    }

    inputs.push({
      name: BODY,
      schema: walk.schema(body.schema),
      required: isNode(requestBody) && requestBody.required === true,
      description: isNode(requestBody)
        ? describedAs(requestBody.description, 'What it sends')
        : null,
    });
  }

  return {
    name,
    upstream,
    description: describedAs(
      operation.summary ?? operation.description,
      `${method} ${path}`,
    ),
    inputs,
    writes: WRITING.includes(method),
    call: {
      kind: 'http',
      method,
      server,
      path,
      params,
      body: body ? { input: BODY, contentType: body.contentType } : null,
    },
  };
};

export const openapiOperations = (
  document: unknown,
  at: Reading,
): ReadOperations => {
  if (!isNode(document)) {
    throw new DescriptionUnreadable('is not an OpenAPI description');
  }

  if (document.swagger !== undefined) {
    throw new DescriptionUnreadable(
      'is a Swagger 2 description, which Spotlight does not read; convert it to OpenAPI 3',
    );
  }

  if (
    typeof document.openapi !== 'string' ||
    !document.openapi.startsWith('3.')
  ) {
    throw new DescriptionUnreadable(
      'is not an OpenAPI 3 description, which says openapi: 3.0 or 3.1',
    );
  }

  const walk = new Walk(document);
  const server = serverOf(document, at);
  const records: OperationRecord[] = [];
  const passedOver: string[] = [];

  for (const [path, raw] of Object.entries(
    isNode(document.paths) ? document.paths : {},
  )) {
    const item = walk.resolved(raw);

    if (!isNode(item) || !path.startsWith('/')) {
      continue;
    }

    for (const method of METHODS) {
      const operation = item[method.toLowerCase()];

      if (!isNode(operation)) {
        continue;
      }

      const read = operationOf(walk, {
        method,
        path,
        server,
        servers: item.servers,
        at,
        shared: listOf(item.parameters),
        operation,
      });

      if (typeof read === 'string') {
        passedOver.push(read);
      } else {
        records.push(read);
      }
    }
  }

  const kept = keepingFirst(records);

  return {
    operations: kept.operations,
    passedOver: [...passedOver, ...kept.passedOver],
  };
};
