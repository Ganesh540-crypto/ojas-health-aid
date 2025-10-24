import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';

const faqs = [
  {
    question: "What is Ojas AI?",
    answer: "Ojas is an AI-powered health assistant designed to provide personalized health guidance, wellness tips, and instant answers to your health questions. It's built with privacy-first principles to ensure your conversations remain secure."
  },
  {
    question: "Is Ojas a replacement for medical professionals?",
    answer: "No, Ojas is not a replacement for professional medical advice, diagnosis, or treatment. It's designed to provide general health information and support your wellness journey. Always consult with qualified healthcare providers for medical concerns."
  },
  {
    question: "How does Ojas protect my privacy?",
    answer: "Ojas is built with privacy by design. Your health conversations are kept private and secure. We don't share your personal information with third parties, and we implement modern security practices to protect your data."
  },
  {
    question: "What kind of health topics can I discuss with Ojas?",
    answer: "You can discuss general wellness topics, nutrition questions, fitness guidance, sleep tips, stress management, and other health-related concerns. Ojas provides evidence-based information to support your health decisions."
  },
  {
    question: "Is Ojas available 24/7?",
    answer: "Yes, Ojas is available 24/7 to answer your health questions and provide guidance whenever you need it. Our AI assistant is always ready to help with your wellness journey."
  },
  {
    question: "How accurate is the health information provided by Ojas?",
    answer: "Ojas provides information based on current health guidelines and evidence-based practices. However, it's important to remember that this is general information and should not replace professional medical advice for specific health conditions."
  },
  {
    question: "Can I use Ojas for emergency situations?",
    answer: "No, Ojas should not be used for medical emergencies. In case of emergency, please contact emergency services immediately or visit your nearest emergency room."
  },
  {
    question: "How do I get started with Ojas?",
    answer: "Getting started is simple! Just sign up for an account, complete a brief onboarding process, and you can start chatting with Ojas about your health questions and wellness goals."
  },
  {
    question: "What startup programs support Ojas?",
    answer: "Ojas is proud to be supported by leading startup programs including Google for Startups, Microsoft for Startups, NVIDIA Inception, and Startup India. These partnerships help us accelerate innovation in healthcare AI."
  },
  {
    question: "Who is behind Ojas?",
    answer: "Ojas is developed by VISTORA TRAYANA LLP as part of the Medtrack ecosystem. We're committed to creating innovative healthcare solutions that prioritize user privacy and provide valuable health insights."
  }
];

export default function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <>
      <Helmet>
        <title>Ojas – Frequently Asked Questions</title>
        <meta name="description" content="Find answers about Ojas AI: what it is, accuracy, privacy, availability, and how to get started." />
        <link rel="canonical" href="https://ojasai.co.in/faq" />
        <meta property="og:title" content="Ojas – Frequently Asked Questions" />
        <meta property="og:description" content="Answers to common questions about Ojas AI and its health guidance." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ojasai.co.in/faq" />
        <meta property="og:image" content="https://ojasai.co.in/favicon.ico" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What is Ojas AI?",
              "acceptedAnswer": { "@type": "Answer", "text": "Ojas is an AI-powered health assistant designed to provide personalized health guidance, wellness tips, and instant answers to your health questions." }
            },
            {
              "@type": "Question",
              "name": "Is Ojas a replacement for medical professionals?",
              "acceptedAnswer": { "@type": "Answer", "text": "No. Ojas is not a replacement for professional medical advice, diagnosis, or treatment. Always consult qualified healthcare providers for medical concerns." }
            },
            {
              "@type": "Question",
              "name": "How does Ojas protect my privacy?",
              "acceptedAnswer": { "@type": "Answer", "text": "Ojas is built with privacy by design. We keep your conversations private and secure, and implement modern security practices to protect your data." }
            }
          ]
        })}</script>
      </Helmet>
    <div className="min-h-screen bg-background">
      <LandingHeader />
      
      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 sm:px-12 lg:px-16 py-24 md:py-32">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-hero mb-4">Frequently Asked Questions</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Got questions about Ojas? We've got answers. Find everything you need to know about our AI health assistant.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-background rounded-xl border border-border/50 overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <h3 className="font-hero text-lg pr-4">{faq.question}</h3>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform duration-200",
                    openIndex === index && "rotate-180"
                  )}
                />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="bg-muted/30 rounded-xl p-8">
            <h3 className="text-xl font-hero mb-4">Still have questions?</h3>
            <p className="text-muted-foreground mb-6">
              Can't find the answer you're looking for? Please chat with our friendly team.
            </p>
            <a 
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </main>
      
      <LandingFooter />
    </div>
    </>
  );
}
