import { PublicSupportConfigService } from '../../../config/public-support.config';
import { policyNumber } from '../../../common/utils/helpers';

export function trustedDevicePolicy(policy: Record<string, unknown>, config: PublicSupportConfigService) {
  return {
    days: policyNumber(policy, 'trustedDeviceDays', config.trustedDeviceDays),
    version: policyNumber(policy, 'policyVersion', config.trustedDevicePolicyVersion),
    renewalWindowDays: policyNumber(policy, 'renewalWindowDays', 7),
  };
}
