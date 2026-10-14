import {
  GENERATED_AT_MOST,
  generatedTools,
} from '@integrations/domain/services/generated-tools';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import { OperationFilter } from '@integrations/domain/value-objects/operation-filter.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { describe, expect, it } from 'vitest';

const HASH = ContentHash.of('c'.repeat(64));

const SOURCE = DescribedSource.of({
  kind: 'openapi',
  url: 'https://petstore3.swagger.io/api/v3/openapi.json',
  fingerprint: 'petstore',
});

const operation = (
  name: string,
  { writes = false, inputs = [] as string[] } = {},
) =>
  DescribedOperation.of({
    name,
    upstream: name,
    description: `Does ${name}.`,
    inputs: inputs.map((each) => ({
      name: each,
      schema: InputSchema.ofType('string'),
      required: true,
      description: null,
    })),
    writes,
    call: {
      kind: 'http',
      method: writes ? 'POST' : 'GET',
      server: 'https://petstore3.swagger.io/api/v3',
      path: `/${name}`,
      params: [],
      body: null,
    },
  });

const PETS = [
  operation('find-pets'),
  operation('add-pet', { writes: true }),
  operation('delete-pet', { writes: true }),
  operation('get-inventory'),
];

const generating = (
  over: {
    operations?: readonly DescribedOperation[];
    filter?: OperationFilter;
    approvals?: ReadonlyMap<string, ApprovalNeeded | false>;
    handWritten?: readonly string[];
  } = {},
) =>
  generatedTools({
    source: SourceKey.of('petstore'),
    integration: 'Petstore',
    described: SOURCE,
    hash: HASH,
    operations: over.operations ?? PETS,
    filter: over.filter ?? OperationFilter.of({}),
    approvals: over.approvals ?? new Map(),
    handWritten: over.handWritten ?? [],
  });

describe('generatedTools', () => {
  it('offers each operation as a tool backed by it', () => {
    const { tools } = generating();

    expect(tools.map((each) => each.tool)).toEqual([
      'petstore.find-pets',
      'petstore.add-pet',
      'petstore.delete-pet',
      'petstore.get-inventory',
    ]);
    expect(tools[0]?.backing.described).toEqual({
      hash: HASH,
      operation: 'find-pets',
    });
  });

  it('needs approval for an operation that writes, saying where it writes', () => {
    const { tools } = generating();

    expect(tools.map((each) => each.approval?.because ?? null)).toEqual([
      null,
      'It changes data in Petstore.',
      'It changes data in Petstore.',
      null,
    ]);
  });

  it('lets the definition switch an approval off, or say why another way', () => {
    const { tools } = generating({
      approvals: new Map<string, ApprovalNeeded | false>([
        ['add-pet', false],
        [
          'delete-pet',
          ApprovalNeeded.of({ because: 'Deletes a pet for good.' }, 'x'),
        ],
        ['find-pets', ApprovalNeeded.of({ because: 'It costs money.' }, 'x')],
      ]),
    });

    expect(tools.map((each) => each.approval?.because ?? null)).toEqual([
      'It costs money.',
      null,
      'Deletes a pet for good.',
      null,
    ]);
  });

  it('offers only what the filter lets through', () => {
    const { tools } = generating({
      filter: OperationFilter.of({ include: ['*pet*'], exclude: ['delete-*'] }),
    });

    expect(tools.map((each) => each.name)).toEqual(['find-pets', 'add-pet']);
  });

  it('leaves an operation to the hand-written tool of the same name', () => {
    const { tools } = generating({ handWritten: ['add-pet'] });

    expect(tools.map((each) => each.name)).not.toContain('add-pet');
  });

  it('passes over an operation needing approval that takes intent', () => {
    const { tools, passedOver } = generating({
      operations: [operation('add-pet', { writes: true, inputs: ['intent'] })],
    });

    expect(tools).toEqual([]);
    expect(passedOver).toEqual([
      expect.stringMatching(
        /^passes over add-pet\. It needs approval and takes intent/,
      ),
    ]);
    expect(
      generating({
        operations: [
          operation('add-pet', { writes: true, inputs: ['intent'] }),
        ],
        approvals: new Map([['add-pet', false]]),
      }).tools.map((each) => each.name),
    ).toEqual(['add-pet']);
  });

  it('refuses more tools than a station can choose between, asking for a filter', () => {
    const many = Array.from({ length: GENERATED_AT_MOST + 1 }, (_, at) =>
      operation(`op-${at}`),
    );

    expect(() => generating({ operations: many })).toThrow(
      /1001 tools from its OpenAPI description.*openapi.tools.include/,
    );
    expect(
      generating({
        operations: many,
        filter: OperationFilter.of({ include: ['op-1*'] }),
      }).tools.length,
    ).toBeLessThan(GENERATED_AT_MOST);
  });
});
