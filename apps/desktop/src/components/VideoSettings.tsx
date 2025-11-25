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
import { Separator } from '@zenith-tv/ui/separator';
import { MonitorPlay, Type, Timer, Palette } from 'lucide-react';

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

export function VideoSettings() {
  return (
    <div className="space-y-6 p-1">
      {/* Playback Control */}
      <SettingsSection title="Playback" icon={<MonitorPlay className="w-5 h-5" />}>
        <div className="space-y-2">
          <Label>Playback Speed</Label>
          <Select defaultValue="1.0">
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
      </SettingsSection>

      <Separator />

      {/* Subtitle Timing */}
      <SettingsSection title="Subtitle Timing" icon={<Timer className="w-5 h-5" />}>
        <div className="space-y-2">
          <Label>Subtitle Delay (ms)</Label>
          <div className="flex items-center gap-2">
            <Input type="number" placeholder="0" defaultValue="0" className="w-full" />
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

        <div className="space-y-3 pt-2">
          <Label>Background Opacity</Label>
          <Slider
            defaultValue={[0]}
            max={100}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            0% = Transparent, 100% = Solid Black
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}
