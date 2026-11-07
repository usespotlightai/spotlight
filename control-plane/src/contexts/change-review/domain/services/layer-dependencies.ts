export interface NumberedDependency {
  readonly layer: number;
  readonly because: readonly string[];
}

export const mergedByLayer = (
  dependencies: readonly NumberedDependency[],
): Map<number, Set<string>> => {
  const because = new Map<number, Set<string>>();

  for (const dependency of dependencies) {
    because.set(
      dependency.layer,
      new Set([
        ...(because.get(dependency.layer) ?? []),
        ...dependency.because,
      ]),
    );
  }

  return because;
};
