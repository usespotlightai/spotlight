import type { Journalled } from '@infrastructure/acp/told';
import { Reported } from '@infrastructure/otel/spans';
import { describe, expect, it } from 'vitest';

const AT = Date.UTC(2026, 7, 29, 12, 0, 0);

/** Nanoseconds, which is what the wire counts in. */
const nanos = (ms: number): string => `${BigInt(ms) * 1_000_000n}`;

const exported = (span: Record<string, unknown>): Journalled => ({
  type: 'span',
  at: new Date(AT),
  message: null,
  data: Buffer.from(JSON.stringify(span)).toString('base64'),
});

const read = (...spans: Record<string, unknown>[]) => {
  const reported = new Reported();
  spans.forEach((span) => reported.take(exported(span)));
  return reported;
};

const call = {
  spanId: 'a1',
  parentSpanId: 'root',
  name: 'claude_code.llm_request',
  startTimeUnixNano: nanos(AT),
  endTimeUnixNano: nanos(AT + 4_350),
};

describe('Reported', () => {
  it('reads a span into something that can be laid against a clock', () => {
    const [span] = read(call).spans();

    expect(span).toEqual({
      id: 'a1',
      parentId: 'root',
      name: 'claude_code.llm_request',
      startedAt: new Date(AT).toISOString(),
      ms: 4_350,
      failed: false,
      attributes: [],
    });
  });

  // Which model answered is the one thing the protocol could never say.
  it('keeps what a span said about itself, whatever it said', () => {
    const [span] = read({
      ...call,
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-5' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 1_204 } },
        { key: 'gen_ai.response.streaming', value: { boolValue: true } },
      ],
    }).spans();

    expect(span?.attributes).toEqual([
      { name: 'gen_ai.request.model', value: 'claude-opus-5' },
      { name: 'gen_ai.usage.input_tokens', value: '1204' },
      { name: 'gen_ai.response.streaming', value: 'true' },
    ]);
  });

  it('keeps an attribute that is a shape of its own as it reads', () => {
    const [span] = read({
      ...call,
      attributes: [
        {
          key: 'gen_ai.response.finish_reasons',
          value: { arrayValue: { values: [{ stringValue: 'end_turn' }] } },
        },
      ],
    }).spans();

    expect(span?.attributes[0]?.value).toContain('end_turn');
  });

  it('tells a span that went wrong from one that did not', () => {
    const failed = read({ ...call, status: { code: 2 } }).spans();
    const fine = read({ ...call, status: { code: 1 } }).spans();

    expect(failed[0]?.failed).toBe(true);
    expect(fine[0]?.failed).toBe(false);
  });

  // A harness exports in batches, so a span still running has no end yet.
  it('gives an unfinished span no length rather than a negative one', () => {
    const [span] = read({ ...call, endTimeUnixNano: undefined }).spans();

    expect(span?.ms).toBe(0);
  });

  it('leaves a span nowhere to hang if it has no parent', () => {
    const [span] = read({ ...call, parentSpanId: '' }).spans();

    expect(span?.parentId).toBeNull();
  });

  // There is nothing to draw for either, and a run is worth more than its
  // telemetry: neither is an error.
  it('passes over a span with no identity or no beginning', () => {
    expect(read({ ...call, spanId: undefined }).spans()).toEqual([]);
    expect(read({ ...call, startTimeUnixNano: undefined }).spans()).toEqual([]);
  });

  it('passes over everything that is not a span', () => {
    const reported = new Reported();

    reported.take({
      type: 'output',
      at: new Date(AT),
      message: null,
      data: Buffer.from('{"update":{}}').toString('base64'),
    });
    reported.take({
      type: 'span',
      at: new Date(AT),
      message: null,
      data: 'not base64 json at all',
    });

    expect(reported.spans()).toEqual([]);
  });

  it('has nothing to report for a harness that reported nothing', () => {
    expect(new Reported().spans()).toEqual([]);
  });
});
