const { Firestore } = require('@google-cloud/firestore');
const firestore = new Firestore();

async function checkLatestArticle() {
  console.log('Fetching latest article...\n');
  
  const snapshot = await firestore
    .collection('pulse_articles')
    .orderBy('generatedAt', 'desc')
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    console.log('No articles found');
    return;
  }
  
  const doc = snapshot.docs[0];
  const data = doc.data();
  
  console.log('✅ Article ID:', doc.id);
  console.log('📰 Title:', data.title);
  console.log('\n📝 Introduction field:', data.introduction ? '✓ EXISTS' : '✗ MISSING');
  if (data.introduction) {
    console.log('   Preview:', data.introduction.substring(0, 150) + '...');
  }
  console.log('\n📄 Sections:', data.sections?.length || 0);
  if (data.sections && data.sections.length > 0) {
    data.sections.forEach((section, i) => {
      console.log(`   ${i + 1}. "${section.heading || '(empty - intro)'}" - ${section.sentences?.length || 0} sentences`);
    });
  }
  console.log('\n⏰ Generated:', data.generatedAt);
}

checkLatestArticle().catch(console.error);
