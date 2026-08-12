import { createGetKcContext } from "keycloakify";

export const { getKcContext } = createGetKcContext({
  mockData: [
    {
      pageId: "login.ftl",
      locale: { currentLanguageTag: "fr" },
      realmName: "telecom",
      url: { loginAction: "#", localeUrl: "#" },
      login: { username: "" },
    },
  ],
});

export const kcContext = getKcContext();
