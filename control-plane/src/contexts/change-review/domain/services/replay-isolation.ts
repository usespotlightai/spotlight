export const actsOutsideSpotlight = (stack: {
  readonly replay: boolean;
}): boolean => !stack.replay;
