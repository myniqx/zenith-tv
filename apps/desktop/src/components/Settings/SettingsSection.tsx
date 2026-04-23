import type { SettingsSectionProps } from './types';

export function SettingsSection({ title, icon, children }: SettingsSectionProps) {
  return (
    <section className="mb-8">
      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
        {icon && <span className="opacity-60">{icon}</span>}
        {title}
      </h3>
      <div className="bg-secondary rounded-xl overflow-hidden px-6 py-2 divide-y divide-border/20">
        {children}
      </div>
    </section>
  );
}
