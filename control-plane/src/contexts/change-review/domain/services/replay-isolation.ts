export const reachesBeyondSpotlight = (stack: {
  readonly replay: boolean;
}): boolean => !stack.replay;
