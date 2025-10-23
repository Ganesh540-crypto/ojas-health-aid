import React from 'react';
import { UserPlus, MessageCircle, Sparkles, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const steps = [
  {
    number: 'STEP ONE',
    title: 'Create Account',
    subtitle: 'Easy Setup',
    description: 'Sign up in seconds with your email or social account. Quick and hassle-free registration.',
    icon: UserPlus
  },
  {
    number: 'STEP TWO',
    title: 'Ask Your Question',
    subtitle: 'Super Fast',
    description: 'Type or speak your health question. Our AI understands and responds instantly.',
    icon: MessageCircle
  },
  {
    number: 'STEP THREE',
    title: 'Get AI Guidance',
    subtitle: 'Smart Insights',
    description: 'Receive personalized health insights based on evidence and your specific needs.',
    icon: Sparkles
  },
  {
    number: 'STEP FOUR',
    title: 'Track Progress',
    subtitle: 'Easy Process',
    description: 'Monitor your wellness journey with smart tracking and continuous support.',
    icon: TrendingUp
  }
];

export const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-12 md:py-20">
      <div className="mx-auto max-w-7xl px-6 sm:px-12 lg:px-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-hero mb-4">
            How Ojas Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start your health journey in four simple steps with our AI-powered assistant.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={index} className="relative">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-primary font-medium mb-3">
                      {step.subtitle}
                    </p>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
