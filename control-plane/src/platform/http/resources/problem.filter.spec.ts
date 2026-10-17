import {
  type ArgumentsHost,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { ProblemException } from '@platform/http/resources/problem.exception';
import { ProblemFilter } from '@platform/http/resources/problem.filter';
import { API_VERSION } from '@platform/http/resources/resource-headers';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it, vi } from 'vitest';

const answering = (exception: unknown) => {
  const headers = new Map<string, string>();
  const reply = vi.fn();
  const error = vi.fn();
  const report = vi.fn();
  const adapterHost = {
    httpAdapter: {
      setHeader: (_: unknown, name: string, value: string) =>
        headers.set(name, value),
      reply,
    },
  } as unknown as HttpAdapterHost;
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url: '/api/integrations/1' }),
      getResponse: () => ({}),
    }),
  } as unknown as ArgumentsHost;

  new ProblemFilter(adapterHost, { error } as unknown as LoggerPort, {
    report,
  }).catch(exception, host);

  const [, body, status] = reply.mock.calls[0] as [unknown, unknown, number];

  return { body, status, headers, error, report };
};

describe('ProblemFilter', () => {
  it('answers a problem as application/problem+json, in this API version', () => {
    const { headers, status } = answering(ProblemException.notFound('line'));

    expect(status).toBe(404);
    expect(headers.get('Content-Type')).toBe('application/problem+json');
    expect(headers.get('Spotlight-Api-Version')).toBe(API_VERSION);
  });

  it('points each invalid field at its path', () => {
    const { body, status } = answering(
      ProblemException.invalid('line', [
        ConfigurationProblem.of({
          path: 'lines/delivery',
          at: FieldPath.dotted('stations.2.check'),
          reason: 'must not be empty',
        }),
      ]),
    );

    expect(status).toBe(422);
    expect(body).toMatchObject({
      type: 'urn:spotlight:problem:invalid',
      errors: [{ path: 'stations[2].check', message: 'must not be empty' }],
    });
  });

  it('names the current version of a resource that changed, as its ETag too', () => {
    const { body, headers } = answering(
      ProblemException.versionConflict('line', 4),
    );

    expect(body).toMatchObject({ status: 409, currentVersion: 4 });
    expect(headers.get('ETag')).toBe('"4"');
  });

  it('turns what Nest and the use cases throw into problems', () => {
    expect(answering(new UnauthorizedException()).body).toMatchObject({
      type: 'urn:spotlight:problem:unauthenticated',
      status: 401,
    });
    expect(answering(new NotFoundException()).status).toBe(404);
    expect(
      answering(new ApplicationError('conflict', 'it moved')).body,
    ).toMatchObject({ status: 409, detail: 'it moved' });
  });

  it('answers a guard or use case that denies as a forbidden problem', () => {
    for (const denial of [
      new ForbiddenException(),
      new ApplicationError('not-allowed', 'not yours'),
    ]) {
      const { body, status, headers } = answering(denial);

      expect(status).toBe(403);
      expect(headers.get('Content-Type')).toBe('application/problem+json');
      expect(body).toMatchObject({
        type: 'urn:spotlight:problem:forbidden',
        status: 403,
      });
    }
  });

  it('logs and reports a fault of its own, and says nothing of it to the caller', () => {
    const surprise = new Error('the disk melted');
    const { body, status, error, report } = answering(surprise);

    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('melted');
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ err: surprise }),
      'Internal error',
    );
    expect(report).toHaveBeenCalledExactlyOnceWith(surprise, {
      source: 'http',
    });
  });

  it('reports no fault of a service upstream, which ApplicationErrorFilter does not report either', () => {
    const { status, report } = answering(
      new ApplicationError('upstream-error', 'GitHub failed'),
    );

    expect(status).toBe(502);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports no problem a caller caused', () => {
    const { report } = answering(ProblemException.notFound('line'));

    expect(report).not.toHaveBeenCalled();
  });
});
