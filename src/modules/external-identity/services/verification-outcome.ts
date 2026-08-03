export type VerificationOutcome =
  | { readonly verified: false }
  | { readonly verified: true; readonly requesterId: string; readonly integrationId: string };
