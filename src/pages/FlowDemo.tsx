import React from 'react';
import FlowingColorsShader from '@/components/visuals/FlowingColorsShader';

export default function FlowDemo() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <FlowingColorsShader
        className="absolute inset-0"
        speed={1.0}
        contrast={1.12}
        brightness={1.06}
        levels={9}
        warp={1.6}
      />
    </div>
  );
}
