export const actsOutsideSpotlight = (stack: {
  readonly trial: boolean;
}): boolean => !stack.trial;
