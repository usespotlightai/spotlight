const FETCH = 'git-upload-pack';

export const CheckGitAccess = {
  mayCall(service: string): boolean {
    return service === FETCH;
  },
};
