import { cn } from "@/components/cn";

function MarkSvg({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M18 18h28a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V24a6 6 0 0 1 6-6z"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M22 14v8M42 14v8" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <path d="M20 30h24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
      <path
        d="M26 42l5 5 10-12"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 로그인 화면과 동일한 투데잉 마크 */
export default function TodaingLogoMark({
  size = "sm",
  className
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  if (size === "lg") {
    return (
      <div
        className={cn(
          "flex h-24 w-24 items-center justify-center rounded-[26px] bg-indigo-600 shadow-sm",
          className
        )}
      >
        <MarkSvg className="h-14 w-14" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 shadow-sm",
        className
      )}
    >
      <MarkSvg className="h-6 w-6" />
    </div>
  );
}
