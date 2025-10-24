import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';

export default function LandingContact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission here
    console.log('Form submitted:', formData);
    // You can integrate with your backend or email service
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <>
      <Helmet>
        <title>Contact Ojas – We’re here to help</title>
        <meta name="description" content="Have questions about Ojas AI? Contact our team and we’ll get back within 24 hours." />
        <link rel="canonical" href="https://ojasai.co.in/contact" />
        <meta property="og:title" content="Contact Ojas – We’re here to help" />
        <meta property="og:description" content="Reach out to the Ojas team for questions, partnerships, or support." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ojasai.co.in/contact" />
        <meta property="og:image" content="https://ojasai.co.in/favicon.ico" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Ojas AI",
          "url": "https://ojasai.co.in/",
          "logo": "https://ojasai.co.in/favicon.ico",
          "contactPoint": [{
            "@type": "ContactPoint",
            "contactType": "customer support",
            "email": "hi@ojasai.co.in",
            "areaServed": "IN"
          }]
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          "name": "Contact Ojas",
          "url": "https://ojasai.co.in/contact"
        })}</script>
      </Helmet>
    <div className="min-h-screen bg-background">
      <LandingHeader />
      
      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 sm:px-12 lg:px-16 py-24 md:py-32">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-hero mb-4">Get in Touch</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Have questions about Ojas? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Information */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-hero text-lg mb-2">Email Us</h3>
                    <p className="text-muted-foreground text-sm mb-2">
                      Send us an email and we'll get back to you within 24 hours.
                    </p>
                    <a 
                      href="mailto:hi@ojasai.co.in" 
                      className="text-primary hover:text-primary/80 font-medium"
                    >
                      hi@ojasai.co.in
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-hero text-lg mb-2">Our Office</h3>
                    <p className="text-muted-foreground text-sm">
                      VISTORA TRAYANA LLP<br />
                      India
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-hero text-lg mb-2">Support Hours</h3>
                    <p className="text-muted-foreground text-sm">
                      Monday - Friday: 9:00 AM - 6:00 PM IST<br />
                      Weekend: 10:00 AM - 4:00 PM IST
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-8">
                <h2 className="text-2xl font-hero mb-6">Send us a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="your.email@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="What is this regarding?"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium mb-2">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={6}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                      placeholder="Tell us more about your inquiry..."
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full md:w-auto px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    Send Message
                  </button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-16 text-center">
          <div className="bg-muted/30 rounded-xl p-8">
            <h3 className="text-xl font-hero mb-4">About Our Company</h3>
            <p className="text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              Ojas is developed by <strong>VISTORA TRAYANA LLP</strong>, part of the Medtrack ecosystem. 
              We're committed to creating innovative healthcare solutions that prioritize user privacy and provide 
              valuable health insights. Our team is dedicated to supporting your wellness journey with cutting-edge AI technology.
            </p>
            <div className="mt-6">
              <p className="text-sm text-muted-foreground">
                Made with ❤️ by <strong>Medtrack</strong> - Your trusted health technology partner
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <LandingFooter />
    </div>
    </>
  );
}
