export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const LOGIN_PATH = "/login";

/** Send the browser to the sign-in screen, returning here afterwards. */
export const goToLogin = () => {
  if (typeof window === "undefined" || window.location.pathname === LOGIN_PATH) return;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.href = `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
};
