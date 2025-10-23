import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  }
];

export const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-16 md:py-32 bg-muted/30">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-hero mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
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

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            Still have questions?
          </p>
          <a
            href={window.location.hostname === 'localhost' ? '/contact' : '/contact'}
            className="inline-flex items-center text-primary hover:text-primary/80 font-medium"
          >
            Contact our support team
          </a>
        </div>
      </div>
    </section>
  );
};
