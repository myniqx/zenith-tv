import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zenith-tv/ui/select';
import { Slider } from '@zenith-tv/ui/slider';
import { Label } from '@zenith-tv/ui/label';
import { Input } from '@zenith-tv/ui/input';
import { Switch } from '@zenith-tv/ui/switch';
import { Separator } from '@zenith-tv/ui/separator';
import { MonitorPlay, Type, Timer, Volume2, Play } from 'lucide-react';
import { useVlcPlayer } from '../../hooks/useVlcPlayer';
import { useSettingsStore } from '../../stores/settings';
import { SettingsSection } from './SettingsSection';
import { SettingRow } from './SettingRow';

export function VideoSettings() {
  const vlc = useVlcPlayer();
  const {
    defaultVolume,
    autoPlayNext,
    autoResume,
    setDefaultVolume,
    setAutoPlayNext,
    setAutoResume,
  } = useSettingsStore();

  const handleRateChange = (value: string) => {
    vlc.playback({ rate: parseFloat(value) });
  };

  const handleDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const delay = parseInt(e.target.value);
    if (!isNaN(delay)) {
      vlc.subtitle({ delay: delay * 1000 }); // ms to microseconds
    }
  };

  return (
    <div className="space-y-6 p-1">
      {/* Volume */}
      <SettingsSection title="Volume" icon={<Volume2 className="w-5 h-5" />}>
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
          <p className="text-xs text-muted-foreground">
            Volume level when starting new videos
          </p>
        </div>
      </SettingsSection>

      <Separator />

      {/* Playback Control */}
      <SettingsSection title="Playback" icon={<MonitorPlay className="w-5 h-5" />}>
        <div className="space-y-2">
          <Label>Playback Speed</Label>
          <Select defaultValue="1.0" onValueChange={handleRateChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select speed" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.5">0.5x</SelectItem>
              <SelectItem value="0.75">0.75x</SelectItem>
              <SelectItem value="1.0">Normal (1.0x)</SelectItem>
              <SelectItem value="1.25">1.25x</SelectItem>
              <SelectItem value="1.5">1.5x</SelectItem>
              <SelectItem value="2.0">2.0x</SelectItem>
            </SelectContent>
          </Select>
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
      </SettingsSection>

      <Separator />

      {/* Episode Control */}
      <SettingsSection title="Episodes" icon={<Play className="w-5 h-5" />}>
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

      {/* Subtitle Timing */}
      <SettingsSection title="Subtitle Timing" icon={<Timer className="w-5 h-5" />}>
        <div className="space-y-2">
          <Label>Subtitle Delay (ms)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="0"
              defaultValue="0"
              className="w-full"
              onChange={handleDelayChange}
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Positive = Later, Negative = Earlier
            </span>
          </div>
        </div>
      </SettingsSection>

      <Separator />

      {/* Subtitle Appearance */}
      <SettingsSection title="Subtitle Appearance" icon={<Type className="w-5 h-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Size</Label>
            <Select defaultValue="normal">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="huge">Huge</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <Select defaultValue="white">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="white">White</SelectItem>
                <SelectItem value="yellow">Yellow</SelectItem>
                <SelectItem value="cyan">Cyan</SelectItem>
                <SelectItem value="green">Green</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
