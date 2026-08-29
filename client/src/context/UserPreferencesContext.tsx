import { createContext, useContext, createSignal, createEffect, JSX, type Accessor } from "solid-js";
import { user, apiFetch } from "../hooks/useAuth";

export interface UserPreferences {
  defaultHomeLocationId?: string;
  defaultPartsViewMode?: "grid" | "table";
  tableColumnVisibility?: Record<string, boolean>;
  savedFilterPresets?: Record<string, any>;
  [key: string]: any;
}

interface UserPreferencesContextType {
  preferences: Accessor<UserPreferences>;
  updatePreference: (key: string, value: any) => Promise<void>;
  loading: Accessor<boolean>;
}

const UserPreferencesContext = createContext<UserPreferencesContextType>();

export function UserPreferencesProvider(props: { children: JSX.Element }) {
  const [preferences, setPreferences] = createSignal<UserPreferences>({});
  const [loading, setLoading] = createSignal<boolean>(false);

  const fetchPreferences = async () => {
    if (!user()) return;
    setLoading(true);
    try {
      const data = await apiFetch("/auth/me/preferences");
      setPreferences(data || {});
    } catch (err) {
      console.error("Failed to fetch user preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (user()) {
      fetchPreferences();
    } else {
      setPreferences({});
    }
  });

  const updatePreference = async (key: string, value: any) => {
    const updated = { ...preferences(), [key]: value };
    setPreferences(updated);
    if (!user()) return;
    try {
      await apiFetch("/auth/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { [key]: value } })
      });
    } catch (err) {
      console.error(`Failed to update preference ${key}:`, err);
    }
  };

  return (
    <UserPreferencesContext.Provider value={{ preferences, updatePreference, loading }}>
      {props.children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error("useUserPreferences must be used within a UserPreferencesProvider");
  }
  return context;
}
