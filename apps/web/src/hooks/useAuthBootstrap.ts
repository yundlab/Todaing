import { useEffect, useState } from "react";
import {
  AUTH_SESSION_LS_KEY,
  AUTH_USER_LS_KEY,
  decodeAuthSessionPayload,
  decodeGsiUserPayload,
  readStoredSessionToken,
  type AuthUser
} from "@/lib/auth";

/**
 * JWT·GSI 쿼리 처리 및 로컬에서 세션/표시용 사용자 복원.
 */
export function useAuthBootstrap() {
  const [sessionReady, setSessionReady] = useState(() => {
    try {
      const tok = readStoredSessionToken();
      return Boolean(tok && decodeAuthSessionPayload(tok));
    } catch {
      return false;
    }
  });

  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const tok = readStoredSessionToken();
      const fromJwt = tok ? decodeAuthSessionPayload(tok) : null;
      if (fromJwt) {
        let picture: string | undefined;
        try {
          const raw = window.localStorage.getItem(AUTH_USER_LS_KEY);
          if (raw) picture = (JSON.parse(raw) as AuthUser).picture;
        } catch {
          void 0;
        }
        return { email: fromJwt.email, name: fromJwt.name, picture };
      }
      const raw = window.localStorage.getItem(AUTH_USER_LS_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionRaw = url.searchParams.get("auth_session");
    if (sessionRaw) {
      const token = decodeURIComponent(sessionRaw);
      window.localStorage.setItem(AUTH_SESSION_LS_KEY, token);
      const p = decodeAuthSessionPayload(token);
      if (p) {
        let picture: string | undefined;
        const g = url.searchParams.get("gsi_user");
        if (g) {
          const u = decodeGsiUserPayload<AuthUser>(g);
          if (u?.picture) picture = u.picture;
        }
        setAuthUser({ email: p.email, name: p.name, picture });
        setSessionReady(true);
      } else {
        try {
          window.localStorage.removeItem(AUTH_SESSION_LS_KEY);
        } catch {
          void 0;
        }
      }
      url.searchParams.delete("auth_session");
    }
    const rawGsi = url.searchParams.get("gsi_user");
    if (rawGsi) {
      const u = decodeGsiUserPayload<AuthUser>(rawGsi);
      if (u?.email) {
        try {
          window.localStorage.setItem(AUTH_USER_LS_KEY, JSON.stringify(u));
        } catch {
          void 0;
        }
        setAuthUser(u);
      }
      url.searchParams.delete("gsi_user");
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  return { sessionReady, setSessionReady, authUser, setAuthUser };
}
