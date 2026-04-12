import { create } from "zustand";
import type { User } from "../types";

const TOKEN_KEY = "auth_token";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  initialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  restoreFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  initialized: false,

  restoreFromStorage: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      // Decode payload without verifying (server will validate)
      try {
        const payloadB64 = token.split(".")[1];
        const payload = JSON.parse(atob(payloadB64));
        if (payload.exp * 1000 > Date.now()) {
          set({
            token,
            user: { id: payload.sub, username: payload.username, created_at: "" },
            isAuthenticated: true,
            initialized: true,
          });
          return;
        }
      } catch {
        // invalid token
      }
      localStorage.removeItem(TOKEN_KEY);
    }
    set({ initialized: true });
  },

  login: async (username, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail ?? "登录失败");
    }
    const data = await res.json();
    const token: string = data.access_token;
    localStorage.setItem(TOKEN_KEY, token);

    // Fetch user info
    const meRes = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user: User = meRes.ok ? await meRes.json() : { id: "", username, created_at: "" };

    set({ token, user, isAuthenticated: true });
  },

  register: async (username, password) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail ?? "注册失败");
    }
    // Auto-login after registration
    await get().login(username, password);
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
