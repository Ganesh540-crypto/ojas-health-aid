/*
  Lightweight smoke tests for routing behavior without network calls.
  Uses monkey-patching to stub model services.
*/

import { aiRouter } from '../src/lib/aiRouter';
import { geminiLiteService } from '../src/lib/geminiLite';
import { geminiSearchService } from '../src/lib/geminiSearch';
import { healthIntakeService } from '../src/lib/healthIntake';

async function main() {
  const origLite = geminiLiteService.generateResponse.bind(geminiLiteService);
  const origSearch = geminiSearchService.generateResponse.bind(geminiSearchService);
  const origIntake = healthIntakeService.generateQuestions.bind(healthIntakeService);

  try {
    // Test 1: Casual message should stay on Lite
    (geminiLiteService as any).generateResponse = async (_msg: string) => ({
      content: 'Here’s a quick joke for you! Why did the developer go broke? Because they used up all their cache.',
      isHealthRelated: false,
    });
    const r1 = await aiRouter.route('Tell me a joke about programming.');
    console.log('\n[SMOKE 1 — Casual]');
    console.log({ decision: r1.decision, modelUsed: r1.modelUsed, isHealthRelated: r1.isHealthRelated, contentPreview: r1.content.slice(0, 80) + '...' });

    // Test 2: Health escalation with intake path
    ;(geminiLiteService as any).generateResponse = async (_msg: string) => ({
      content: '[[ESCALATE_HEALTH]]\nI’ll hand this to our health assistant right away.',
      isHealthRelated: true,
    });
    ;(healthIntakeService as any).generateQuestions = async (_msg: string) => ({
      questions: [
        { id: 'q1', text: 'When did the pain start?', options: ['<24h', '1–3 days', '4–7 days', '>1 week'] },
        { id: 'q2', text: 'How severe is it on a 0–10 scale?', options: ['1–3', '4–6', '7–8', '9–10'] },
        { id: 'q3', text: 'Any shortness of breath, sweating, or nausea?' },
        { id: 'q4', text: 'Does it get worse with activity?' },
        { id: 'q5', text: 'Any known heart conditions or risk factors?' },
      ],
      reasoningNote: 'Chest pain red‑flag screening and basics to tailor guidance.'
    });
    const r2 = await aiRouter.route('I have chest pain and I am sweating.');
    console.log('\n[SMOKE 2 — Escalate + Intake]');
    console.log({ decision: r2.decision, modelUsed: r2.modelUsed, awaitingIntakeAnswers: r2.awaitingIntakeAnswers, intakeLen: r2.intake?.questions.length });

    // Test 3: Health escalation without intake (fallback to health answer)
    ;(healthIntakeService as any).generateQuestions = async (_msg: string) => null;
    ;(geminiSearchService as any).generateResponse = async (_msg: string) => ({
      content: 'Summary: This sounds non‑urgent, but here are steps and red flags to watch.\n\nSelf‑care & Lifestyle:\n- Rest, fluids, and OTC pain relief per label.\n\nPrecautions & Red Flags:\n- If chest pain is severe, with SOB or fainting, seek emergency care.\n\nQuestion: What makes the pain better or worse?',
      isHealthRelated: true,
    });
    const r3 = await aiRouter.route('I have diabetes. Any daily tips?');
    console.log('\n[SMOKE 3 — Escalate + Health Answer]');
    console.log({ decision: r3.decision, modelUsed: r3.modelUsed, isHealthRelated: r3.isHealthRelated, contentPreview: r3.content.slice(0, 80) + '...' });
  } finally {
    // Restore originals
    (geminiLiteService as any).generateResponse = origLite;
    (geminiSearchService as any).generateResponse = origSearch;
    (healthIntakeService as any).generateQuestions = origIntake;
  }
}

main().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
