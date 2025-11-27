import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@zenith-tv/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zenith-tv/ui/tabs';
import { Button } from '@zenith-tv/ui/button';
import {
  Settings as SettingsIcon,
  Play,
  Keyboard,
} from 'lucide-react';
import { GeneralSettings } from './GeneralSettings';
import { VideoSettings } from './VideoSettings';
import { KeyboardShortcuts } from './KeyboardShortcuts';

export function Settings() {
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
        className="max-w-3xl h-[70vh] overflow-hidden flex flex-col"
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
            <GeneralSettings />
          </TabsContent>

          <TabsContent value="video" className="flex-1 overflow-y-auto pr-2 mt-4">
            <VideoSettings />
          </TabsContent>

          <TabsContent value="shortcuts" className="flex-1 overflow-y-auto pr-2 mt-4">
            <KeyboardShortcuts />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
