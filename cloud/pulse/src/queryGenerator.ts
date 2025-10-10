/**
 * Query Generator for Ojas Pulse
 * Generates diverse health-related queries for comprehensive news synthesis
 */

export interface HealthQuery {
  query: string;
  category: string;
  region?: string;
  priority: 'high' | 'medium' | 'low';
}

const CATEGORIES = {
  'mental-health': 'Mental Health',
  'fitness': 'Fitness & Exercise',
  'nutrition': 'Nutrition & Diet',
  'chronic-disease': 'Chronic Diseases',
  'medication': 'Medications & Treatments',
  'environmental-health': 'Environmental Health',
  'pandemic': 'Pandemic & Infectious Diseases',
  'preventive-care': 'Preventive Care',
  'women-health': 'Women\'s Health',
  'child-health': 'Child Health',
  'aging': 'Aging & Elderly Care',
  'sleep': 'Sleep Health',
  'stress': 'Stress Management',
};

const REGIONS = ['India', 'global', 'Asia', 'United States', 'Europe', 'Africa'];

const TIMEFRAMES = ['today', 'this week', 'recent', 'latest', '2024', 'current'];

const QUERY_TEMPLATES = [
  // Research & Studies
  'latest {category} research',
  'new {category} study findings',
  'breakthrough in {category}',
  '{category} clinical trials {timeframe}',
  'recent discoveries in {category}',
  
  // Regional Focus
  '{category} in {region}',
  '{region} {category} initiatives',
  '{category} policies in {region}',
  '{region} health ministry {category} guidelines',
  
  // Trends & Statistics
  '{category} trends {timeframe}',
  '{category} statistics {timeframe}',
  'rising cases of {category}',
  '{category} prevalence in {region}',
  
  // Treatments & Medications
  'new treatments for {category}',
  '{category} medication updates',
  'alternative therapies for {category}',
  '{category} prevention methods',
  
  // Technology & Innovation
  'AI in {category}',
  'technology for {category}',
  'digital health {category}',
  'wearable devices for {category}',
  
  // Public Health
  '{category} awareness campaign',
  '{category} public health crisis',
  'government action on {category}',
  '{category} healthcare access',
  
  // Lifestyle & Prevention
  'lifestyle changes for {category}',
  'diet and {category}',
  'exercise for {category}',
  '{category} prevention tips',
  
  // Demographics
  '{category} in children',
  '{category} in elderly',
  '{category} in women',
  '{category} in adolescents',
  
  // Current Events
  '{category} outbreak {timeframe}',
  '{category} vaccine news',
  '{category} guidelines updated',
  'WHO recommendations {category}',
];

/**
 * Generate diverse health queries
 */
export function generateHealthQueries(count: number = 1000): HealthQuery[] {
  const queries: HealthQuery[] = [];
  const categories = Object.keys(CATEGORIES);
  
  let attempts = 0;
  const maxAttempts = count * 3;
  const seenQueries = new Set<string>();
  
  while (queries.length < count && attempts < maxAttempts) {
    attempts++;
    
    // Pick random category
    const categoryKey = categories[Math.floor(Math.random() * categories.length)];
    const categoryName = CATEGORIES[categoryKey as keyof typeof CATEGORIES];
    
    // Pick random template
    const template = QUERY_TEMPLATES[Math.floor(Math.random() * QUERY_TEMPLATES.length)];
    
    // Fill template
    let query = template
      .replace('{category}', categoryName.toLowerCase())
      .replace('{timeframe}', TIMEFRAMES[Math.floor(Math.random() * TIMEFRAMES.length)])
      .replace('{region}', REGIONS[Math.floor(Math.random() * REGIONS.length)]);
    
    // Normalize and deduplicate
    query = query.trim().replace(/\s+/g, ' ');
    
    if (!seenQueries.has(query)) {
      seenQueries.add(query);
      
      queries.push({
        query,
        category: categoryKey,
        region: template.includes('{region}') ? REGIONS[Math.floor(Math.random() * REGIONS.length)] : undefined,
        priority: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
      });
    }
  }
  
  return queries;
}

/**
 * Generate queries for specific category
 */
export function generateCategoryQueries(category: string, count: number = 50): HealthQuery[] {
  const queries: HealthQuery[] = [];
  const categoryName = CATEGORIES[category as keyof typeof CATEGORIES];
  
  if (!categoryName) {
    console.warn(`Unknown category: ${category}`);
    return [];
  }
  
  const seenQueries = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 3;
  
  while (queries.length < count && attempts < maxAttempts) {
    attempts++;
    
    const template = QUERY_TEMPLATES[Math.floor(Math.random() * QUERY_TEMPLATES.length)];
    
    let query = template
      .replace('{category}', categoryName.toLowerCase())
      .replace('{timeframe}', TIMEFRAMES[Math.floor(Math.random() * TIMEFRAMES.length)])
      .replace('{region}', REGIONS[Math.floor(Math.random() * REGIONS.length)]);
    
    query = query.trim().replace(/\s+/g, ' ');
    
    if (!seenQueries.has(query)) {
      seenQueries.add(query);
      queries.push({
        query,
        category,
        region: template.includes('{region}') ? REGIONS[Math.floor(Math.random() * REGIONS.length)] : undefined,
        priority: 'medium',
      });
    }
  }
  
  return queries;
}

/**
 * Generate trending health queries (higher priority)
 */
export function generateTrendingQueries(count: number = 100): HealthQuery[] {
  const trendingTopics = [
    'COVID-19 variants',
    'mental health crisis',
    'obesity epidemic',
    'diabetes prevention',
    'vaccine development',
    'antibiotic resistance',
    'cancer immunotherapy',
    'alzheimer disease research',
    'heart disease prevention',
    'climate change health impact',
    'air pollution health effects',
    'telemedicine adoption',
    'health insurance reforms',
    'pharmaceutical pricing',
    'hospital capacity',
  ];
  
  const queries: HealthQuery[] = [];
  
  for (let i = 0; i < count; i++) {
    const topic = trendingTopics[i % trendingTopics.length];
    const timeframe = TIMEFRAMES[Math.floor(Math.random() * TIMEFRAMES.length)];
    const region = Math.random() > 0.5 ? REGIONS[Math.floor(Math.random() * REGIONS.length)] : undefined;
    
    const queryPatterns = [
      `${topic} ${timeframe}`,
      `latest news on ${topic}`,
      `${topic} updates ${timeframe}`,
      region ? `${topic} in ${region}` : `${topic} global impact`,
    ];
    
    queries.push({
      query: queryPatterns[i % queryPatterns.length],
      category: 'pandemic', // Default, can be refined
      region,
      priority: 'high',
    });
  }
  
  return queries;
}

/**
 * Get balanced set of queries across all categories
 */
export function generateBalancedQueries(totalCount: number = 1000): HealthQuery[] {
  const categories = Object.keys(CATEGORIES);
  const queriesPerCategory = Math.floor(totalCount / categories.length);
  const queries: HealthQuery[] = [];
  
  // Generate queries for each category
  for (const category of categories) {
    queries.push(...generateCategoryQueries(category, queriesPerCategory));
  }
  
  // Add trending queries
  const trendingCount = totalCount - queries.length;
  if (trendingCount > 0) {
    queries.push(...generateTrendingQueries(trendingCount));
  }
  
  // Shuffle to mix priorities and categories
  for (let i = queries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queries[i], queries[j]] = [queries[j], queries[i]];
  }
  
  return queries.slice(0, totalCount);
}
