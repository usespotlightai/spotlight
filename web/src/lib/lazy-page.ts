import { type ComponentType, createElement, lazy, useState } from 'react';

export type LazyPage = ComponentType & {
  readonly preload: () => Promise<unknown>;
};

export const isLazyPage = (type: unknown): type is LazyPage =>
  typeof type === 'function' &&
  typeof (type as Partial<LazyPage>).preload === 'function';

export const lazyPage = <Module>(
  load: () => Promise<Module>,
  pick: (module: Module) => ComponentType,
): LazyPage => {
  let loaded: ComponentType | undefined;
  let loading: Promise<Module> | undefined;

  const preload = () => {
    loading ??= load().then(
      (module) => {
        if (module !== undefined) {
          loaded = pick(module);
        }
        return module;
      },
      (error: unknown) => {
        loading = undefined;
        throw error;
      },
    );
    return loading;
  };

  const Lazy = lazy(() =>
    preload().then((module) =>
      module === undefined
        ? new Promise<never>(() => {})
        : { default: pick(module) },
    ),
  );

  function Page() {
    const [Shown] = useState<ComponentType>(() => loaded ?? Lazy);
    return createElement(Shown);
  }

  return Object.assign(Page, { preload });
};
