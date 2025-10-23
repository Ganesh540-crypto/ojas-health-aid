// Shared text analysis helpers to avoid duplication

export type Tone = 'angry' | 'romantic' | 'lazy' | 'casual' | 'neutral';

// Comprehensive medical and health terminology based on healthcare AI best practices
export const HEALTH_KEYWORDS: string[] = [
  // Primary symptoms & complaints
  'pain','ache','hurt','sore','tender','discomfort','cramp','spasm',
  'symptom','symptoms','feel','feeling','experiencing',
  
  // Body systems & locations
  'head','headache','migraine','brain','skull',
  'chest','heart','cardiac','cardiovascular','angina',
  'stomach','abdomen','belly','gut','digestive','intestine','bowel',
  'breathing','breath','respiratory','lung','asthma','cough','wheeze',
  'blood','bleeding','hemorrhage','clot','circulation',
  'skin','rash','itch','lesion','wound','burn','blister',
  'joint','bone','muscle','back','neck','shoulder','knee','ankle',
  'eye','vision','sight','blind','blurry',
  'ear','hearing','deaf','tinnitus',
  'throat','swallowing','voice','hoarse',
  
  // Conditions & diseases
  'diabetes','diabetic','sugar','glucose','insulin',
  'pressure','hypertension','hypotension','bp',
  'cancer','tumor','malignant','benign','oncology','chemotherapy',
  'infection','infected','sepsis','inflammation',
  'virus','viral','bacteria','bacterial','fungal',
  'disease','illness','disorder','syndrome','condition',
  'allergy','allergic','reaction','anaphylaxis',
  'chronic','acute','severe','mild','moderate',
  
  // Mental health
  'mental','psychological','psychiatric',
  'anxiety','anxious','panic','worry','fear',
  'depression','depressed','sad','hopeless','suicidal',
  'stress','stressed','overwhelm','burnout',
  'mood','emotion','bipolar','schizophrenia',
  'ptsd','trauma','abuse',
  
  // Medical care & treatment
  'doctor','physician','specialist','surgeon','nurse','medic',
  'hospital','clinic','emergency','urgent','er','icu',
  'treatment','therapy','procedure','operation','surgery',
  'medicine','medication','drug','pill','tablet','capsule','dose',
  'prescription','prescribe','rx',
  'diagnosis','diagnose','test','exam','scan','xray','mri','ct',
  
  // Health states
  'sick','ill','unwell','nausea','vomit','dizzy','faint','weak',
  'fever','temperature','chills','sweating',
  'fatigue','tired','exhausted','energy',
  'sleep','insomnia','sleeping','nightmare',
  'weight','obesity','underweight','appetite',
  
  // Wellness & prevention
  'health','wellness','fitness','exercise','workout',
  'diet','nutrition','vitamin','supplement','nutrient',
  'prevention','preventive','screening','checkup',
  
  // Substances (harm reduction)
  'substance','addiction','addicted','withdraw','overdose',
  'alcohol','alcoholic','drunk','drinking',
  'smoking','smoke','cigarette','tobacco','nicotine','vape',
  'drug','cocaine','cocain','heroin','opioid','opioids','opiate','opiates',
  'marijuana','weed','cannabis','hash','thc','cbd',
  'meth','methamphetamine','mdma','ecstasy','lsd',
  'rehab','recovery','sobriety',
  
  // Emergency indicators
  'emergency','urgent','critical','serious','severe',
  'stroke','heart attack','seizure','unconscious','collapse',
  'suicide','self-harm','cutting','kill myself'
];

// Medical action verbs and context patterns
const HEALTH_PATTERNS = [
  /\b(should i see|need to see|visit) (a |the )?(doctor|physician|specialist|hospital|clinic)/i,
  /\b(diagnose|diagnosed|diagnosis) (with|of|for)/i,
  /\b(take|taking|on|prescribed) (medicine|medication|drug|pill|tablet)/i,
  /\b(hurts?|aches?|pains?) (when|after|during)/i,
  /\b(feel|feeling) (sick|ill|unwell|dizzy|weak|nauseous)/i,
  /\b(symptom|symptoms) (of|for|include)/i,
  /\b(how to|what to do|what should) (treat|cure|fix|help)/i,
  /\b(is it normal|normal to|worried about|concerned about)/i,
  /\b(side effect|adverse|reaction) (of|to|from)/i,
  /\bmy (child|baby|kid|son|daughter|parent|mother|father) (has|is|feels)/i
];

