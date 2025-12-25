import { useSettingsStore } from '../../stores/settings';
import { useToastStore } from '@zenith-tv/content';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zenith-tv/ui/select';
import { Button } from '@zenith-tv/ui/button';
import { Label } from '@zenith-tv/ui/label';
import { Switch } from '@zenith-tv/ui/switch';
import { Separator } from '@zenith-tv/ui/separator';
import { Palette, Power } from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import { SettingRow } from './SettingRow';
import type { Theme } from './types';

export function GeneralSettings() {
  const {
    theme,
    autoLoadLastProfile,
    rememberLayout,
    setTheme,
    setAutoLoadLastProfile,
    setRememberLayout,
    resetSettings,
  } = useSettingsStore();

  const toast = useToastStore();

  const handleReset = () => {
    if (confirm('Reset all settings to default values?')) {
      resetSettings();
      toast.success('Settings reset to defaults');
    }
  };

  return (
    <div className="space-y-8">
      {/* Appearance */}
      <SettingsSection
        title="Appearance"
        icon={<Palette className="w-5 h-5" />}
      >
        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
            <SelectTrigger id="theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            System follows your OS preference
          </p>
        </div>
      </SettingsSection>

      <Separator />

      {/* Startup */}
      <SettingsSection
        title="Startup"
        icon={<Power className="w-5 h-5" />}
      >
        <SettingRow
          label="Auto Load Last Profile"
          description="Automatically load your last used profile on startup"
        >
          <Switch
            checked={autoLoadLastProfile}
            onCheckedChange={setAutoLoadLastProfile}
          />
        </SettingRow>

        <SettingRow
          label="Remember Layout"
          description="Restore last category, sort, and grouping settings"
        >
          <Switch
            checked={rememberLayout}
            onCheckedChange={setRememberLayout}
          />
        </SettingRow>
      </SettingsSection>

      <Separator className="my-4" />

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
