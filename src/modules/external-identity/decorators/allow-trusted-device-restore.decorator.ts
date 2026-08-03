import { SetMetadata } from '@nestjs/common';

export const TRUSTED_DEVICE_RESTORE_KEY = 'publicSupport:allowTrustedDeviceRestore';
export const AllowTrustedDeviceRestore = () => SetMetadata(TRUSTED_DEVICE_RESTORE_KEY, true);
