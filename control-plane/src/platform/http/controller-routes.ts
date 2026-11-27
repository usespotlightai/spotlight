import { type INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

export interface ControllerRoute {
  readonly method: string;
  readonly segments: readonly string[];
  readonly name: string;
  marked(marker: symbol): boolean;
}

type Decorated = NonNullable<InstanceWrapper['metatype']>;

export interface ControllerMethod {
  readonly controller: Decorated;
  readonly name: string;
  readonly handler: Decorated;
  readonly own: unknown;
}

export const pathsOf = (metadata: unknown): string[] => {
  if (Array.isArray(metadata)) {
    return metadata.filter((each): each is string => typeof each === 'string');
  }

  return [typeof metadata === 'string' ? metadata : ''];
};

export const requestMethodOf = (method: ControllerMethod): string => {
  const metadata: unknown = Reflect.getMetadata(
    METHOD_METADATA,
    method.handler,
  );

  if (typeof metadata !== 'number') {
    throw new Error(`${method.name} has no request method`);
  }

  return RequestMethod[metadata].toLowerCase();
};

export const controllerMethodsOf = (
  app: INestApplication,
): ControllerMethod[] => {
  const scanner = app.get(MetadataScanner);

  return app
    .get(DiscoveryService)
    .getControllers()
    .flatMap(({ metatype }) => {
      if (!metatype) {
        return [];
      }

      const prototype: unknown = metatype.prototype;

      if (typeof prototype !== 'object' || prototype === null) {
        return [];
      }

      return scanner.getAllMethodNames(prototype).flatMap((name) => {
        const handler: unknown = Reflect.get(prototype, name);

        if (typeof handler !== 'function') {
          return [];
        }

        const own: unknown = Reflect.getMetadata(PATH_METADATA, handler);

        return own === undefined
          ? []
          : [{ controller: metatype, name, handler, own }];
      });
    });
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

  return controllerMethodsOf(app).flatMap((each) => {
    const { controller, name, handler, own } = each;
    const method = requestMethodOf(each);
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
};
