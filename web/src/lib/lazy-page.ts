import { type ComponentType, lazy } from 'react';

export const lazyPage = <Module>(
  load: () => Promise<Module>,
  pick: (module: Module) => ComponentType,
) =>
  lazy(() =>
    load().then((module) =>
      module === undefined
        ? new Promise<never>(() => {})
        : { default: pick(module) },
    ),
  );
