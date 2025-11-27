import type { SettingsSectionProps } from './types';

export function SettingsSection({ title, icon, children }: SettingsSectionProps) {
  return (
    <section>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
