import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Users, Zap, Heart, MessageCircle, Lock } from 'lucide-react';

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-12 md:py-20">
      <div className="mx-auto max-w-7xl px-6 sm:px-12 lg:px-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-hero mb-4">
            Why Choose Ojas?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Experience the future of AI-powered health assistance with privacy-first design and personalized care.
          </p>
        </div>

        <div className="relative">
          <div className="relative z-10 grid grid-cols-6 gap-3">
            {/* Privacy First - Large Card */}
            <Card className="relative col-span-full flex overflow-hidden lg:col-span-2">
              <CardContent className="relative m-auto size-fit pt-6">
                <div className="relative flex h-24 w-56 items-center justify-center">
                  <div className="text-center">
                    <Lock className="mx-auto h-12 w-12 text-primary mb-4" />
                    <span className="text-4xl font-hero text-primary">100%</span>
                  </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-hero">Privacy First</h2>
                <p className="text-center text-muted-foreground mt-2">
                  Your health conversations stay private and secure. Built with privacy by design.
                </p>
              </CardContent>
            </Card>

            {/* Health Aware */}
            <Card className="relative col-span-full overflow-hidden sm:col-span-3 lg:col-span-2">
              <CardContent className="pt-6">
                <div className="relative mx-auto flex aspect-square size-32 rounded-full border items-center justify-center before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5">
                  <Heart className="h-12 w-12 text-primary" strokeWidth={1} />
                </div>
                <div className="relative z-10 mt-6 space-y-2 text-center">
                  <h2 className="text-lg font-hero">Health-Aware Guidance</h2>
                  <p className="text-muted-foreground">
                    Personalized health insights based on evidence-based medicine and your individual needs.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Fast & Responsive */}
            <Card className="relative col-span-full overflow-hidden sm:col-span-3 lg:col-span-2">
              <CardContent className="pt-6">
                <div className="pt-6 lg:px-6">
                  <div className="relative mx-auto flex aspect-square size-32 rounded-full border items-center justify-center before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5">
                    <Zap className="h-12 w-12 text-primary" strokeWidth={1} />
                  </div>
                </div>
                <div className="relative z-10 mt-6 space-y-2 text-center">
                  <h2 className="text-lg font-hero">Lightning Fast</h2>
                  <p className="text-muted-foreground">
                    Get instant responses to your health questions with our optimized AI engine.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Conversational AI */}
            <Card className="relative col-span-full overflow-hidden lg:col-span-3">
              <CardContent className="grid pt-6 sm:grid-cols-2">
                <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6">
                  <div className="relative flex aspect-square size-12 rounded-full border items-center justify-center before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5">
                    <MessageCircle className="size-6" strokeWidth={1} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-hero">Natural Conversations</h2>
                    <p className="text-muted-foreground">
                      Chat naturally about your health concerns. Ojas understands context and provides thoughtful responses.
                    </p>
                  </div>
                </div>
                <div className="rounded-tl-[--radius] relative -mb-6 -mr-6 mt-6 h-fit border-l border-t p-6 py-6 sm:ml-6">
                  <div className="absolute left-3 top-2 flex gap-1">
                    <span className="block size-2 rounded-full border dark:border-white/10 dark:bg-white/10"></span>
                    <span className="block size-2 rounded-full border dark:border-white/10 dark:bg-white/10"></span>
                    <span className="block size-2 rounded-full border dark:border-white/10 dark:bg-white/10"></span>
                  </div>
                  <div className="mt-6 space-y-3">
                    <div className="bg-muted/50 rounded-lg p-2 text-xs">
                      "I've been feeling tired lately..."
                    </div>
                    <div className="bg-primary/10 rounded-lg p-2 text-xs">
                      "Let's explore some potential causes. How's your sleep schedule?"
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-xs">
                      "I go to bed around midnight"
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trusted & Secure */}
            <Card className="relative col-span-full overflow-hidden lg:col-span-3">
              <CardContent className="grid h-full pt-6 sm:grid-cols-2">
                <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6">
                  <div className="relative flex aspect-square size-12 rounded-full border items-center justify-center before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5">
                    <Shield className="size-6" strokeWidth={1} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-hero">Secure & Reliable</h2>
                    <p className="text-muted-foreground">
                      Built with modern security practices. Your conversations are protected and private.
                    </p>
                  </div>
                </div>
                <div className="before:bg-[--color-border] relative mt-6 before:absolute before:inset-0 before:mx-auto before:w-px sm:-my-6 sm:-mr-6">
                  <div className="relative flex h-full flex-col justify-center space-y-6 py-6">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-500" />
                      <span className="text-xs">Secure conversations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-green-500" />
                      <span className="text-xs">Privacy focused</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-500" />
                      <span className="text-xs">Personal AI assistant</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
