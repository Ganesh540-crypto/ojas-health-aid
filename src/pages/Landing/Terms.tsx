import React from 'react';
import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';

export default function LandingTerms() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      
      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 sm:px-12 lg:px-16 py-24 md:py-32">
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <h1 className="text-4xl font-hero mb-8">Terms of Service</h1>
          
          <p className="text-lg text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing and using Ojas, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ojas is an AI-powered health assistant that provides information and guidance on health and wellness topics. Our service is designed to support your health journey but is not intended to replace professional medical advice, diagnosis, or treatment.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Medical Disclaimer</h2>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
              <p className="text-amber-800 dark:text-amber-200 font-semibold mb-2">Important Medical Notice</p>
              <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed">
                Ojas provides general health information and should not be used as a substitute for professional medical advice. Always consult with a qualified healthcare provider for medical concerns, diagnosis, or treatment decisions.
              </p>
            </div>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Ojas is not a licensed medical professional</li>
              <li>• Information provided is for educational purposes only</li>
              <li>• Always seek professional medical advice for health concerns</li>
              <li>• In case of emergency, contact emergency services immediately</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">User Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              As a user of Ojas, you agree to:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Use the service responsibly and in accordance with these terms</li>
              <li>• Provide accurate information when creating your account</li>
              <li>• Keep your account credentials secure</li>
              <li>• Not use the service for any illegal or unauthorized purpose</li>
              <li>• Not attempt to gain unauthorized access to our systems</li>
              <li>• Respect the intellectual property rights of Ojas</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Privacy and Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your information. By using Ojas, you consent to the collection and use of information as outlined in our Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ojas is provided "as is" without any warranties, expressed or implied. We do not guarantee the accuracy, completeness, or usefulness of any information provided. You use the service at your own risk.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Account Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to terminate or suspend your account at any time for violation of these terms. You may also delete your account at any time through your account settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms of Service from time to time. We will notify you of any material changes by posting the new terms on this page. Your continued use of the service after such changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-hero mb-4">Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at hi@ojasai.co.in
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              By using Ojas, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </div>
        </div>
      </main>
      
      <LandingFooter />
    </div>
  );
}
