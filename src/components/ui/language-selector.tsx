import React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { GLOBAL_LANGUAGES, INDIAN_LANGUAGES } from '@/lib/languages';
import { languageStore } from '@/lib/languageStore';

export const LanguageSelector: React.FC = () => {
  const lang = languageStore.get();
  const [langCode, setLangCode] = React.useState(lang.code);

  React.useEffect(() => {
    const unsub = languageStore.subscribe((l) => setLangCode(l.code));
    return () => unsub();
  }, []);

  const allLanguages = [...GLOBAL_LANGUAGES, ...INDIAN_LANGUAGES].filter(
    (l, i, arr) => arr.findIndex((x) => x.code === l.code) === i
  );
  const selectedLabel = allLanguages.find((l) => l.code === langCode)?.label || 'EN';

  return (
    <div className="fixed bottom-6 right-6 z-30">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full font-semibold shadow-md border border-border bg-background hover:bg-muted"
            aria-label={`Change language (current: ${selectedLabel})`}
            title={selectedLabel}
          >
            {selectedLabel.charAt(0)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-56 overflow-y-auto bg-background">
          {allLanguages.map((l) => (
            <DropdownMenuItem key={l.code} onClick={() => languageStore.set(l.code)}>
              <span className="mr-2 w-4 inline-block text-primary">{langCode === l.code ? '✓' : ''}</span>
              <span>{l.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
