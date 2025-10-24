import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
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
    <>
      <Helmet>
        <title>Ojas – AI Health Assistant</title>
        <meta name="description" content="Ojas is your professional AI healthcare assistant. Get clear, evidence-based guidance for health and wellness with privacy-first design." />
        <link rel="canonical" href="https://ojasai.co.in/" />
        <meta property="og:title" content="Ojas – AI Health Assistant" />
        <meta property="og:description" content="Professional healthcare guidance with privacy-first AI. Evidence-based answers, available 24/7." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ojasai.co.in/" />
        <meta property="og:image" content="https://ojasai.co.in/favicon.ico" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Ojas AI",
          "url": "https://ojasai.co.in/",
          "logo": "https://ojasai.co.in/favicon.ico"
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Ojas – AI Health Assistant",
          "url": "https://ojasai.co.in/"
        })}</script>
      </Helmet>
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
    </>
  );
}
