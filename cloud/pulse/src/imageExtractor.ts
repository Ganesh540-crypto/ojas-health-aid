/**
 * Image Extraction from Source URLs
 * Extracts Open Graph images from web pages
 */

import axios from 'axios';

export async function extractImageFromURL(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = response.data;
    
    // Try Open Graph image (priority 1)
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      return ogImageMatch[1];
    }
    
    // Try Twitter Card image (priority 2)
    const twitterImageMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
    if (twitterImageMatch && twitterImageMatch[1]) {
      return twitterImageMatch[1];
    }
    
    // Try schema.org image (priority 3)
    const schemaImageMatch = html.match(/<meta\s+itemprop=["']image["']\s+content=["']([^"']+)["']/i);
    if (schemaImageMatch && schemaImageMatch[1]) {
      return schemaImageMatch[1];
    }
    
    // Try article:image meta tag (priority 4)
    const articleImageMatch = html.match(/<meta\s+property=["']article:image["']\s+content=["']([^"']+)["']/i);
    if (articleImageMatch && articleImageMatch[1]) {
      return articleImageMatch[1];
    }
    
    // Try to find first large image in article/content area (priority 5)
    const articleImgMatch = html.match(/<article[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (articleImgMatch && articleImgMatch[1]) {
      return articleImgMatch[1];
    }
    
    // Fallback: Find any img tag with minimum size hints (priority 6)
    const anyImgMatch = html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["'][^>]*>/i);
    if (anyImgMatch && anyImgMatch[1]) {
      return anyImgMatch[1];
    }
    
    return null;
  } catch (error) {
    // Silent fail for individual URLs
    return null;
  }
}

export async function findFirstImageFromSources(urls: string[]): Promise<string | null> {
  console.log(`[imageExtractor] Searching for images in ${urls.length} sources...`);
  
  // Try ALL URLs in parallel for maximum coverage
  const imagePromises = urls.map(url => extractImageFromURL(url));
  const results = await Promise.allSettled(imagePromises);
  
  // Return first successful image
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      console.log(`[imageExtractor] ✓ Found image from source ${i + 1}/${urls.length}: ${result.value.substring(0, 80)}...`);
      return result.value;
    }
  }
  
  console.log(`[imageExtractor] ✗ No images found after checking all ${urls.length} sources`);
  return null;
}
