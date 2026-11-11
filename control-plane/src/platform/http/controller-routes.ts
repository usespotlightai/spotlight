import { type INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

export interface ControllerRoute {
  readonly method: string;
  readonly segments: readonly string[];
  readonly name: string;
  marked(marker: symbol): boolean;
}

const pathsOf = (metadata: unknown): string[] => {
  if (Array.isArray(metadata)) {
    return metadata as string[];
  }

  return [typeof metadata === 'string' ? metadata : ''];
};

const segmentsOf = (...parts: string[]): string[] =>
  parts
    .join('/')
    .split('/')
    .filter((part) => part !== '');

export const controllerRoutesOf = (
  app: INestApplication,
): ControllerRoute[] => {
  const reflector = app.get(Reflector);
  const scanner = app.get(MetadataScanner);

  return app
    .get(DiscoveryService)
    .getControllers()
    .flatMap(({ metatype }) => {
      if (!metatype) {
        return [];
      }

      const controller = metatype as new (...args: never[]) => unknown;
      const prototype = controller.prototype as Record<string, () => unknown>;

      return scanner.getAllMethodNames(prototype).flatMap((name) => {
        const handler = prototype[name];
        const own: unknown = Reflect.getMetadata(PATH_METADATA, handler);

        if (own === undefined) {
          return [];
        }

        const method =
          RequestMethod[
            Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod
          ].toLowerCase();
        const marked = (marker: symbol): boolean =>
          reflector.getAllAndOverride<boolean | undefined>(marker, [
            handler,
            controller,
          ]) === true;

        return pathsOf(Reflect.getMetadata(PATH_METADATA, controller)).flatMap(
          (base) =>
            pathsOf(own).map((path) => ({
              method,
              segments: segmentsOf(base, path),
              name: `${controller.name}.${name}`,
              marked,
            })),
        );
      });
    });
};
