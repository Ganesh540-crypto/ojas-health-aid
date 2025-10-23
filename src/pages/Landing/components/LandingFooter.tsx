import React from 'react';
import { Link } from 'react-router-dom';

const links = [
  {
    group: 'Product',
    items: [
      {
        title: 'Features',
        href: '#features',
        isScroll: true
      },
      {
        title: 'How it Works',
        href: '#how-it-works',
        isScroll: true
      },
      {
        title: 'Integrations',
        href: '#integrations',
        isScroll: true
      },
    ],
  },
  {
    group: 'Company',
    items: [
      {
        title: 'About Us',
        href: '/about',
        isScroll: false
      },
      {
        title: 'Contact',
        href: '/contact',
        isScroll: false
      },
      {
        title: 'FAQ',
        href: '/faq',
        isScroll: false
      },
      {
        title: 'Privacy',
        href: '/privacy',
        isScroll: false
      },
      {
        title: 'Terms',
        href: '/terms',
        isScroll: false
      },
    ],
  },
];

export const LandingFooter = () => {
  const handleLinkClick = (href: string, isScroll: boolean, e: React.MouseEvent) => {
    if (isScroll) {
      // Check if we're on the landing page
      if (window.location.pathname === '/') {
        e.preventDefault();
        const element = document.querySelector(href);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        // Navigate to landing page with hash
        window.location.href = '/' + href;
      }
    }
  };

  return (
    <footer className="bg-background border-t py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6 sm:px-12 lg:px-16">
        <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-6">
            <Link
              to="/"
              aria-label="go home"
              className="block size-fit"
            >
              <div className="flex items-center gap-0.5">
                <img src="/logo-jas.svg" alt="Ojas logo" className="h-8 w-8" />
                <span className="text-2xl font-hero mt-1">jas</span>
              </div>
            </Link>

            <div className="space-y-4 max-w-sm">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your AI-powered health companion for personalized wellness guidance.
              </p>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Made with ❤️ by <strong className="text-primary">Medtrack</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  A product of <strong>VISTORA TRAYANA LLP</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
            {links.map((link, index) => (
              <div
                key={index}
                className="space-y-4"
              >
                <span className="block font-medium font-hero">{link.group}</span>

                <div className="flex flex-wrap gap-4 sm:flex-col">
                  {link.items.map((item, itemIndex) => (
                    item.isScroll ? (
                      <button
                        key={itemIndex}
                        onClick={(e) => handleLinkClick(item.href, item.isScroll, e)}
                        className="text-muted-foreground hover:text-primary duration-150 cursor-pointer text-left"
                      >
                        <span>{item.title}</span>
                      </button>
                    ) : (
                      <Link
                        key={itemIndex}
                        to={item.href}
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="text-muted-foreground hover:text-primary block duration-150"
                      >
                        <span>{item.title}</span>
                      </Link>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50 text-center">
          <span className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Ojas AI. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
};