/**
 * Calculate Levenshtein distance between two strings (typo tolerance)
 * Used for fuzzy matching of misspelled health terms
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Check if a word is a fuzzy match for any health keyword
 * Allows typos based on word length (industry standard)
 */
function isFuzzyHealthMatch(word: string): boolean {
  const wordLen = word.length;
  if (wordLen < 4) return false; // Too short for fuzzy matching
  
  // Tolerance: 1 typo for 4-7 chars, 2 typos for 8+ chars
  const maxDistance = wordLen >= 8 ? 2 : 1;
  
  return HEALTH_KEYWORDS.some(keyword => {
    if (Math.abs(keyword.length - wordLen) > maxDistance) return false;
    return levenshteinDistance(word.toLowerCase(), keyword) <= maxDistance;
  });
}

/**
 * Enhanced health query detection using comprehensive medical terminology
 * and contextual patterns. Based on healthcare chatbot best practices.
 * NOW WITH FUZZY MATCHING for typo tolerance!
 */
export function isHealthRelated(message: string): boolean {
  const lower = message.toLowerCase();
  
  // Check exact keyword matches
  const hasHealthKeyword = HEALTH_KEYWORDS.some(k => {
    const regex = new RegExp(`\\b${k}\\b`, 'i');
    return regex.test(lower);
  });
  
  if (hasHealthKeyword) return true;
  
  // Check fuzzy matches for misspellings
  const words = lower.split(/\s+/);
  const hasFuzzyMatch = words.some(word => isFuzzyHealthMatch(word));
  
  if (hasFuzzyMatch) return true;
  
  // Check medical context patterns
  const hasHealthPattern = HEALTH_PATTERNS.some(pattern => pattern.test(message));
  
  return hasHealthPattern;
}

/**
 * Fast, deterministic health classifier for routing decisions.
 * Returns confidence score: 0 (not health) to 1 (definitely health)
 * NOW WITH FUZZY MATCHING for typo tolerance!
 */
export function getHealthConfidence(message: string): number {
  const lower = message.toLowerCase();
  const words = lower.split(/\s+/);
  let score = 0;
  
  // Emergency keywords = immediate escalation
  const emergencyTerms = ['emergency','urgent','critical','severe','stroke','heart attack','seizure','suicide','overdose','unconscious'];
  if (emergencyTerms.some(t => lower.includes(t))) return 1.0;
  
  // Strong symptom indicators (exact or fuzzy match)
  const strongSymptoms = ['pain','ache','headache','fever','dizzy','vomit','nausea','bleeding','seizure','faint','chest','breathing','symptom','sick','ill','hurt','injured'];
  const hasStrongSymptom = strongSymptoms.some(s => {
    const regex = new RegExp(`\\b${s}\\b`, 'i');
    return regex.test(lower);
  });
  
  // Check for fuzzy matches of strong symptoms (e.g., "headahe" → "headache")
  const hasFuzzyStrongSymptom = !hasStrongSymptom && words.some(word => {
    if (word.length < 4) return false;
    const maxDist = word.length >= 8 ? 2 : 1;
    return strongSymptoms.some(symptom => {
      if (Math.abs(symptom.length - word.length) > maxDist) return false;
      return levenshteinDistance(word, symptom) <= maxDist;
    });
  });
  
  if (hasStrongSymptom) score += 0.35;
  else if (hasFuzzyStrongSymptom) score += 0.30; // Slightly lower for fuzzy
  
  // Count exact health keyword matches
  const exactMatches = HEALTH_KEYWORDS.filter(k => {
    const regex = new RegExp(`\\b${k}\\b`, 'i');
    return regex.test(lower);
  }).length;
  score += Math.min(exactMatches * 0.1, 0.4);
  
  // Add fuzzy matches (lower weight than exact)
  const fuzzyMatches = words.filter(word => isFuzzyHealthMatch(word)).length;
  score += Math.min(fuzzyMatches * 0.08, 0.3);
  
  // Medical context patterns (weighted heavily)
  const patternMatches = HEALTH_PATTERNS.filter(p => p.test(message)).length;
  score += Math.min(patternMatches * 0.3, 0.5);
  
  return Math.min(score, 1.0);
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
