import React from 'react';
import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';

export default function LandingPrivacy() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      
      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 sm:px-12 lg:px-16 py-24 md:py-32">
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <h1 className="text-4xl font-hero mb-8">Privacy Policy</h1>
          
          <p className="text-lg text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              At Ojas, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your information when you use our AI health assistant service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Account Information</h3>
                <p className="text-muted-foreground">
                  When you create an account, we collect your email address and any profile information you choose to provide.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Conversation Data</h3>
                <p className="text-muted-foreground">
                  We store your conversations with Ojas to provide personalized responses and improve our service. This may include health-related questions and information you share.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Usage Information</h3>
                <p className="text-muted-foreground">
                  We collect information about how you use our service, including features accessed and interaction patterns.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">How We Use Your Information</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Provide and improve our AI health assistant service</li>
              <li>• Personalize your experience and responses</li>
              <li>• Ensure the security and integrity of our platform</li>
              <li>• Communicate with you about service updates</li>
              <li>• Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy or as required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Access your personal information</li>
              <li>• Correct inaccurate information</li>
              <li>• Delete your account and associated data</li>
              <li>• Export your conversation history</li>
              <li>• Opt out of certain communications</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at hi@ojasai.co.in
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              This Privacy Policy may be updated from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page.
            </p>
          </div>
        </div>
      </main>
      
      <LandingFooter />
    </div>
  );
}
