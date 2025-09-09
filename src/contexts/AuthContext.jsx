import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { ensureUserDoc } from "../lib/users";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
  const unsub = onAuthStateChanged(auth, (u) => {
    setUser(u ?? null);                     
    if (u) ensureUserDoc(u).catch(console.warn); 
  });
  return () => unsub();
}, []);


  return <AuthCtx.Provider value={{ user }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
