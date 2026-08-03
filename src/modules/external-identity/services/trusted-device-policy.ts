import { PublicSupportConfigService } from '../../../config/public-support.config';

export function trustedDevicePolicy(policy: Record<string, unknown>, config: PublicSupportConfigService) {
  return {
    days: policyNumber(policy, 'trustedDeviceDays', config.trustedDeviceDays),
    version: policyNumber(policy, 'policyVersion', config.trustedDevicePolicyVersion),
    renewalWindowDays: policyNumber(policy, 'renewalWindowDays', 7),
  };
}

export function policyNumber(policy: Record<string, unknown>, key: string, fallback: number): number {
  const value = policy[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
