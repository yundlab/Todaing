import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import "@/styles.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: unknown; info: React.ErrorInfo | null }
> {
  state = { error: null as unknown, info: null as React.ErrorInfo | null };

  static getDerivedStateFromError(error: unknown) {
    return { error, info: null };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    this.setState({ error, info });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message =
      this.state.error instanceof Error ? this.state.error.message : String(this.state.error);
    return (
      <div className="min-h-dvh bg-white px-4 py-10 text-slate-900">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="text-sm font-semibold">화면 렌더링 중 오류가 발생했어요.</div>
            <div className="mt-2 text-xs text-rose-800">{message}</div>
            {this.state.info?.componentStack ? (
              <pre className="mt-3 whitespace-pre-wrap text-[11px] leading-4 text-rose-900/80">
                {this.state.info.componentStack.trim()}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);

