import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export const AboutSection = () => {
  return (
    <section id="about" className="py-16 md:py-32 bg-background">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-hero mb-6">
          About Ojas
        </h2>
        <p className="text-muted-foreground text-lg leading-relaxed mb-8 max-w-3xl mx-auto">
          Ojas is an AI-powered health companion designed to provide personalized wellness guidance 
          and instant answers to your health questions. Built with privacy-first principles, Ojas 
          helps you make informed decisions about your health and wellness journey.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="text-center">
            <div className="text-3xl font-hero text-primary mb-2">🤖</div>
            <h3 className="font-hero text-lg mb-2">AI-Powered</h3>
            <p className="text-muted-foreground text-sm">
              Advanced AI technology for personalized health insights
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-hero text-primary mb-2">🔒</div>
            <h3 className="font-hero text-lg mb-2">Privacy First</h3>
            <p className="text-muted-foreground text-sm">
              Your health conversations remain private and secure
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-hero text-primary mb-2">⚡</div>
            <h3 className="font-hero text-lg mb-2">Always Available</h3>
            <p className="text-muted-foreground text-sm">
              24/7 access to health guidance whenever you need it
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <a href={window.location.hostname === 'localhost' ? '/signup' : 'https://app.ojasai.co.in/signup'}>
              <span>Start Your Journey</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="/contact">
              <span>Learn More</span>
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
