import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronRight, CirclePlay } from 'lucide-react';

export const HeroSection = () => {
  return (
    <section className="bg-gradient-to-b to-muted from-background">
      <div className="relative py-24 md:py-32">
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 sm:px-12 lg:px-16">
          <div className="md:w-1/2">
            <div>
              <h1 className="max-w-md text-balance text-4xl font-hero md:text-5xl">
                Meet Ojas, Your AI Health Companion
              </h1>
              <p className="text-muted-foreground my-8 max-w-2xl text-balance text-xl">
                Get personalized health guidance, wellness tips, and instant answers to your health questions. Private, secure, and always available.
              </p>

              <div className="flex items-center gap-3">
                <Button asChild size="lg" className="pr-4.5">
                  <a href={window.location.hostname === 'localhost' ? '/signup' : 'https://app.ojasai.co.in/signup'}>
                    <span className="text-nowrap">Get Started</span>
                    <ChevronRight className="opacity-50" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="pl-5"
                  onClick={() => {
                    const element = document.querySelector('#features');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <CirclePlay className="fill-primary/25 stroke-primary" />
                  <span className="text-nowrap">Learn More</span>
                </Button>
              </div>
            </div>

            <div className="mt-10">
              <p className="text-muted-foreground">Built for your wellness journey:</p>
              <div className="mt-6 grid max-w-sm grid-cols-3 gap-6">
                <div className="flex items-center">
                  <div className="text-2xl font-hero text-primary">AI</div>
                  <div className="ml-2 text-sm text-muted-foreground">Powered</div>
                </div>
                <div className="flex items-center">
                  <div className="text-2xl font-hero text-primary">24/7</div>
                  <div className="ml-2 text-sm text-muted-foreground">Available</div>
                </div>
                <div className="flex items-center">
                  <div className="text-2xl font-hero text-primary">100%</div>
                  <div className="ml-2 text-sm text-muted-foreground">Private</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="perspective-near mt-24 translate-x-12 md:absolute md:-right-6 md:bottom-16 md:left-1/2 md:top-40 md:mt-0 md:translate-x-0">
          <div className="before:border-foreground/5 before:bg-foreground/5 relative h-full before:absolute before:-inset-x-4 before:bottom-7 before:top-0 before:skew-x-6 before:rounded-[calc(var(--radius)+1rem)] before:border">
            <div className="bg-background rounded-[--radius] shadow-foreground/10 ring-foreground/5 relative h-full -translate-y-12 skew-x-6 overflow-hidden border border-transparent shadow-md ring-1">
              <img
                src="/ScreenshotRef.png"
                alt="Ojas AI Interface"
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
