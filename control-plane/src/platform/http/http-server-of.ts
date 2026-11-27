import type { AbstractHttpAdapter, HttpAdapterHost } from '@nestjs/core';

export const httpServerOf = (adapters: HttpAdapterHost): unknown =>
  (adapters.httpAdapter as AbstractHttpAdapter | undefined)?.getHttpServer();
