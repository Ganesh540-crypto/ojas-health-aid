import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

// Types
export type Frame = Array<[number, number]>; // [row, col]
export type Frames = Frame[];

// A compact set of frames inspired by a scanning/searching pattern
const searchingFrames: Frames = [
  [ [1,0],[0,1],[1,1],[2,1],[1,2] ],
  [ [2,0],[1,1],[2,1],[3,1],[2,2] ],
  [ [3,0],[2,1],[3,1],[4,1],[3,2] ],
  [ [3,1],[2,2],[3,2],[4,2],[3,3] ],
  [ [3,2],[2,3],[3,3],[4,3],[3,4] ],
  [ [1,2],[0,3],[1,3],[2,3],[1,4] ],
  [ [0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2] ],
  [],
];

const thinkingFrames: Frames = [
  [ [2,2] ],
  [ [1,2],[2,1],[2,3],[3,2] ],
  [ [2,2],[0,2],[1,1],[1,3],[2,0],[2,4],[3,1],[3,3],[4,2] ],
  [ [0,1],[0,3],[1,0],[1,2],[1,4],[2,1],[2,3],[3,0],[3,2],[3,4],[4,1],[4,3] ],
  [ [0,0],[0,2],[0,4],[1,1],[1,3],[2,0],[2,2],[2,4],[3,1],[3,3],[4,0],[4,2],[4,4] ],
  [ [0,1],[0,3],[1,0],[1,2],[1,4],[2,1],[2,3],[3,0],[3,2],[3,4],[4,1],[4,3] ],
  [ [0,0],[0,2],[0,4],[1,1],[1,3],[2,0],[2,4],[3,1],[3,3],[4,0],[4,2],[4,4] ],
  [ [0,1],[1,0],[3,0],[4,1],[0,3],[1,4],[3,4],[4,3] ],
  [ [0,0],[0,4],[4,0],[4,4] ],
  [],
];

const states = {
  thinking: { frames: thinkingFrames, label: 'Thinking' },
  searching: { frames: searchingFrames, label: 'Searching' },
};

export type ThinkingMode = keyof typeof states;

interface ThinkingLoaderProps {
  mode?: ThinkingMode; // 'thinking' | 'searching'
  className?: string;
  labelOverride?: string; // optional custom label
  speedMs?: number; // ms between frames
  gridSize?: [number, number]; // default 5x5
  cellSizeClass?: string; // e.g. 'size-[6px]'
}

export const ThinkingLoader: React.FC<ThinkingLoaderProps> = ({
  mode = 'thinking',
  className,
  labelOverride,
  speedMs = 260,
  gridSize = [5,5],
  cellSizeClass = 'size-[6px]',
}) => {
  const { frames, label } = states[mode];
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frames.length);
    }, speedMs);
    return () => clearInterval(id);
  }, [frames.length, speedMs]);

  const activeSet = useMemo(() => {
    const f = frames[frameIndex] || [];
    // Build a quick lookup set like 'r-c'
    const s = new Set<string>();
    for (const [r,c] of f) s.add(`${r}-${c}`);
    return s;
  }, [frames, frameIndex]);

  const [rows, cols] = gridSize;
  const cells: JSX.Element[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}-${c}`;
      const active = activeSet.has(key);
      cells.push(
        <div
          key={key}
          className={cn(
            'rounded-sm transition-colors duration-200',
            cellSizeClass,
            active
              ? 'bg-primary/90 shadow-glow'
              : 'bg-muted/30'
          )}
        />
      );
    }
  }

  return (
    <div className={cn('flex items-center gap-3 py-1 px-1', className)}>
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: '3px' }}
        aria-hidden
      >
        {cells}
      </div>
      <div className="text-sm text-muted-foreground select-none" aria-live="polite">
        {labelOverride ?? label}
        <span className="ml-1 animate-pulse">…</span>
      </div>
    </div>
  );
};

export default ThinkingLoader;
