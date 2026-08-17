import { i18nBuilder } from 'keycloakify/account';
import type { ThemeName } from '../kc.gen';

const { useI18n, ofTypeI18n } = i18nBuilder
  .withThemeName<ThemeName>()
  .withCustomTranslations({
    fr: {
      accountManagementTitle: 'Gestion du compte',
      accountManagementWelcomeMessage: 'Bienvenue dans votre espace KAMGOKO ITSM',
      authenticatorFinishSetUpMessage:
        "Chaque fois que vous vous connectez à votre espace KAMGOKO ITSM, un code d'authentification à deux facteurs vous sera demandé.",
      authenticatorSMSMessage:
        "KAMGOKO ITSM envoie le code de vérification sur votre téléphone pour l'authentification à deux facteurs.",
    },
    en: {
      accountManagementTitle: 'Account Management',
      accountManagementWelcomeMessage: 'Welcome to your KAMGOKO ITSM account',
      authenticatorFinishSetUpMessage:
        'Each time you sign in to your KAMGOKO ITSM account, you will be asked to provide a two-factor authentication code.',
      authenticatorSMSMessage:
        'KAMGOKO ITSM will send the verification code to your phone for two-factor authentication.',
    },
  })
  .build();

type I18n = typeof ofTypeI18n;

export { useI18n, type I18n };
