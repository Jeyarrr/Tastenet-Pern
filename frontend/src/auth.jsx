import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const Context = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api("/api/auth/me")
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const login = async (identifier, password, rememberMe = false) => {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: { identifier, password, rememberMe },
    });
    setUser(data.user);
    return data.user;
  };
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  };
  const refreshUser = async () => {
    const data = await api("/api/auth/me");
    setUser(data.user);
  };
  return (
    <Context.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </Context.Provider>
  );
}

export function useAuth() {
  return useContext(Context);
}
export const homeFor = (role) => `/${role}`;
