// app/api/chat/route.js — Complete Fixed
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { message, history } = await request.json();
    console.log('💬 Message received:', message);

    const groqMessages = [
      {
        role: 'system',
        content: `You are NexusAI, a helpful AI assistant. Support English and Urdu.

IMAGE RULES:
1. For REAL PHOTOS: IMAGE_REQUEST: [search term]
2. For AI ART/DRAWING: AI_GENERATE: [description in English]
3. Multiple images: use multiple lines

Examples:
- "car ki photo" → IMAGE_REQUEST: car
- "lion ka drawing" → AI_GENERATE: a majestic lion, digital art
- "AI se mountain banao" → AI_GENERATE: mountain landscape, oil painting style
- "different cars" → IMAGE_REQUEST: red sports car\\nIMAGE_REQUEST: black sedan

CODE: Use \`\`\`language code blocks.

For normal questions, respond normally.`
      },
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        max_tokens: 1024,
        temperature: 0.7,
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq error: ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    const aiReply = groqData.choices?.[0]?.message?.content || '';
    console.log('🤖 AI reply:', aiReply);

    // Extract image requests
    const photoMatches = [...aiReply.matchAll(/IMAGE_REQUEST:\s*(.+)/g)];
    const aiMatches = [...aiReply.matchAll(/AI_GENERATE:\s*(.+)/g)];
    const photoQueries = photoMatches.map(m => m[1].trim()).filter(Boolean);
    const aiPrompts = aiMatches.map(m => m[1].trim()).filter(Boolean);

    // Clean text
    let cleanText = aiReply
      .replace(/IMAGE_REQUEST:\s*.+/g, '')
      .replace(/AI_GENERATE:\s*.+/g, '')
      .trim();

    const imageResults = [];

    // Real photos
    if (photoQueries.length > 0) {
      console.log('📸 Photo requests:', photoQueries);
      for (const query of photoQueries.slice(0, 4)) {
        const url = await searchImage(query);
        if (url) imageResults.push({ query, url, type: 'photo' });
      }
    }

    // AI Generated images — Pollinations.ai (FREE)
    if (aiPrompts.length > 0) {
      console.log('🎨 AI generate requests:', aiPrompts);
      for (const prompt of aiPrompts.slice(0, 2)) {
        const seed = Math.floor(Math.random() * 999999);
        // Use OUR proxy instead of direct Pollinations URL (CORS fix!)
        const url = `/api/ai-image?prompt=${encodeURIComponent(prompt)}&seed=${seed}`;
        imageResults.push({ query: prompt, url, type: 'ai' });
        console.log('🎨 AI proxy URL:', url);
      }
    }

    // Build final response with images
    if (imageResults.length > 0) {
      const imageMarkdown = imageResults.map(img => {
        const label = img.type === 'ai' ? `AI: ${img.query}` : img.query;
        return `![${label}](${img.url})`;
      }).join('\n\n');

      cleanText = cleanText ? `${cleanText}\n\n${imageMarkdown}` : imageMarkdown;
    }

    if (!cleanText) {
      cleanText = "I couldn't process that. Please try again!";
    }

    console.log('📤 Response preview:', cleanText.substring(0, 200));

    return NextResponse.json({
      response: cleanText,
      imageRequest: false
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: 'AI se response nahi aaya.' }, { status: 500 });
  }
}

// Image Search — Pexels + Openverse + Pixabay
async function searchImage(query) {
  const PEXELS_KEY = process.env.PEXELS_API_KEY;
  if (PEXELS_KEY) {
    try {
      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=squarish`, { headers: { 'Authorization': PEXELS_KEY } });
      if (res.ok) {
        const data = await res.json();
        if (data.photos?.length > 0) {
          const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
          return photo.src.large || photo.src.medium;
        }
      }
    } catch { }
  }

  try {
    const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=3&mature=false`, { headers: { 'User-Agent': 'NexusAI-Chat/1.0' } });
    if (res.ok) {
      const data = await res.json();
      if (data.results?.length > 0) return data.results[0].url || data.results[0].thumbnail;
    }
  } catch { }

  try {
    const res = await fetch(`https://pixabay.com/api/?key=46684669-4dbb35f62c02ba02be2c2b5cd&q=${encodeURIComponent(query)}&image_type=photo&per_page=3&safesearch=true`);
    if (res.ok) {
      const data = await res.json();
      if (data.hits?.length > 0) return data.hits[0].largeImageURL || data.hits[0].webformatURL;
    }
  } catch { }

  return `https://picsum.photos/seed/${encodeURIComponent(query + Date.now())}/600/400`;
}