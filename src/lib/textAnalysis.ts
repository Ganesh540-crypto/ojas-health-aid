// Shared text analysis helpers to avoid duplication

export type Tone = 'angry' | 'romantic' | 'lazy' | 'casual' | 'neutral';

export const HEALTH_KEYWORDS: string[] = [
  'health','pain','symptom','medicine','medication','doctor','hospital',
  'injury','hurt','sick','fever','headache','stomach','chest','breathing','blood',
  'pressure','diabetes','cancer','treatment','prescription','pill','drug','allergy',
  'infection','virus','bacteria','disease','condition','diagnosis','therapy','surgery',
  'emergency','urgent','serious','chronic','acute','prevention','wellness','fitness',
  'diet','nutrition','exercise','sleep','mental health','anxiety','depression','stress','fatigue'
];

export function isHealthRelated(message: string): boolean {
  const lower = message.toLowerCase();
  return HEALTH_KEYWORDS.some(k => lower.includes(k));
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
