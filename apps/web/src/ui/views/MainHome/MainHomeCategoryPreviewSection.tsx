import { cn } from "@/components/cn";
import { CATEGORY_GROUPS, emojiForCategory } from "@/domain/categoryUi";
import { tintForCategory } from "@/domain/categoryTint";

export default function MainHomeCategoryPreviewSection() {
  return (
    <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">카테고리 이모티콘 미리보기</h2>
        <div className="text-xs text-slate-500">?previewCategories=1</div>
      </div>
      <div className="mt-3 space-y-4">
        {CATEGORY_GROUPS.map((g) => (
          <div key={g.label}>
            <div className="text-xs font-semibold text-slate-500">{g.label}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {g.items.map((c) => {
                const tint = tintForCategory(c);
                return (
                  <div
                    key={c}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 shadow-sm",
                      tint.bg,
                      tint.border
                    )}
                  >
                    <div className={cn("text-sm font-semibold", tint.text)}>
                      <span className="mr-2">{emojiForCategory(c)}</span>
                      {c}
                    </div>
                    <div className="text-xs text-slate-500">{emojiForCategory(c)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
