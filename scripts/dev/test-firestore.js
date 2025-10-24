import { Firestore } from '@google-cloud/firestore';
import { GoogleGenAI } from '@google/genai';

const firestore = new Firestore();
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

async function testFirestore() {
  console.log('\n=== Testing Firestore ===');
  
  // Check pulse_raw collection
  const rawRef = firestore.collection('pulse_raw');
  const rawSnapshot = await rawRef.limit(5).get();
  console.log(`\nPulse Raw collection: ${rawSnapshot.size} documents found`);
  
  if (rawSnapshot.size > 0) {
    console.log('\nSample documents:');
    rawSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\n- ID: ${doc.id}`);
      console.log(`  Title: ${data.title}`);
      console.log(`  Source: ${data.source}`);
      console.log(`  Published: ${data.publishedAt}`);
      console.log(`  Tags: ${data.tags?.join(', ') || 'none'}`);
      console.log(`  Summary: ${data.summary?.substring(0, 100)}...`);
    });
  }
  
  // Check pulse_config collection
  const configRef = firestore.collection('pulse_config');
  const configSnapshot = await configRef.limit(5).get();
  console.log(`\n\nPulse Config collection: ${configSnapshot.size} documents found`);
  
  // Check pulse_meta collection
  const metaRef = firestore.collection('pulse_meta');
  const metaSnapshot = await metaRef.limit(5).get();
  console.log(`Pulse Meta collection: ${metaSnapshot.size} documents found`);
}

async function testGemini() {
  console.log('\n\n=== Testing Gemini Integration ===');
  
  if (!GEMINI_API_KEY) {
    console.log('❌ GEMINI_API_KEY not found in environment');
    return;
  }
  
  console.log('✓ GEMINI_API_KEY found');
  
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  const testArticle = {
    title: "New Study Shows Benefits of Regular Exercise",
    source: "Health News Daily",
    url: "https://example.com/article",
    publishedAt: "2024-01-15T10:00:00Z",
    snippet: "A comprehensive study published in the Journal of Medicine reveals that regular physical activity can significantly reduce the risk of chronic diseases including heart disease, diabetes, and certain cancers. Researchers followed 10,000 participants over 5 years."
  };
  
  const prompt = `You are a health news summarizer for Ojas Pulse.
Summarize the input into 3-7 sentences focused on key health insights for a general audience.
Output strict JSON (no markdown, no code fences) with keys: summary (string), tags (array of strings chosen from ["mental-health","fitness","nutrition","chronic-disease","medication","environmental-health","pandemic","preventive-care","women-health","child-health","aging","sleep","stress"]), locationRelevance ("global" or "country:XX" or "city:Name"), urgency ("low"|"medium"|"high"|"critical"), keyInsights (array of short strings). Do not include any other keys.

Title: ${testArticle.title}
Source: ${testArticle.source}
URL: ${testArticle.url}
Published: ${testArticle.publishedAt}

Snippet:
${testArticle.snippet}`;

  try {
    console.log('\nSending request to Gemini...');
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    let text = response.text || "";
    console.log('\n✓ Received response from Gemini');
    console.log('\nRaw response:');
    console.log(text.substring(0, 300));
    
    // Strip markdown code fences if present
    text = text.replace(/^```json\s*|\s*```$/g, '').trim();
    
    const parsed = JSON.parse(text);
    console.log('\n✓ Successfully parsed JSON');
    console.log('\nParsed result:');
    console.log(JSON.stringify(parsed, null, 2));
    
  } catch (e) {
    console.log('\n❌ Error:', e.message);
    if (e.stack) {
      console.log(e.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

async function main() {
  try {
    await testFirestore();
    await testGemini();
    console.log('\n\n=== Tests Complete ===\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

main();
