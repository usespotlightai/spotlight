import {
  type ArgumentsHost,
  BadGatewayException,
  Catch,
  ConflictException,
  ForbiddenException,
  type HttpException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ErrorKind } from '@shared-kernel/domain/exceptions/error-kind';

const AS_HTTP: Record<ErrorKind, (message: string) => HttpException> = {
  conflict: (message) => new ConflictException(message),
  invalid: (message) => new UnprocessableEntityException(message),
  'not-allowed': (message) => new ForbiddenException(message),
  'not-found': (message) => new NotFoundException(message),
  'upstream-error': (message) => new BadGatewayException(message),
};

export const httpExceptionOf = (error: ApplicationError): HttpException =>
  AS_HTTP[error.kind](error.message);

@Catch(ApplicationError)
export class ApplicationErrorFilter extends BaseExceptionFilter {
  override catch(exception: ApplicationError, host: ArgumentsHost): void {
    super.catch(httpExceptionOf(exception), host);
  }
}
