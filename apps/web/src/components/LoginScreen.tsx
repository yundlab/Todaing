import { useEffect, useRef, useState } from "react";
import { config } from "../lib/config";
import { safeParseJwtPayload, type AuthUser } from "../lib/auth";
import TodaingLogoMark from "./TodaingLogoMark";

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    __gsiScriptPromise?: Promise<void>;
    __gsiInitialized?: boolean;
  }
}

type GsiInitConfig = {
  client_id: string;
  ux_mode: "redirect" | "popup";
  login_uri: string;
  // eslint-disable-next-line no-unused-vars
  callback: (resp: { credential?: string }) => void;
};

type GsiButtonOptions = {
  theme: string;
  size: string;
  shape: string;
  text: string;
  locale: string;
  width: number;
};

type GoogleAccountsId = {
  // eslint-disable-next-line no-unused-vars
  initialize: (config: GsiInitConfig) => void;
  // eslint-disable-next-line no-unused-vars
  renderButton: (el: HTMLElement, options: GsiButtonOptions) => void;
};

function getGoogleAccountsId(): GoogleAccountsId | undefined {
  return (window as unknown as { google?: { accounts?: { id?: GoogleAccountsId } } }).google
    ?.accounts?.id;
}

function loadGsiScript(): Promise<void> {
  if (window.__gsiScriptPromise) return window.__gsiScriptPromise;

  window.__gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-google-identity='1']"
    );
    if (existing) {
      // 스크립트 태그는 있지만 API가 아직이면 잠깐 대기
      const waitForReady = () => {
        if (getGoogleAccountsId()) resolve();
        else setTimeout(waitForReady, 50);
      };
      waitForReady();
      return;
    }

    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client?hl=ko";
    s.async = true;
    s.defer = true;
    s.dataset.googleIdentity = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GSI script load failed"));
    document.head.appendChild(s);
  });
  return window.__gsiScriptPromise;
}

function payloadToAuthUser(payload: Record<string, unknown> | null): AuthUser | null {
  if (!payload?.email) return null;
  const email = String(payload.email);
  return {
    name: payload.name ? String(payload.name) : email,
    email,
    picture: payload.picture ? String(payload.picture) : undefined
  };
}

export default function LoginScreen({
  onLogin
}: {
  // eslint-disable-next-line no-unused-vars
  onLogin: (_u: AuthUser) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const onLoginRef = useRef(onLogin);

  useEffect(() => {
    onLoginRef.current = onLogin;
  }, [onLogin]);

  useEffect(() => {
    const clientId = config.googleClientId;
    if (!clientId) return;

    const renderSignInButton = () => {
      try {
        const accountsId = getGoogleAccountsId();
        if (!accountsId) return;

        // StrictMode + 의존성 문제로 initialize()가 중복 호출되면 팝업/리다이렉트가 두 번 뜰 수 있음
        if (!window.__gsiInitialized) {
          const loginUri = `${config.apiBaseUrl.replace(/\/$/, "")}/auth/google`;
          accountsId.initialize({
            client_id: clientId,
            // 단일 탭 흐름 강제 — 빈 탭 + 로그인 탭으로 갈라지는 것을 방지
            ux_mode: "redirect",
            login_uri: loginUri,
            callback: (resp) => {
              const user = payloadToAuthUser(
                resp?.credential ? safeParseJwtPayload(resp.credential) : null
              );
              if (!user) {
                setError("로그인 정보를 가져오지 못했어요.");
                return;
              }
              onLoginRef.current(user);
            }
          });
          window.__gsiInitialized = true;
        }

        const buttonEl = document.getElementById("googleSignIn");
        if (!buttonEl) return;
        buttonEl.innerHTML = "";
        accountsId.renderButton(buttonEl, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          locale: "ko",
          width: 320
        });
      } catch {
        setError("구글 로그인 초기화에 실패했어요.");
      }
    };

    loadGsiScript()
      .then(renderSignInButton)
      .catch(() => setError("구글 로그인 스크립트를 불러오지 못했어요."));
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white px-4">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6">
        <div className="flex flex-col items-center text-center">
          <TodaingLogoMark size="lg" />

          <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Todaing</div>
          <div className="mt-1 text-sm font-semibold text-slate-500">오늘을 한 장으로</div>

          <div className="mt-10 w-full">
            {!config.googleClientId ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                `VITE_GOOGLE_CLIENT_ID`가 설정되지 않았어요. `apps/web/.env`에 구글 Client ID를 넣어줘.
              </div>
            ) : (
              <div className="flex justify-center">
                <div id="googleSignIn" className="cursor-pointer" />
                <style>{`
                  #googleSignIn { cursor: pointer !important; }
                  #googleSignIn iframe { cursor: pointer !important; }
                `}</style>
              </div>
            )}
            {error ? (
              <div className="mt-3 text-center text-xs font-semibold text-rose-600">{error}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
