import type { DeclaredService } from '@work/domain/services/compose-services';

/** A service as a Compose file declares it, running from an image of its name unless the test says otherwise. */
export const declared = (
  over: Partial<DeclaredService> & { readonly name: string },
): DeclaredService => ({
  image: `${over.name}:1`,
  builds: false,
  profiled: false,
  command: null,
  env: [],
  health: null,
  dependsOn: [],
  ...over,
});
