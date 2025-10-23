import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ArrowUp, ArrowDown, X } from 'lucide-react';

export default function Terms() {
  const articleRef = React.useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<Element[]>([]);
  const [index, setIndex] = React.useState(0);

  const clearHighlights = React.useCallback(() => {
    const root = articleRef.current;
    if (!root) return;
    root.querySelectorAll('.oj-hl, .oj-hl-active').forEach((el) => {
      el.classList.remove('oj-hl');
      el.classList.remove('oj-hl-active');
    });
  }, []);

  const applyHighlight = React.useCallback((list: Element[], idx: number) => {
    clearHighlights();
    list.forEach((el) => el.classList.add('oj-hl'));
    const active = list[idx];
    if (active) {
      active.classList.add('oj-hl-active');
      (active as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [clearHighlights]);

  React.useEffect(() => {
    const q = query.trim().toLowerCase();
    const root = articleRef.current;
    if (!root) { setHits([]); return; }
    if (!q) { clearHighlights(); setHits([]); setIndex(0); return; }
    const nodes = root.querySelectorAll('h2, h3, p, li');
    const list: Element[] = [];
    nodes.forEach((el) => { if ((el.textContent || '').toLowerCase().includes(q)) list.push(el); });
    setHits(list);
    setIndex(0);
    if (list.length) applyHighlight(list, 0);
    else clearHighlights();
  }, [query, applyHighlight, clearHighlights]);

  const jump = (dir: 1 | -1) => {
    if (!hits.length) return;
    const next = (index + dir + hits.length) % hits.length;
    setIndex(next);
    applyHighlight(hits, next);
  };

  const runSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    jump(1);
  };
  return (
    <main className="min-h-screen">
      <section className="relative w-full border-b">
        <div className="relative mx-auto max-w-5xl px-6 pt-16 pb-12">
          <div className="flex items-center gap-1">
            <img src="/logo-jas.svg" alt="Ojas" className="h-9 w-9" />
            <span className="text-xl font-semibold tracking-tight">jas</span>
          </div>
          <div className="mt-6 md:flex md:items-end md:justify-between gap-8">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight">Terms of Service</h1>
              <p className="mt-3 text-base text-muted-foreground">The rules of using Ojas and responsibilities that keep everyone safe.</p>
              <p className="mt-1 text-xs text-muted-foreground">Last updated: Oct 21, 2025</p>
              <div className="mt-6 grid grid-cols-[1fr_auto] items-center gap-2 max-w-xl">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search document"
                    className="pl-9"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={runSearch}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground tabular-nums w-[3.25rem] text-right">{hits.length ? `${index + 1}/${hits.length}` : '0/0'}</span>
                  <Button variant="ghost" size="icon" aria-label="Previous" onClick={() => jump(-1)} disabled={!hits.length}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Next" onClick={() => jump(1)} disabled={!hits.length}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Clear" onClick={() => setQuery('')} disabled={!query}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-8 md:mt-0">
              <svg aria-hidden="true" className="w-40 md:w-56 h-auto opacity-90" viewBox="0 0 200 160" fill="none">
                <path d="M100 28l60 20v52c0 18-14 31-60 44-46-13-60-26-60-44V48l60-20z" fill="hsl(var(--primary)/0.15)" />
                <path d="M100 40l44 15v47c0 12-11 22-44 31-33-9-44-19-44-31V55l44-15z" fill="hsl(var(--primary))" />
                <path d="M86 84l10 10 20-22" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <article
          ref={articleRef}
          className="space-y-12 text-base leading-relaxed"
        >
          <p>
            These Terms of Service ("Terms") govern your access to and use of Ojas, a healthcare-focused AI assistant by MedTrack ("we").
            By using Ojas, you agree to these Terms.
          </p>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">1. Service description</h2>
          <p>
            Ojas provides AI-generated information and guidance. It is not a medical device or emergency service. For medical advice, diagnosis, or treatment, consult a licensed professional.
          </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">2. Eligibility</h2>
          <p>
            You must be at least 13 years old (or the minimum age in your region) to use Ojas. If you use Ojas on behalf of an organization, you represent that you have authority to bind that organization to these Terms.
          </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">3. Accounts and security</h2>
          <ul>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You must provide accurate information and keep it up to date.</li>
            <li>Notify us immediately of any unauthorized use of your account.</li>
          </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">4. Acceptable use</h2>
          <ul>
            <li>Do not use Ojas for unlawful, harmful, or abusive activities.</li>
            <li>Do not attempt to probe, scan, or test the vulnerability of the service.</li>
            <li>Do not use Ojas for emergency situations. Call your local emergency number instead.</li>
          </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">5. Content</h2>
          <ul>
            <li>You own your content. You grant us a limited license to process it to provide and improve the service.</li>
            <li>AI-generated outputs may be inaccurate or incomplete. Use your judgment and consult professionals as needed.</li>
          </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">6. Privacy</h2>
            <p>
              Our <a href="/privacy" className="text-primary underline">Privacy Policy</a> explains how we collect and use your data. By using Ojas, you consent to our data practices.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">7. Third-party services</h2>
          <p>
            Ojas relies on third-party providers (e.g., Google Firebase, Zoho Mail). Their terms and privacy policies apply to their services.
          </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">8. Disclaimers</h2>
          <ul>
            <li>Ojas is provided on an "as is" and "as available" basis.</li>
            <li>We disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement to the extent permitted by law.</li>
          </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">9. Limitation of liability</h2>
          <p>
            To the extent permitted by law, MedTrack and its affiliates are not liable for indirect, incidental, special, consequential, or punitive damages, or any loss of data, profits, or revenues, arising from your use of Ojas.
          </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">10. Termination</h2>
          <p>
            You may stop using Ojas at any time. We may suspend or terminate access if you violate these Terms or misuse the service.
          </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">11. Changes</h2>
          <p>
            We may update these Terms to reflect product changes or legal requirements. We will post updates here with a new “Last updated” date. If changes are material, we will provide reasonable notice.
          </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">12. Contact</h2>
            <p>
              Questions about these Terms: <a href="mailto:hi@ojasai.co.in" className="text-primary underline">hi@ojasai.co.in</a>
            </p>
          </div>
        </article>
        <style>{`
          article ul { list-style: disc; padding-left: 1.5rem; margin: 1.5rem 0; }
          article ul li { margin: 0.75rem 0; line-height: 1.7; }
          article p { margin: 1rem 0; line-height: 1.8; }
          article strong { font-weight: 600; }
          .oj-hl{background:hsla(var(--primary)/.12);outline:1px solid hsla(var(--primary)/.25);border-radius:.35rem}
          .oj-hl-active{background:hsla(var(--primary)/.20);outline:2px solid hsla(var(--primary)/.45)}
        `}</style>
      </section>
    </main>
  );
}
