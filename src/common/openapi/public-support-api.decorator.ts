import { ApiExtension } from '@nestjs/swagger';

export const PUBLIC_SUPPORT_AUDIENCE_EXTENSION = 'x-api-audience';
export const PUBLIC_SUPPORT_AUDIENCE = 'public-support';

/** Marque explicitement une opération destinée au contrat du support public. */
export const PublicSupportApi = () => ApiExtension(PUBLIC_SUPPORT_AUDIENCE_EXTENSION, PUBLIC_SUPPORT_AUDIENCE);
