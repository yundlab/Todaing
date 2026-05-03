/** 비필수: 연한 테두리. 필수: 진한 회색 기본 테두리. 포커스는 메인(indigo). */
export function fieldBorderClass(opts?: { required?: boolean }) {
  return opts?.required
    ? "border border-slate-400 outline-none transition-colors focus:border-indigo-600"
    : "border border-slate-200 outline-none transition-colors focus:border-indigo-600";
}
