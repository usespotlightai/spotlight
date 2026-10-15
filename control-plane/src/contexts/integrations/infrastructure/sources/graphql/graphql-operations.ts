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
import {
  buildClientSchema,
  buildSchema,
  type GraphQLArgument,
  type GraphQLField,
  type GraphQLInputType,
  type GraphQLObjectType,
  type GraphQLOutputType,
  type GraphQLSchema,
  getNamedType,
  type IntrospectionQuery,
  isEnumType,
  isInterfaceType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
  isRequiredArgument,
  isRequiredInputField,
  isScalarType,
  print,
  valueToLiteral,
} from 'graphql';

const SELECTED_DEPTH = 2;

const DEEPEST = 3;

const SCALARS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  String: { type: 'string' },
  ID: { type: 'string' },
  Int: { type: 'integer' },
  Float: { type: 'number' },
  Boolean: { type: 'boolean' },
};

type Schema = Readonly<Record<string, unknown>>;

const inputSchemaOf = (
  type: GraphQLInputType,
  depth: number,
  seen: ReadonlySet<string>,
  budget: SchemaBudget,
): Schema => {
  if (isNonNullType(type)) {
    return inputSchemaOf(type.ofType, depth, seen, budget);
  }

  if (isListType(type)) {
    return {
      type: 'array',
      items: inputSchemaOf(type.ofType, depth, seen, budget),
    };
  }

  if (isEnumType(type)) {
    return {
      type: 'string',
      enum: type.getValues().map((each) => each.name),
      ...(type.description ? { description: type.description } : {}),
    };
  }

  if (isScalarType(type)) {
    return SCALARS[type.name] ?? {};
  }

  if (depth >= DEEPEST || seen.has(type.name) || !budget.spend()) {
    return { type: 'object' };
  }

  const within = new Set([...seen, type.name]);
  const fields = Object.values(type.getFields());

  return {
    type: 'object',
    ...(type.description ? { description: type.description } : {}),
    properties: Object.fromEntries(
      fields.map((field) => [
        field.name,
        {
          ...inputSchemaOf(field.type, depth + 1, within, budget),
          ...(field.description ? { description: field.description } : {}),
        },
      ]),
    ),
    required: fields.filter(isRequiredInputField).map((field) => field.name),
    additionalProperties: false,
  };
};

const declared = (arg: GraphQLArgument): string => {
  const fallback =
    arg.default?.literal ??
    (arg.default ? valueToLiteral(arg.default.value, arg.type) : undefined);

  return `$${arg.name}: ${arg.type.toString()}${fallback ? ` = ${print(fallback)}` : ''}`;
};

const selectionOf = (type: GraphQLOutputType, depth: number): string => {
  const named = getNamedType(type);

  if (isLeafType(named)) {
    return '';
  }

  if (!isObjectType(named) && !isInterfaceType(named)) {
    return '{ __typename }';
  }

  const picked = Object.values(named.getFields())
    .filter((field) => !field.args.some(isRequiredArgument))
    .flatMap((field) => {
      if (isLeafType(getNamedType(field.type))) {
        return [field.name];
      }

      if (depth <= 1) {
        return [];
      }

      const inner = selectionOf(field.type, depth - 1);

      return inner === '{ __typename }' ? [] : [`${field.name} ${inner}`];
    });

  return `{ ${picked.length > 0 ? picked.join(' ') : '__typename'} }`;
};

const operationOf = (
  field: GraphQLField<unknown, unknown>,
  operation: 'query' | 'mutation',
  endpoint: string,
  depth: number,
): OperationRecord | string => {
  const name = toolWordsOf(field.name);
  const unnameable = field.args.find((arg) => !isNameable(arg.name));

  if (name === '') {
    return `passes over ${field.name}. It has no name that a tool can take`;
  }

  if (unnameable) {
    return `passes over ${field.name}. It takes ${unnameable.name}, which a tool cannot take`;
  }

  const variables = field.args.map(declared);
  const budget = new SchemaBudget();
  const passed = field.args.map((arg) => `${arg.name}: $${arg.name}`);
  const selection = selectionOf(field.type, depth);
  const document = [
    operation,
    ` ${field.name}`,
    variables.length > 0 ? `(${variables.join(', ')})` : '',
    ' { ',
    field.name,
    passed.length > 0 ? `(${passed.join(', ')})` : '',
    selection ? ` ${selection}` : '',
    ' }',
  ].join('');

  return {
    name,
    upstream: field.name,
    description: describedAs(field.description, `${operation} ${field.name}`),
    inputs: field.args.map((arg) => ({
      name: arg.name,
      schema: inputSchemaOf(arg.type, 0, new Set(), budget),
      required: isRequiredArgument(arg),
      description: arg.description?.trim() || null,
    })),
    writes: operation === 'mutation',
    call: {
      kind: 'graphql',
      endpoint,
      operation,
      field: field.name,
      document,
      variables: field.args.map((arg) => arg.name),
    },
  };
};

const fieldsOf = (
  type: GraphQLObjectType | null | undefined,
): readonly GraphQLField<unknown, unknown>[] =>
  type ? Object.values(type.getFields()) : [];

const graphqlOperationsOf = (
  schema: GraphQLSchema,
  at: { endpoint: string; depth: number | null },
): ReadOperations => {
  const depth = at.depth ?? SELECTED_DEPTH;
  const records: OperationRecord[] = [];
  const passedOver: string[] = [];

  for (const [operation, type] of [
    ['query', schema.getQueryType()],
    ['mutation', schema.getMutationType()],
  ] as const) {
    for (const field of fieldsOf(type)) {
      const read = operationOf(field, operation, at.endpoint, depth);

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

const introspected = (text: string): IntrospectionQuery | null => {
  try {
    const answer: unknown = JSON.parse(text);
    const data =
      typeof answer === 'object' && answer !== null && 'data' in answer
        ? answer.data
        : answer;

    return typeof data === 'object' && data !== null && '__schema' in data
      ? (data as IntrospectionQuery)
      : null;
  } catch {
    return null;
  }
};

export const graphqlOperations = (
  text: string,
  at: { endpoint: string; depth: number | null },
): ReadOperations => {
  let schema: GraphQLSchema;

  try {
    const answer = introspected(text);
    schema = answer ? buildClientSchema(answer) : buildSchema(text);
  } catch (error) {
    throw new DescriptionUnreadable(
      `is not a GraphQL schema Spotlight can read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return graphqlOperationsOf(schema, at);
};
