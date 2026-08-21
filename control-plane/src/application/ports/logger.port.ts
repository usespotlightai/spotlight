export const LOGGER = Symbol('LOGGER');

export type LogFields = Record<string, unknown>;

export interface LoggerPort {
  debug(fields: LogFields, message: string): void;
  info(fields: LogFields, message: string): void;
  warn(fields: LogFields, message: string): void;
  error(fields: LogFields, message: string): void;
}
