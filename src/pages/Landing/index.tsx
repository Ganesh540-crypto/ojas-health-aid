import React, { useEffect } from 'react';
import { LandingHeader } from './components/LandingHeader';
import { HeroSection } from './components/HeroSection';
import { FeaturesSection } from './components/FeaturesSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { IntegrationsSection } from './components/IntegrationsSection';
import { LogoCloud } from './components/LogoCloud';
import { LandingFooter } from './components/LandingFooter';

export default function LandingPage() {
  useEffect(() => {
    // Handle hash scrolling after page load
    if (window.location.hash) {
      setTimeout(() => {
        const element = document.querySelector(window.location.hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="overflow-hidden">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <IntegrationsSection />
        <LogoCloud />
      </main>
      <LandingFooter />
    </div>
  );
}
