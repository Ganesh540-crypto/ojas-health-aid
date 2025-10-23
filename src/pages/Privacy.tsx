import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ArrowUp, ArrowDown, X } from 'lucide-react';

export default function Privacy() {
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
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight">Privacy Policy</h1>
              <p className="mt-3 text-base text-muted-foreground">How we collect, use, and protect your data when you use Ojas.</p>
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
                <rect x="20" y="40" width="160" height="100" rx="16" fill="hsl(var(--primary)/0.15)" />
                <circle cx="70" cy="80" r="22" fill="hsl(var(--primary))" />
                <rect x="100" y="70" width="60" height="8" rx="4" fill="hsl(var(--primary)/0.8)" />
                <rect x="100" y="88" width="60" height="8" rx="4" fill="hsl(var(--primary)/0.5)" />
                <rect x="100" y="106" width="40" height="8" rx="4" fill="hsl(var(--primary)/0.3)" />
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
            Ojas is a healthcare-focused AI assistant created by MedTrack ("we", "us").
            We respect your privacy and are committed to protecting your personal data.
            This policy explains what we collect, why we collect it, and how we protect it.
          </p>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">What we collect</h2>
          <ul>
            <li><strong>Account details</strong>: name, email, profile photo.</li>
            <li><strong>Onboarding details (optional)</strong>: age, height, weight, allergies, pre-existing conditions, medications, interests, pulse topics, location and language preferences.</li>
            <li><strong>App usage</strong>: chats you create, feature usage, basic device data (browser, OS, timestamps).</li>
            <li><strong>Service data</strong>: technical logs to operate and secure the service.</li>
          </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">How we use your data</h2>
          <ul>
            <li><strong>Account & authentication</strong>: sign up, sign in, email verification and security.</li>
            <li><strong>Personalization</strong>: tailor chat and health guidance to your preferences.</li>
            <li><strong>Product improvement & safety</strong>: debugging, preventing abuse, and enhancing reliability.</li>
            <li><strong>Communications</strong>: transactional emails (e.g., verification).</li>
          </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">Legal bases</h2>
          <ul>
            <li><strong>Consent</strong>: for optional health profile and communications.</li>
            <li><strong>Contract</strong>: to provide the service you request.</li>
            <li><strong>Legitimate interests</strong>: security, abuse prevention, product improvement.</li>
          </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">Sharing</h2>
          <p>
            We do not sell your personal data. We share data only with service providers that power Ojas:
          </p>
          <ul>
            <li><strong>Google Firebase</strong> (Authentication, Database/Storage, Cloud Functions) to operate app infrastructure.</li>
            <li><strong>Zoho Mail (SMTP)</strong> to send verification emails.</li>
          </ul>
          <p>
            These providers process data on our behalf under their terms and security measures.
          </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">Data retention</h2>
          <ul>
            <li><strong>Account data</strong>: kept while your account is active or as required by law.</li>
            <li><strong>Chats & profile</strong>: kept until you delete them or delete your account.</li>
            <li><strong>System logs</strong>: retained for a limited period for security and operations.</li>
          </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">Security</h2>
          <p>
            We use industry-standard protections and host on trusted infrastructure.
            Data is encrypted in transit and at rest by our providers. No system is 100% secure;
            please use a strong password and keep your device secure.
          </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">Your rights</h2>
          <ul>
            <li>Access, update, or delete your data (including deleting your account in Settings).</li>
            <li>Withdraw consent for optional data at any time.</li>
            <li>Contact us to exercise rights under applicable laws.</li>
          </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">Children</h2>
          <p>
            Ojas is not intended for children under 13. Do not use the service if you are under the minimum age in your region.
          </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">Healthcare disclaimer</h2>
          <p>
            Ojas provides health information for educational purposes only and is not a substitute for professional medical advice,
            diagnosis, or treatment. Do not use Ojas for emergencies; call your local emergency number instead.
          </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">Changes</h2>
          <p>
            We may update this policy to reflect improvements or legal requirements. We will post updates here with a new “Last updated” date.
          </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mt-12 mb-6">Contact</h2>
            <p>
              Questions or requests: <a href="mailto:hi@ojasai.co.in" className="text-primary underline">hi@ojasai.co.in</a>
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
