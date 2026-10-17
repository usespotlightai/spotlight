import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import {
  INPUT_NAME,
  isSlug,
  WHOLE_CALL_INPUT,
} from '@shared-kernel/domain/value-objects/identifier-shapes';
import type { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';

const OPERATION_INPUT = new RegExp(`^${INPUT_NAME}$`);

const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export type ParameterPlace = 'path' | 'query' | 'header';

export interface OperationParameter {
  readonly name: string;
  readonly in: ParameterPlace;
  readonly style: string;
  readonly explode: boolean;
}

export type OperationCall =
  | {
      readonly kind: 'http';
      readonly method: HttpMethod;
      readonly server: string;
      readonly path: string;
      readonly params: readonly OperationParameter[];
      readonly body: {
        readonly input: string;
        readonly contentType: string;
      } | null;
    }
  | {
      readonly kind: 'graphql';
      readonly endpoint: string;
      readonly operation: 'query' | 'mutation';
      readonly field: string;
      readonly document: string;
      readonly variables: readonly string[];
    }
  | {
      readonly kind: 'mcp';
      readonly tool: string;
    };

export interface OperationInput {
  readonly name: string;
  readonly schema: InputSchema;
  readonly required: boolean;
  readonly description: string | null;
}

export class DescribedOperation {
  private constructor(
    readonly name: string,
    readonly upstream: string,
    readonly description: string,
    readonly inputs: readonly OperationInput[],
    readonly writes: boolean,
    readonly call: OperationCall,
  ) {}

  static of(input: {
    name: string;
    upstream: string;
    description: string;
    inputs: readonly OperationInput[];
    writes: boolean;
    call: OperationCall;
  }): DescribedOperation {
    const refuse = (because: string) =>
      new InvalidIntegrationPartError(
        `operation ${JSON.stringify(input.upstream)}`,
        because,
      );
    const description = input.description.trim();

    if (!isSlug(input.name)) {
      throw refuse(
        'is not named in lowercase words joined by dashes, as in create-issue',
      );
    }

    if (description === '') {
      throw refuse('says nothing about what it does');
    }

    const names = input.inputs.map((each) => each.name);

    for (const name of names) {
      if (!OPERATION_INPUT.test(name) || name === WHOLE_CALL_INPUT) {
        throw refuse(`takes ${JSON.stringify(name)}, which a tool cannot take`);
      }
    }

    if (new Set(names).size !== names.length) {
      throw refuse('takes one input twice');
    }

    const call = input.call;

    if (call.kind === 'http') {
      if (!call.path.startsWith('/')) {
        throw refuse('calls a path that does not begin with /');
      }

      const passed = [
        ...call.params.map((each) => each.name),
        ...(call.body ? [call.body.input] : []),
      ];

      if (passed.some((each) => !names.includes(each))) {
        throw refuse('sends an input it does not take');
      }
    } else if (call.kind === 'graphql') {
      if (call.variables.some((each) => !names.includes(each))) {
        throw refuse('sends a variable it does not take');
      }
    } else if (call.tool.trim() === '') {
      throw refuse('calls an MCP tool it does not name');
    }

    return new DescribedOperation(
      input.name,
      input.upstream,
      description,
      input.inputs,
      input.writes,
      call,
    );
  }

  takes(name: string): boolean {
    return this.inputs.some((each) => each.name === name);
  }

  equals(other: DescribedOperation): boolean {
    return this.name === other.name && this.upstream === other.upstream;
  }
}
