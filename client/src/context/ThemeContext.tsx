import { createContext, useContext, createSignal, onMount, type JSX, type Accessor } from "solid-js";

export type ThemeMode = "system" | "dark" | "light";
export type EffectiveTheme = "dark" | "light";

interface ThemeContextType {
  theme: Accessor<ThemeMode>;
  effectiveTheme: Accessor<EffectiveTheme>;
  setTheme: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "sidekick_app_theme";

const ThemeContext = createContext<ThemeContextType>();

export function ThemeProvider(props: { children: JSX.Element }) {
  const storedTheme = (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "system";
  const [theme, setSystemOrCustomTheme] = createSignal<ThemeMode>(
    ["system", "dark", "light"].includes(storedTheme) ? storedTheme : "system"
  );

  const getSystemTheme = (): EffectiveTheme => {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  const [effectiveTheme, setEffectiveTheme] = createSignal<EffectiveTheme>(
    theme() === "system" ? getSystemTheme() : (theme() as EffectiveTheme)
  );

  const updateEffectiveTheme = () => {
    const currentMode = theme();
    let effective: EffectiveTheme;
    if (currentMode === "system") {
      effective = getSystemTheme();
    } else {
      effective = currentMode;
    }
    setEffectiveTheme(effective);
    document.documentElement.setAttribute("data-theme", effective);
  };

  const setTheme = (mode: ThemeMode) => {
    setSystemOrCustomTheme(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    updateEffectiveTheme();
  };

  onMount(() => {
    updateEffectiveTheme();

    // System dark mode media query listener
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme() === "system") {
        updateEffectiveTheme();
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }
  });

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
