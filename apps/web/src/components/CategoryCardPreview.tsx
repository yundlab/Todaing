import { cn } from "@/components/cn";
import { emojiForCategory, normalizeCategory } from "@/domain/categoryUi";
import { tintForCategory } from "@/domain/categoryTint";

/** 타임라인 카드 왼쪽과 동일 — 배경·테두리·이모지 */
export default function CategoryCardPreview({ category }: { category: string }) {
  const c = normalizeCategory(category);
  const tint = tintForCategory(c);
  return (
    <div
      className={cn(
        "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl",
        tint.border,
        tint.bg
      )}
      aria-hidden
    >
      {emojiForCategory(c)}
    </div>
  );
}
