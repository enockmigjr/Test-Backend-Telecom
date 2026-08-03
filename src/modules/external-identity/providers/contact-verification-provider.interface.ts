export const CONTACT_VERIFICATION_PROVIDER = Symbol('CONTACT_VERIFICATION_PROVIDER');

export interface ContactVerificationProvider {
  sendEmailCode(destination: string, code: string, expiresInSeconds: number): Promise<void>;
}
