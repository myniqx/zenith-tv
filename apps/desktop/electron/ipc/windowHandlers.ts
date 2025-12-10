import { BrowserWindow, screen } from 'electron';

export interface WindowPositionData {
  x: number;
  y: number;
  scaleFactor: number;
  minimized: boolean;
}

export function registerWindowHandlers(mainWindow: BrowserWindow) {
  // Helper to get current position data
  const getPositionData = (): WindowPositionData => {
    const bounds = mainWindow.getBounds();
    const contentBounds = mainWindow.getContentBounds();
    const display = screen.getDisplayMatching(bounds);

    return {
      x: contentBounds.x,
      y: contentBounds.y,
      scaleFactor: display.scaleFactor,
      minimized: mainWindow.isMinimized(),
    };
  };

  // Send position changed events
  const sendPositionChanged = () => {
    mainWindow.webContents.send('window:positionChanged', getPositionData());
  };

  mainWindow.on('move', sendPositionChanged);
  mainWindow.on('resize', sendPositionChanged);
  mainWindow.on('minimize', sendPositionChanged);
  mainWindow.on('restore', sendPositionChanged);
  mainWindow.on('restore', sendPositionChanged);
}
