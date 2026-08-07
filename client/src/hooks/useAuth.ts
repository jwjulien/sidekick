import { createSignal, createEffect } from "solid-js";
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

// ----------------- Configuration & Signals -----------------
const defaultBackendUrl = "http://localhost:8000";

// Load initial config from localStorage
const [backendUrl, setBackendUrl] = createSignal(
  localStorage.getItem("sidekick_backend_url") || defaultBackendUrl
);
const [token, setToken] = createSignal<string | null>(
  localStorage.getItem("sidekick_token")
);
const [user, setUser] = createSignal<{
  id: number;
  oidc_sub: string;
  email: string | null;
  username: string | null;
  role: string;
} | null>(null);
const [isAuthenticated, setIsAuthenticated] = createSignal<boolean>(false);
const [isLoading, setIsLoading] = createSignal<boolean>(true);
const [isDevMode, setIsDevMode] = createSignal<boolean>(
  localStorage.getItem("sidekick_dev_mode") !== "false" // default to true for easy setup
);

// OIDC Settings Signals
const [oidcIssuer, setOidcIssuer] = createSignal(
  localStorage.getItem("sidekick_oidc_issuer") || ""
);
const [oidcClientId, setOidcClientId] = createSignal(
  localStorage.getItem("sidekick_oidc_client_id") || "sidekick-client"
);

// Save URL changes
createEffect(() => {
  localStorage.setItem("sidekick_backend_url", backendUrl());
});
createEffect(() => {
  localStorage.setItem("sidekick_dev_mode", String(isDevMode()));
});
createEffect(() => {
  localStorage.setItem("sidekick_oidc_issuer", oidcIssuer());
  localStorage.setItem("sidekick_oidc_client_id", oidcClientId());
});

// Setup OIDC UserManager
let userManager: UserManager | null = null;

function getOidcUserManager(): UserManager | null {
  if (isDevMode() || !oidcIssuer()) {
    userManager = null;
    return null;
  }
  
  if (userManager) return userManager;
  
  userManager = new UserManager({
    authority: oidcIssuer(),
    client_id: oidcClientId(),
    redirect_uri: `${window.location.origin}/auth-callback`,
    post_logout_redirect_uri: window.location.origin,
    response_type: "code",
    scope: "openid profile email",
    userStore: new WebStorageStateStore({ store: window.localStorage })
  });
  
  return userManager;
}

// ----------------- Fetch Helper (With Auth Header) -----------------
export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${backendUrl()}/${path.replace(/^\//, "")}`;
  const headers = new Headers(options.headers || {});
  
  const currentToken = token();
  if (currentToken) {
    headers.set("Authorization", `Bearer ${currentToken}`);
  }
  
  const res = await fetch(url, {
    ...options,
    headers
  });
  
  if (res.status === 401) {
    // Session expired / invalid
    logout();
    throw new Error("Authentication session expired.");
  }
  
  if (!res.ok) {
    let errorDetail = "Server request failed.";
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errorDetail;
    } catch (_) {}
    throw new Error(errorDetail);
  }
  
  if (res.status === 204) return null;
  return res.json();
}

// ----------------- Auth Operations -----------------
export async function initializeAuth() {
  setIsLoading(true);
  
  const currentToken = token();
  if (!currentToken) {
    setIsAuthenticated(false);
    setUser(null);
    setIsLoading(false);
    return;
  }
  
  try {
    // Validate token against backend and get profile info
    const profile = await apiFetch("/auth/me");
    setUser(profile);
    setIsAuthenticated(true);
  } catch (err) {
    console.error("Auth validation failed:", err);
    logout();
  } finally {
    setIsLoading(false);
  }
}

export async function loginDev(role: string) {
  setIsLoading(true);
  try {
    const mockToken = `dev-${role}`;
    setToken(mockToken);
    localStorage.setItem("sidekick_token", mockToken);
    
    // Fetch newly provisioned dev user profile
    const profile = await apiFetch("/auth/me");
    setUser(profile);
    setIsAuthenticated(true);
  } catch (err) {
    console.error("Dev login failed:", err);
    logout();
  } finally {
    setIsLoading(false);
  }
}

export async function loginOidc() {
  const um = getOidcUserManager();
  if (!um) {
    throw new Error("OIDC issuer is not configured or Dev Mode is active.");
  }
  await um.signinRedirect();
}

export async function handleOidcCallback() {
  setIsLoading(true);
  const um = getOidcUserManager();
  if (!um) {
    throw new Error("OIDC Manager is not configured.");
  }
  
  try {
    const oidcUser = await um.signinRedirectCallback();
    const accessToken = oidcUser.access_token;
    
    setToken(accessToken);
    localStorage.setItem("sidekick_token", accessToken);
    
    // Fetch provisioned database user info
    const profile = await apiFetch("/auth/me");
    setUser(profile);
    setIsAuthenticated(true);
  } catch (err) {
    console.error("OIDC callback parsing failed:", err);
    logout();
    throw err;
  } finally {
    setIsLoading(false);
  }
}

export function logout() {
  setToken(null);
  setUser(null);
  setIsAuthenticated(false);
  localStorage.removeItem("sidekick_token");
  
  const um = getOidcUserManager();
  if (um) {
    um.signoutRedirect().catch(err => console.error("OIDC logout redirect failed:", err));
  }
}

// ----------------- Exports -----------------
export {
  backendUrl, setBackendUrl,
  token,
  user, setUser,
  isAuthenticated,
  isLoading,
  isDevMode, setIsDevMode,
  oidcIssuer, setOidcIssuer,
  oidcClientId, setOidcClientId,
  getOidcUserManager
};
