import { useSettingsStore, type Theme, type BufferSize, type PlayerBackend } from '../stores/settings';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zenith-tv/ui/tabs';
import { Button } from '@zenith-tv/ui/button';
import { Label } from '@zenith-tv/ui/label';
import { Switch } from '@zenith-tv/ui/switch';
import { Slider } from '@zenith-tv/ui/slider';
import { Separator } from '@zenith-tv/ui/separator';
import {
  Palette,
  Play,
  Power,
  Settings as SettingsIcon,
  Keyboard,
} from 'lucide-react';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { VideoSettings } from './VideoSettings';

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
    playerBackend,
    defaultVolume,
    autoResume,
    autoPlayNext,
    bufferSize,
    autoLoadLastProfile,
    rememberLayout,
    setTheme,
    setPlayerBackend,
    setDefaultVolume,
    setAutoResume,
    setAutoPlayNext,
    setBufferSize,
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

        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Video
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="flex items-center gap-2">
              <Keyboard className="w-4 h-4" />
              Shortcuts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="flex-1 overflow-y-auto pr-2 mt-4">
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

              <Separator />

              {/* Player */}
              <SettingsSection title="Player" icon={<Play className="w-5 h-5" />}>
                <div className="space-y-2">
                  <Label htmlFor="playerBackend">Player Backend</Label>
                  <Select
                    value={playerBackend}
                    onValueChange={(value) => setPlayerBackend(value as PlayerBackend)}
                  >
                    <SelectTrigger id="playerBackend">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (VLC preferred)</SelectItem>
                      <SelectItem value="vlc">VLC (Native)</SelectItem>
                      <SelectItem value="html5">HTML5 (Browser)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    VLC provides better codec support for IPTV streams
                  </p>
                </div>

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

                <div className="space-y-2">
                  <Label htmlFor="bufferSize">Buffer Size</Label>
                  <Select
                    value={bufferSize.toString()}
                    onValueChange={(value) => setBufferSize(parseInt(value) as BufferSize)}
                  >
                    <SelectTrigger id="bufferSize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 seconds</SelectItem>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="15">15 seconds</SelectItem>
                      <SelectItem value="30">30 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Higher values improve stability on slow connections
                  </p>
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
            </div>
          </TabsContent>

          <TabsContent value="video" className="flex-1 overflow-y-auto pr-2 mt-4">
            <VideoSettings />
          </TabsContent>

          <TabsContent value="shortcuts" className="flex-1 overflow-y-auto pr-2 mt-4">
            <KeyboardShortcuts />
          </TabsContent>
        </Tabs>

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
