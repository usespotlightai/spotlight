import {
  type ArgumentsHost,
  BadRequestException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { ServerFaultFilter } from '@presentation/http/filters/server-fault.filter';
import type { PinoLogger } from 'nestjs-pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const REQUEST = { method: 'GET', url: '/api/boom' };

function setup() {
  const reply = vi.fn();
  const adapterHost = {
    httpAdapter: { isHeadersSent: () => false, reply, end: vi.fn() },
  } as unknown as HttpAdapterHost;

  const logger = { error: vi.fn() } as unknown as PinoLogger;

  const host = {
    switchToHttp: () => ({ getRequest: () => REQUEST }),
    getArgByIndex: () => ({}),
  } as unknown as ArgumentsHost;

  return {
    filter: new ServerFaultFilter(adapterHost, logger),
    host,
    reply,
    error: logger.error as unknown as ReturnType<typeof vi.fn>,
  };
}

describe('ServerFaultFilter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs 5xx HttpExceptions, which Nest otherwise drops silently', () => {
    const { filter, host, reply, error } = setup();
    const exception = new ServiceUnavailableException('db unreachable');

    filter.catch(exception, host);

    expect(error).toHaveBeenCalledTimes(1);
    const [payload, message] = error.mock.calls[0];
    expect(message).toBe('Server fault');
    expect(payload).toMatchObject({ method: 'GET', url: '/api/boom' });
    expect(payload.err).toBe(exception);
    expect(payload.err.stack).toContain('ServiceUnavailableException');

    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  });

  it('leaves 4xx to the request-completed line', () => {
    const { filter, host, reply, error } = setup();

    filter.catch(new BadRequestException('nope'), host);

    expect(error).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      HttpStatus.BAD_REQUEST,
    );
  });
});
