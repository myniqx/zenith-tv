import { useEffect, useRef } from 'react';

interface VlcCanvasProps {
  getFrame: () => Promise<Buffer | null>;
  videoFormat: { width: number; height: number; pitch: number } | null;
  className?: string;
}

/**
 * Canvas component that renders VLC frames using vmem
 */
export function VlcCanvas({ getFrame, videoFormat, className }: VlcCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoFormat) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = videoFormat.width;
    canvas.height = videoFormat.height;

    console.log('[VLC Canvas] Starting render loop:', videoFormat);

    // Render loop
    const render = async () => {
      const frameBuffer = await getFrame();

      if (frameBuffer && frameBuffer.length > 0) {
        try {
          // Create ImageData from the buffer
          const imageData = ctx.createImageData(videoFormat.width, videoFormat.height);

          // Copy buffer data to ImageData
          // VLC gives us RGBA data, which is what ImageData expects
          const uint8Array = new Uint8Array(frameBuffer);
          imageData.data.set(uint8Array);

          // Draw to canvas
          ctx.putImageData(imageData, 0, 0);
        } catch (err) {
          console.error('[VLC Canvas] Render error:', err);
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    // Start render loop
    animationFrameRef.current = requestAnimationFrame(render);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [getFrame, videoFormat]);

  if (!videoFormat) {
    return (
      <div className={className} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#fff'
      }}>
        Waiting for video...
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        background: '#000'
      }}
    />
  );
}
