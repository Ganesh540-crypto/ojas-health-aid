// Shared text analysis helpers to avoid duplication

export type Tone = 'angry' | 'romantic' | 'lazy' | 'casual' | 'neutral';

export const HEALTH_KEYWORDS: string[] = [
  'health','pain','symptom','medicine','medication','doctor','hospital',
  'injury','hurt','sick','fever','headache','stomach','chest','breathing','blood',
  'pressure','diabetes','cancer','treatment','prescription','pill','drug','allergy',
  'infection','virus','bacteria','disease','condition','diagnosis','therapy','surgery',
  'emergency','urgent','serious','chronic','acute','prevention','wellness','fitness',
  'diet','nutrition','exercise','sleep','mental health','anxiety','depression','stress','fatigue',
  // Substance-related and common misspellings
  'cocaine','cocain','heroin','opioid','opioids','opiate','opiates','marijuana','weed','cannabis','alcohol','overdose','addiction','rehab','substance'
];

export function isHealthRelated(message: string): boolean {
  const lower = message.toLowerCase();
  return HEALTH_KEYWORDS.some(k => lower.includes(k));
}

// Detect if a query likely needs fresh/real-time data (schedules, scores, prices, dates, etc.)
export function needsFreshData(message: string): boolean {
  const m = message.toLowerCase();
  
  // EXPLICIT search requests - highest priority
  const explicitSearch = /(websearch|web search|search online|search the web|look up|find online|with sources?|give me sources?|provide sources?|need sources?|cite sources?|reference|citation|links?|websites?|urls?)/i;
  if (explicitSearch.test(m)) return true;
  
  // Current information requests
  const currentInfo = /(current|latest|recent|today|now|right now|at this moment|presently|as of|up to date|updated|real[ -]?time)/i;
  if (currentInfo.test(m)) return true;
  
  // Temporal patterns
  const temporal = /(when|what time|today|tonight|tomorrow|yesterday|this\s+(week|month|year)|next\s+(week|month|year)|date|start|kick\s*off|deadline|schedule|fixture|fixtures|upcoming|release|launch|announce(d)?|event|match|game|season|tournament|final|semi[-\s]?final)/i;
  
  // Real-time data patterns
  const realtime = /(temperature|weather|temp|celsius|fahrenheit|forecast|climate|humidity|rain|snow|storm|aqi|air quality|pollution|score|scores|scorecard|commentary|stream|price|prices|cost|rate|rates|stock|stocks|market|availability|in\s*stock)/i;
  
  // Year references (especially future years)
  const year = /\b(202[4-9]|20[3-9]\d)\b/; // 2024 onwards
  
  // Location-based current queries
  const locationCurrent = /(in\s+[A-Z][a-z]+|at\s+[A-Z][a-z]+).*(now|today|current|temperature|weather|time)/i;
  
  return temporal.test(m) || realtime.test(m) || year.test(m) || locationCurrent.test(m);
}

export function detectTone(message: string): Tone {
  const casual = /\b(hey|hi|yo|sup|what's up|whatsup|bro|dude|lol|haha|cool|awesome|nice|wassup|howdy)\b/i;
  const romantic = /\b(love|heart|romantic|beautiful|gorgeous|sweetheart|darling|honey)\b/i;
  const angry = /\b(angry|mad|frustrated|annoyed|pissed|hate|stupid|damn|wtf|fuck)\b/i;
  const lazy = /\b(lazy|tired|sleepy|bored|meh|whatever|dunno|idk|can't be bothered)\b/i;
  
  if (angry.test(message)) return 'angry';
  if (romantic.test(message)) return 'romantic';
  if (lazy.test(message)) return 'lazy';
  if (casual.test(message)) return 'casual';
  return 'neutral';
}

// Substance/danger detection to trigger safety labels and harm-minimization guidance
const SUBSTANCE_TERMS = [
  'cocaine','cocain','heroin','meth','methamphetamine','mdma','ecstasy','lsd','acid','psilocybin','shrooms','ketamine','opioid','opioids','opiate','opiates','fentanyl','morphine','oxycodone','codeine','marijuana','weed','cannabis','hash','alcohol','nicotine','vape','smoking','huffing','glue','inhalant','overdose','addiction','drug abuse','substance use'
];

export function isSubstanceQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return SUBSTANCE_TERMS.some(term => lower.includes(term));
}

// Remove sections that describe routes of administration or step-by-step consumption instructions
export function sanitizeSubstanceContent(text: string): string {
  let out = text;
  // 1) Remove a dedicated "Methods of Use" section up to the next major heading
  out = out.replace(/(?:^|\n)\s*(methods? of use|routes? of (?:drug )?administration|how\s+(?:to|do i)\s+(?:use|take|inject|snort|smoke)[^\n]*):?[\s\S]*?(?=\n\s*(risks|dangers|warnings|long[-\s]?term|seeking help|treatment|prevention|addiction|support|conclusion)\b|$)/gi, '\n');

  // 2) Remove common method blocks (e.g., "Snorting:", "Injecting:", "Smoking:", "Rubbing on gums:")
  const methodLabels = [
    'snorting', 'injecting', 'smoking', 'rubbing on gums', 'vaping', 'boofing', 'plugging', 'insufflation', 'iv use', 'iv injection'
  ];
  for (const label of methodLabels) {
    const rx = new RegExp(`(?:^|\\n)\\s*${label}\s*:?[\\s\\S]*?(?=\\n\\s*(?:[A-Z].*?:|[A-Z][a-z].*|-)\\s*|\\n\\n|$)`, 'gi');
    out = out.replace(rx, '\n');
  }

  // 3) Remove explicit how-to verbs around using the substance
  out = out.replace(/\b(how\s+to\s+(?:use|take|inject|snort|smoke|prepare|cook)|instructions?\s+for\s+(?:use|taking|injecting|snorting|smoking))[^\n]*\n?/gi, '');

  // 4) Collapse excessive blank lines caused by removals
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out || text;
}
