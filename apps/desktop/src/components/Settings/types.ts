// Re-export store types
export type { Theme, BufferSize, PlayerBackend } from '../../stores/settings';

// Component prop types
export interface SettingsSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}
