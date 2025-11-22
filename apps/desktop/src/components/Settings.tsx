import { useSettingsStore } from '../stores/settings';
import { useToastStore } from '../stores/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@zenith-tv/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zenith-tv/ui/select';
import { Button } from '@zenith-tv/ui/button';
import { Input } from '@zenith-tv/ui/input';
import { Label } from '@zenith-tv/ui/label';
import { Switch } from '@zenith-tv/ui/switch';
import { Slider } from '@zenith-tv/ui/slider';
import { Separator } from '@zenith-tv/ui/separator';
import { Palette, FileText, Play, Wifi, Settings as SettingsIcon } from 'lucide-react';

interface SettingsSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function SettingsSection({ title, icon, children }: SettingsSectionProps) {
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

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function Settings() {
  const {
    theme,
    highContrastMode,
    language,
    defaultCategory,
    autoSyncInterval,
    defaultVolume,
    autoResume,
    autoPlayNext,
    deviceName,
    serverPort,
    setTheme,
    setHighContrastMode,
    setLanguage,
    setDefaultCategory,
    setAutoSyncInterval,
    setDefaultVolume,
    setAutoResume,
    setAutoPlayNext,
    setDeviceName,
    setServerPort,
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
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Settings"
          aria-label="Open settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        aria-describedby=""
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Settings</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-8">
            {/* Appearance */}
            <SettingsSection
              title="Appearance"
              icon={<Palette className="w-5 h-5" />}
            >
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light" disabled>
                      Light (Coming Soon)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="tr" disabled>
                      Türkçe (Coming Soon)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <SettingRow
                label="High Contrast Mode"
                description="Increase contrast for better visibility"
              >
                <Switch
                  checked={highContrastMode}
                  onCheckedChange={setHighContrastMode}
                  aria-label={`High contrast mode ${highContrastMode ? 'enabled' : 'disabled'}`}
                />
              </SettingRow>
            </SettingsSection>

            <Separator />

            {/* Content */}
            <SettingsSection
              title="Content"
              icon={<FileText className="w-5 h-5" />}
            >
              <div className="space-y-2">
                <Label htmlFor="defaultCategory">Default Category</Label>
                <Select
                  value={defaultCategory}
                  onValueChange={setDefaultCategory}
                >
                  <SelectTrigger id="defaultCategory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="movies">Movies</SelectItem>
                    <SelectItem value="series">Series</SelectItem>
                    <SelectItem value="live">Live TV</SelectItem>
                    <SelectItem value="favorites">Favorites</SelectItem>
                    <SelectItem value="recent">Recent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="autoSyncInterval">Auto-Sync Interval</Label>
                <Select
                  value={autoSyncInterval.toString()}
                  onValueChange={(value) => setAutoSyncInterval(parseInt(value))}
                >
                  <SelectTrigger id="autoSyncInterval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Disabled</SelectItem>
                    <SelectItem value="30">Every 30 minutes</SelectItem>
                    <SelectItem value="60">Every hour</SelectItem>
                    <SelectItem value="360">Every 6 hours</SelectItem>
                    <SelectItem value="1440">Daily</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Automatically sync M3U playlists in the background
                </p>
              </div>
            </SettingsSection>

            <Separator />

            {/* Player */}
            <SettingsSection title="Player" icon={<Play className="w-5 h-5" />}>
              <div className="space-y-3">
                <Label>Default Volume: {Math.round(defaultVolume * 100)}%</Label>
                <Slider
                  value={[defaultVolume * 100]}
                  onValueChange={([value]) => setDefaultVolume(value / 100)}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <SettingRow
                label="Auto-Resume Playback"
                description="Continue from where you left off"
              >
                <Switch
                  checked={autoResume}
                  onCheckedChange={setAutoResume}
                />
              </SettingRow>

              <SettingRow
                label="Auto-Play Next Episode"
                description="Automatically play next episode when current ends"
              >
                <Switch
                  checked={autoPlayNext}
                  onCheckedChange={setAutoPlayNext}
                />
              </SettingRow>
            </SettingsSection>

            <Separator />

            {/* Network */}
            <SettingsSection
              title="Network (P2P Remote Control)"
              icon={<Wifi className="w-5 h-5" />}
            >
              <div className="space-y-4 opacity-50">
                <div className="space-y-2">
                  <Label htmlFor="deviceName">Device Name</Label>
                  <Input
                    id="deviceName"
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serverPort">Server Port</Label>
                  <Input
                    id="serverPort"
                    type="number"
                    value={serverPort}
                    onChange={(e) => setServerPort(parseInt(e.target.value))}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Coming in Phase 3 - P2P Remote Control
                  </p>
                </div>
              </div>
            </SettingsSection>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
