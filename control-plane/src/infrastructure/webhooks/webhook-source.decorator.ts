import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common';

export const WEBHOOK_SOURCE = Symbol('WEBHOOK_SOURCE');

export const WebhookSource = (): ClassDecorator =>
  applyDecorators(Injectable(), SetMetadata(WEBHOOK_SOURCE, true));
