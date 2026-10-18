import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common';

export const WEBHOOK_PROVIDER = Symbol('WEBHOOK_PROVIDER');

export const WebhookProvider = (): ClassDecorator =>
  applyDecorators(Injectable(), SetMetadata(WEBHOOK_PROVIDER, true));
