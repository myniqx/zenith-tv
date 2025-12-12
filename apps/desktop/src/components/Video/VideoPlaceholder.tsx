import { useVlcPlayerStore } from "@/stores/vlcPlayer";
import React, { useEffect } from "react";


export const VideoPlaceholder = () => {
  const stickyContainerRef = React.useRef<HTMLDivElement>(null);
  const { setStickyElement, window } = useVlcPlayerStore();

  useEffect(() => {
    if (stickyContainerRef.current) {
      setStickyElement(stickyContainerRef.current);
    }

    return () => {
      setStickyElement(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClick = () => {
    window({ screenMode: 'sticky' })
  };

  return (
    <div
      ref={stickyContainerRef}
      className="h-full bg-black flex items-center justify-center"
      onClick={onClick}
    >
      Click here if you dont see the video
    </div>
  );
};
