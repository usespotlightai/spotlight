import type {
  DescribedOperation,
  OperationParameter,
} from '@integrations/domain/value-objects/described-operation.vo';
import type { PlainRequest } from '@integrations/infrastructure/outbound/http-outbound';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import {
  isJsonObject,
  type JsonValue,
} from '@shared-kernel/domain/services/json-value';
import type { ToolInputValues } from '@work/application/contracts/tools.contract';

const JSON_CONTENT = 'application/json';

const textOf = (value: JsonValue): string =>
  typeof value === 'string' ? value : JSON.stringify(value);

const JOINERS: Readonly<Record<string, string>> = {
  form: ',',
  spaceDelimited: ' ',
  pipeDelimited: '|',
};

const queried = (
  parameter: OperationParameter,
  value: JsonValue,
): readonly [string, string][] => {
  const joiner = JOINERS[parameter.style] ?? ',';

  if (Array.isArray(value)) {
    return parameter.explode
      ? value.map((each) => [parameter.name, textOf(each)])
      : [[parameter.name, value.map(textOf).join(joiner)]];
  }

  if (isJsonObject(value)) {
    if (parameter.style === 'deepObject') {
      return Object.entries(value).map(([field, each]) => [
        `${parameter.name}[${field}]`,
        textOf(each),
      ]);
    }

    if (parameter.style === 'form') {
      return parameter.explode
        ? Object.entries(value).map(([field, each]) => [field, textOf(each)])
        : [
            [
              parameter.name,
              Object.entries(value)
                .flatMap(([field, each]) => [field, textOf(each)])
                .join(','),
            ],
          ];
    }

    return [[parameter.name, JSON.stringify(value)]];
  }

  return [[parameter.name, textOf(value)]];
};

const httpRequest = (
  call: Extract<DescribedOperation['call'], { kind: 'http' }>,
  inputs: ToolInputValues,
): PlainRequest => {
  const inputOf = (name: string): JsonValue | undefined => inputs[name];
  let path = call.path;
  const query = new URLSearchParams();
  const headers: Record<string, string> = { accept: JSON_CONTENT };

  for (const parameter of call.params) {
    const value = inputOf(parameter.name);

    if (value === undefined || value === null) {
      continue;
    }

    if (parameter.in === 'path') {
      path = path.replaceAll(
        `{${parameter.name}}`,
        encodeURIComponent(textOf(value)),
      );
    } else if (parameter.in === 'query') {
      for (const [name, each] of queried(parameter, value)) {
        query.append(name, each);
      }
    } else {
      headers[parameter.name] = textOf(value);
    }
  }

  const body = call.body ? inputOf(call.body.input) : undefined;

  if (call.body && body !== undefined) {
    headers['content-type'] = call.body.contentType;
  }

  return {
    method: call.method,
    url: `${call.server}${path}${query.size > 0 ? `?${query.toString()}` : ''}`,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
};

export const operationRequest = (
  operation: DescribedOperation,
  inputs: ToolInputValues,
): PlainRequest => {
  const call = operation.call;

  if (call.kind === 'http') {
    return httpRequest(call, inputs);
  }

  if (call.kind === 'mcp') {
    throw new InconsistentStateError(
      'described operation',
      `${operation.name} calls an MCP tool, which is not sent as a plain request`,
    );
  }

  return {
    method: 'POST',
    url: call.endpoint,
    headers: { accept: JSON_CONTENT, 'content-type': JSON_CONTENT },
    body: JSON.stringify({
      query: call.document,
      variables: Object.fromEntries(
        call.variables
          .filter((name) => inputs[name] !== undefined)
          .map((name) => [name, inputs[name]]),
      ),
    }),
  };
};
