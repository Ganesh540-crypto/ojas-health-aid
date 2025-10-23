import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { name: 'Features', href: '#features', isScroll: true },
  { name: 'How it Works', href: '#how-it-works', isScroll: true },
  { name: 'Integrations', href: '#integrations', isScroll: true },
  { name: 'About Us', href: '/about', isScroll: false },
];

export const LandingHeader = () => {
  const [menuState, setMenuState] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMenuClick = (href: string, isScroll: boolean, e?: React.MouseEvent) => {
    if (isScroll) {
      // Check if we're on the landing page
      if (window.location.pathname === '/') {
        e?.preventDefault();
        const element = document.querySelector(href);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        // Navigate to landing page first, then scroll after load
        e?.preventDefault();
        window.location.href = '/' + href;
      }
    }
    setMenuState(false);
  };

  return (
    <header>
      <nav
        data-state={menuState && 'active'}
        className={cn(
          'fixed z-20 w-full transition-all duration-300',
          isScrolled && 'bg-background/75 border-b border-black/5 backdrop-blur-lg'
        )}
      >
        <div className="mx-auto max-w-7xl px-6 sm:px-12 lg:px-16">
          <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0">
            <div className="flex w-full justify-between gap-6 lg:w-auto">
              <Link
                to="/"
                aria-label="home"
                className="flex items-center gap-0.5"
              >
                <img src="/logo-jas.svg" alt="Ojas logo" className="h-8 w-8" />
                <span className="text-2xl font-hero mt-1">jas</span>
              </Link>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState ? 'Close Menu' : 'Open Menu'}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
              >
                <Menu className="data-[state=active]:rotate-180 data-[state=active]:scale-0 data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                <X className="data-[state=active]:rotate-0 data-[state=active]:scale-100 data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
              </button>

              <div className="m-auto hidden size-fit lg:block">
                <ul className="flex gap-6">
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      {item.isScroll ? (
                        <button 
                          onClick={(e) => handleMenuClick(item.href, item.isScroll, e)}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                        >
                          {item.name}
                        </button>
                      ) : (
                        <Link 
                          to={item.href}
                          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {item.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-background data-[state=active]:block lg:data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
              <div className="lg:hidden">
                <ul className="space-y-6 text-base">
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      {item.isScroll ? (
                        <button
                          onClick={(e) => handleMenuClick(item.href, item.isScroll, e)}
                          className="text-muted-foreground hover:text-accent-foreground block duration-150 cursor-pointer"
                        >
                          <span>{item.name}</span>
                        </button>
                      ) : (
                        <Link
                          to={item.href}
                          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setMenuState(false); }}
                          className="text-muted-foreground hover:text-accent-foreground block duration-150"
                        >
                          <span>{item.name}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(isScrolled && 'lg:hidden')}
                >
                  <a href={window.location.hostname === 'localhost' ? '/login' : 'https://app.ojasai.co.in/login'}>
                    <span>Login</span>
                  </a>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className={cn(isScrolled && 'lg:hidden')}
                >
                  <a href={window.location.hostname === 'localhost' ? '/signup' : 'https://app.ojasai.co.in/signup'}>
                    <span>Sign Up</span>
                  </a>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className={cn(isScrolled ? 'lg:inline-flex' : 'hidden')}
                >
                  <a href={window.location.hostname === 'localhost' ? '/signup' : 'https://app.ojasai.co.in/signup'}>
                    <span>Get Started</span>
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};
