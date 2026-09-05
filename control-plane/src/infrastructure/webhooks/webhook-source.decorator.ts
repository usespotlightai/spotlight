import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common';

export const WEBHOOK_SOURCE = Symbol('WEBHOOK_SOURCE');

/**
 * Marks a class as one of the hosts Spotlight listens to. A source wearing
 * this and listed among the providers is registered; there is no second
 * place to add it to, and so no second place to forget.
 */
export const WebhookSource = (): ClassDecorator =>
  applyDecorators(Injectable(), SetMetadata(WEBHOOK_SOURCE, true));
