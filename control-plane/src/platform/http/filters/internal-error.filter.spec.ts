import {
  type ArgumentsHost,
  BadRequestException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { InternalErrorFilter } from '@platform/http/filters/internal-error.filter';
import { refusalOf } from '@platform/http/refusal';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const REQUEST = { method: 'GET', url: '/api/boom' };

function setup() {
  const reply = vi.fn();
  const response = {};
  const adapterHost = {
    httpAdapter: { isHeadersSent: () => false, reply, end: vi.fn() },
  } as unknown as HttpAdapterHost;

  const logger = { error: vi.fn() } as unknown as LoggerPort;
  const reports = { report: vi.fn() };

  const host = {
    switchToHttp: () => ({
      getRequest: () => REQUEST,
      getResponse: () => response,
    }),
    getArgByIndex: () => ({}),
  } as unknown as ArgumentsHost;

  return {
    filter: new InternalErrorFilter(adapterHost, logger, reports),
    host,
    response,
    reply,
    reported: reports.report,
    error: logger.error as unknown as ReturnType<typeof vi.fn>,
  };
}

describe('InternalErrorFilter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs and reports 5xx HttpExceptions, which Nest otherwise drops silently', () => {
    const { filter, host, reply, error, reported } = setup();
    const exception = new ServiceUnavailableException('db unreachable');

    filter.catch(exception, host);

    expect(error).toHaveBeenCalledTimes(1);
    const [payload, message] = error.mock.calls[0];
    expect(message).toBe('Internal error');
    expect(payload).toMatchObject({ method: 'GET', url: '/api/boom' });
    expect(payload.err).toBe(exception);
    expect(payload.err.stack).toContain('ServiceUnavailableException');
    expect(reported).toHaveBeenCalledExactlyOnceWith(exception, {
      source: 'http',
    });

    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  });

  it('leaves 4xx to the request-completed line', () => {
    const { filter, host, response, reply, error, reported } = setup();

    filter.catch(new BadRequestException('nope'), host);

    expect(refusalOf(response)).toEqual({ error: 'BadRequestException' });

    expect(error).not.toHaveBeenCalled();
    expect(reported).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      HttpStatus.BAD_REQUEST,
    );
  });
});
