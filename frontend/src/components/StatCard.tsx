export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'default' | 'warning' | 'success' | 'danger';
}) {
  const accents = {
    default: 'text-slate-900',
    warning: 'text-amber-700',
    success: 'text-emerald-700',
    danger: 'text-red-700',
  } as const;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${accents[accent ?? 'default']}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
