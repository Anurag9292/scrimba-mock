"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User, UserRole } from "./types";
import { createClient } from "./supabase";
import { setAuthToken, fetchMe } from "./api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setUser(null);
      setAuthToken(null);
      setIsLoading(false);
      return;
    }

    // Store token for API calls
    setAuthToken(session.access_token);

    // Fetch our profile from the backend
    const resp = await fetchMe();
    if (resp.success && resp.data) {
      setUser(resp.data);
    } else {
      setUser(null);
      setAuthToken(null);
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    refreshUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setAuthToken(session.access_token);
          const resp = await fetchMe();
          if (resp.success && resp.data) {
            setUser(resp.data);
          }
        } else {
          setUser(null);
          setAuthToken(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [refreshUser, supabase]);

  const login = useCallback((token: string, userData: User) => {
    setAuthToken(token);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthToken(null);
    setUser(null);
  }, [supabase]);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
