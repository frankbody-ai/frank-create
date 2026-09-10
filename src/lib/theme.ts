const THEME_STORAGE_KEY = "as-theme";

export function applyTheme(id?: string) {
  if (typeof document === "undefined") return;
  if (!id || id === "ink") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = id;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id || "ink");
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function storedTheme() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) || "ink";
  } catch {
    return "ink";
  }
}