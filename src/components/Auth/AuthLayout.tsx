import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

type Side = 'left' | 'right';

export default function AuthLayout({
  form,
  info,
  initialSide = 'left',
}: {
  form: ReactNode;
  info: ReactNode;
  initialSide?: Side;
}) {
  const [formSide, setFormSide] = useState<Side>(initialSide);
  const flip = () => setFormSide((s) => (s === 'left' ? 'right' : 'left'));

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-background">
      {/* Form Panel */}
      <div className={cn("flex items-center justify-center p-6 md:p-10", formSide === 'left' ? 'order-1' : 'order-2')}> 
        <div className="w-full max-w-md">
          {form}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Prefer the other view?{' '}
            <button onClick={flip} className="text-primary hover:text-[hsl(var(--primary-hover))] underline underline-offset-4">Swap sides</button>
          </p>
        </div>
      </div>

      {/* Info Panel */}
      <div className={cn("hidden md:flex relative items-center justify-center p-10 bg-sidebar text-sidebar-foreground", formSide === 'left' ? 'order-2' : 'order-1')}> 
        <div className="max-w-lg">
          {info}
        </div>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-transparent to-black/5" />
      </div>
    </div>
  );
}
