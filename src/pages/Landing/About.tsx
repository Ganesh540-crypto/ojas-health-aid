import React from 'react';
import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';
import { Users, Target, Award, Heart, Shield, Zap } from 'lucide-react';

export default function LandingAbout() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-muted/30 to-background">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h1 className="text-4xl md:text-5xl font-hero mb-6">
              About Ojas AI
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              We're on a mission to make personalized healthcare accessible to everyone through the power of artificial intelligence. 
              Ojas represents the future of health guidance - intelligent, private, and always available.
            </p>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-hero mb-6">Our Mission</h2>
                <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                  To democratize healthcare by providing intelligent, personalized health guidance that empowers individuals 
                  to make informed decisions about their wellness journey. We believe everyone deserves access to quality 
                  health information, regardless of their location or circumstances.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Through cutting-edge AI technology and evidence-based medical knowledge, we're building a future where 
                  healthcare is proactive, personalized, and accessible to all.
                </p>
              </div>
              <div className="bg-muted/30 rounded-2xl p-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-hero text-primary mb-2">24/7</div>
                    <div className="text-sm text-muted-foreground">Always Available</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-hero text-primary mb-2">AI</div>
                    <div className="text-sm text-muted-foreground">Powered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-hero text-primary mb-2">100%</div>
                    <div className="text-sm text-muted-foreground">Private</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-hero text-primary mb-2">∞</div>
                    <div className="text-sm text-muted-foreground">Scalable</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-hero mb-4">Our Core Values</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                These principles guide everything we do at Ojas, from product development to customer support.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-background rounded-xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-hero text-lg mb-3">Privacy First</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your health data is sacred. We implement the highest standards of privacy and security to protect your personal information.
                </p>
              </div>

              <div className="bg-background rounded-xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-4">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-hero text-lg mb-3">Human-Centered</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Technology should serve humanity. We design with empathy, understanding the real needs of people seeking health guidance.
                </p>
              </div>

              <div className="bg-background rounded-xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-4">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-hero text-lg mb-3">Evidence-Based</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  All our recommendations are grounded in scientific research and established medical guidelines.
                </p>
              </div>

              <div className="bg-background rounded-xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-hero text-lg mb-3">Innovation</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We continuously push the boundaries of what's possible in AI-powered healthcare to serve you better.
                </p>
              </div>

              <div className="bg-background rounded-xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-hero text-lg mb-3">Accessibility</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Healthcare guidance should be available to everyone, everywhere, regardless of their background or circumstances.
                </p>
              </div>

              <div className="bg-background rounded-xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-4">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-hero text-lg mb-3">Precision</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We strive for accuracy in every interaction, ensuring you receive the most relevant and helpful guidance.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Company Information */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-4xl px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-hero mb-4">Our Company</h2>
              <p className="text-muted-foreground text-lg">
                Built by healthcare technology experts who understand the challenges of modern wellness.
              </p>
            </div>

            <div className="bg-muted/30 rounded-2xl p-8 md:p-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-hero text-xl mb-4">VISTORA TRAYANA LLP</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Ojas AI is proudly developed by VISTORA TRAYANA LLP, a forward-thinking technology company 
                    specializing in healthcare innovation. We are part of the larger Medtrack ecosystem, 
                    dedicated to transforming how people interact with health information.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Our team combines deep expertise in artificial intelligence, healthcare, and user experience 
                    design to create solutions that truly make a difference in people's lives.
                  </p>
                </div>
                <div>
                  <h3 className="font-hero text-xl mb-4">Recognition & Support</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We're honored to be supported by leading startup programs that recognize our potential 
                    to transform healthcare:
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• <strong>Google for Startups</strong> - AI & Healthcare Innovation</li>
                    <li>• <strong>Microsoft for Startups</strong> - Cloud & AI Solutions</li>
                    <li>• <strong>NVIDIA Inception</strong> - AI Computing Excellence</li>
                    <li>• <strong>Startup India</strong> - Government Recognition</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Technology & Approach */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="mx-auto max-w-4xl px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-hero mb-4">Our Technology</h2>
              <p className="text-muted-foreground text-lg">
                Powered by cutting-edge AI and built with privacy-first architecture.
              </p>
            </div>

            <div className="space-y-8">
              <div className="bg-background rounded-xl p-6">
                <h3 className="font-hero text-lg mb-3">Advanced Natural Language Processing</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Our AI understands context, nuance, and medical terminology to provide accurate, 
                  personalized responses to your health questions.
                </p>
              </div>

              <div className="bg-background rounded-xl p-6">
                <h3 className="font-hero text-lg mb-3">Evidence-Based Knowledge Base</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Built on a foundation of peer-reviewed medical research, clinical guidelines, 
                  and established health practices from trusted sources.
                </p>
              </div>

              <div className="bg-background rounded-xl p-6">
                <h3 className="font-hero text-lg mb-3">Privacy-Preserving Architecture</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Your conversations are processed with the highest levels of security and privacy, 
                  ensuring your health information remains confidential.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-hero mb-6">Ready to Transform Your Health Journey?</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of users who trust Ojas for personalized health guidance. 
              Experience the future of healthcare today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={window.location.hostname === 'localhost' ? '/signup' : 'https://app.ojasai.co.in/signup'}
                className="inline-flex items-center justify-center px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Get Started Today
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3 border border-border rounded-lg font-medium hover:bg-muted/50 transition-colors"
              >
                Contact Us
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
