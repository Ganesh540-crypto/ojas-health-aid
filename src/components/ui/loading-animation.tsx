import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export type Frames = number[][][];

interface MotionGridProps {
  gridSize: [number, number];
  frames: Frames;
  className?: string;
  children: React.ReactNode;
  frameIndex: number;
}

function MotionGrid({ gridSize, frames, className, children, frameIndex }: MotionGridProps) {
  const [cols, rows] = gridSize;
  const currentFrame = frames[frameIndex] || [];
  
  return (
    <div className={cn("grid gap-0.5", className)} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: cols * rows }).map((_, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const isActive = currentFrame.some(([c, r]) => c === col && r === row);
        
        return (
          <motion.div
            key={`${col}-${row}`}
            animate={{
              scale: isActive ? 1 : 0.3,
              opacity: isActive ? 1 : 0.2,
            }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="size-[3px] rounded-full bg-orange-500"
          />
        );
      })}
    </div>
  );
}

const thinkingFrames = [
  [[2, 2]],
  [
    [1, 2],
    [2, 1],
    [2, 3],
    [3, 2],
  ],
  [
    [2, 2],
    [0, 2],
    [1, 1],
    [1, 3],
    [2, 0],
    [2, 4],
    [3, 1],
    [3, 3],
    [4, 2],
  ],
  [
    [0, 1],
    [0, 3],
    [1, 0],
    [1, 2],
    [1, 4],
    [2, 1],
    [2, 3],
    [3, 0],
    [3, 2],
    [3, 4],
    [4, 1],
    [4, 3],
  ],
  [
    [0, 0],
    [0, 2],
    [0, 4],
    [1, 1],
    [1, 3],
    [2, 0],
    [2, 2],
    [2, 4],
    [3, 1],
    [3, 3],
    [4, 0],
    [4, 2],
    [4, 4],
  ],
] as Frames;

const searchingFrames = [
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [1, 1],
    [2, 1],
    [3, 1],
    [2, 2],
  ],
  [
    [3, 0],
    [2, 1],
    [3, 1],
    [4, 1],
    [3, 2],
  ],
  [
    [3, 1],
    [2, 2],
    [3, 2],
    [4, 2],
    [3, 3],
  ],
  [
    [3, 2],
    [2, 3],
    [3, 3],
    [4, 3],
    [3, 4],
  ],
  [
    [1, 2],
    [0, 3],
    [1, 3],
    [2, 3],
    [1, 4],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
] as Frames;

const analyzingFrames = [
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [4, 1],
    [4, 2],
    [4, 3],
  ],
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [2, 3],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [3, 4],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [2, 3],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [2, 1],
    [4, 1],
    [4, 2],
    [4, 3],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [3, 0],
    [4, 0],
    [4, 1],
    [4, 2],
  ],
] as Frames;

interface LoadingAnimationProps {
  mode?: 'routing' | 'thinking' | 'searching' | 'analyzing';
  label?: string;
  className?: string;
}

export function LoadingAnimation({ mode = 'thinking', label, className }: LoadingAnimationProps) {
  const [frameIndex, setFrameIndex] = React.useState(0);
  const gridSize: [number, number] = [3, 3]; // Define gridSize
  
  const frames = React.useMemo(() => {
    switch (mode) {
      case 'routing':
        return thinkingFrames;
      case 'searching':
        return searchingFrames;
      case 'analyzing':
        return analyzingFrames;
      default:
        return thinkingFrames;
    }
  }, [mode]);
  
  const displayLabel = label || (
    mode === 'routing' ? 'Routing' :
    mode === 'searching' ? 'Searching web' :
    mode === 'analyzing' ? 'Analyzing' :
    'Thinking'
  );
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 200);
    
    return () => clearInterval(interval);
  }, [frames.length]);
  
  return (
    <div className={cn("inline-flex items-start gap-2", className)}>
      <MotionGrid 
        gridSize={gridSize}
        frames={frames}
        className="h-5 w-5"
        frameIndex={frameIndex}
      >
        <div className="h-1 w-1 bg-current rounded-full" />
      </MotionGrid>
      {displayLabel && (
        <span className="text-sm text-muted-foreground">{displayLabel}</span>
      )}
    </div>
  );
}
