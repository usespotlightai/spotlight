import {
  DescribedOperation,
  type OperationCall,
} from '@integrations/domain/value-objects/described-operation.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { describe, expect, it } from 'vitest';

const CALL: OperationCall = {
  kind: 'http',
  method: 'GET',
  server: 'https://pets.example',
  path: '/pet/{petId}',
  params: [{ name: 'petId', in: 'path', style: 'simple', explode: false }],
  body: null,
};

const described = (
  over: Partial<Parameters<typeof DescribedOperation.of>[0]> = {},
) =>
  DescribedOperation.of({
    name: 'get-pet',
    upstream: 'getPet',
    description: 'Find a pet.',
    inputs: [
      {
        name: 'petId',
        schema: InputSchema.ofType('integer'),
        required: true,
        description: null,
      },
    ],
    writes: false,
    call: CALL,
    ...over,
  });

describe('DescribedOperation', () => {
  it('keeps what an operation takes and how it is called', () => {
    expect(described().takes('petId')).toBe(true);
    expect(described().call).toEqual(CALL);
  });

  it('is named in lowercase words joined by dashes', () => {
    expect(() => described({ name: 'getPet' })).toThrow(/lowercase words/);
  });

  it('says what it does', () => {
    expect(() => described({ description: ' ' })).toThrow(/says nothing/);
  });

  it('takes nothing a tool cannot, nor anything twice', () => {
    const named = (name: string) => ({
      name,
      schema: InputSchema.of({}),
      required: false,
      description: null,
    });

    expect(() =>
      described({ inputs: [named('petId'), named('$select')] }),
    ).toThrow(/takes "\$select"/);
    expect(() =>
      described({ inputs: [named('petId'), named('json')] }),
    ).toThrow(/takes "json"/);
    expect(() =>
      described({ inputs: [named('petId'), named('petId')] }),
    ).toThrow(/twice/);
  });

  it('sends only what it takes', () => {
    expect(() => described({ inputs: [] })).toThrow(/does not take/);
    expect(() =>
      described({
        call: {
          kind: 'graphql',
          endpoint: 'https://api.linear.app/graphql',
          operation: 'query',
          field: 'issue',
          document: 'query issue($id: String!) { issue(id: $id) { id } }',
          variables: ['id'],
        },
      }),
    ).toThrow(/variable it does not take/);
  });
});
