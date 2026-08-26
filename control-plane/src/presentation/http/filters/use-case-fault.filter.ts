import {
  UseCaseFault,
  type UseCaseFaultKind,
} from '@application/errors/use-case.fault';
import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  type HttpException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

const AS_HTTP: Record<UseCaseFaultKind, (message: string) => HttpException> = {
  conflict: (message) => new ConflictException(message),
  'invalid-input': (message) => new UnprocessableEntityException(message),
  'not-found': (message) => new NotFoundException(message),
};

@Catch(UseCaseFault)
export class UseCaseFaultFilter extends BaseExceptionFilter {
  override catch(exception: UseCaseFault, host: ArgumentsHost): void {
    super.catch(AS_HTTP[exception.kind](exception.message), host);
  }
}
