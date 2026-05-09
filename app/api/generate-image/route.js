// app/api/chat/route.js — Full Featured
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { message, history } = await request.json();
    console.log('💬 Message received:', message);

    const groqMessages = [
      {
        role: 'system',
        content: `You are NexusAI, a helpful AI assistant. Support English and Urdu naturally.

IMAGE RULES:
1. For REAL PHOTOS (show, dikhao, photo): IMAGE_REQUEST: [search term]
2. For AI-GENERATED art (draw, bana, create, generate): AI_GENERATE: [description]
3. For MULTIPLE images: use multiple lines

Examples:
- "car ki photo dikhao" → IMAGE_REQUEST: car
- "car ki AI image bana" → AI_GENERATE: a red sports car in a city
- "different cars" → IMAGE_REQUEST: red sports car\\nIMAGE_REQUEST: black sedan
- "lion ka drawing banao" → AI_GENERATE: a majestic lion in the savanna
- "sunset paint karo" → AI_GENERATE: beautiful sunset over mountains, digital art

CODE RULES:
- When showing code, always use markdown code blocks with language:
\`\`\`javascript
code here
\`\`\`

For ALL other questions, respond normally with text.`
      },
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Call Groq API with streaming
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
        stream: true,
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('❌ Groq error:', groqResponse.status, errorText);
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = '';

        try {
          const reader = groqResponse.body.getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;

              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content })}\n\n`));
                }
              } catch (e) { /* skip invalid json */ }
            }
          }

          // After stream ends — check for image/AI requests
          if (fullContent.includes('IMAGE_REQUEST:') || fullContent.includes('AI_GENERATE:')) {
            // Remove the IMAGE_REQUEST/AI_GENERATE text from displayed content
            // and send image data separately

            const photoMatches = [...fullContent.matchAll(/IMAGE_REQUEST:\s*(.+)/g)];
            const aiMatches = [...fullContent.matchAll(/AI_GENERATE:\s*(.+)/g)];

            const photoQueries = photoMatches.map(m => m[1].trim()).filter(Boolean);
            const aiPrompts = aiMatches.map(m => m[1].trim()).filter(Boolean);

            if (photoQueries.length > 0) {
              // Fetch real photos from Pexels/Openverse/Pixabay
              const imageResults = [];
              for (const query of photoQueries.slice(0, 4)) {
                const url = await searchImage(query);
                if (url) imageResults.push({ query, url, type: 'photo' });
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'images', images: imageResults })}\n\n`));
            }

            if (aiPrompts.length > 0) {
              // Generate AI images via Pollinations.ai (FREE!)
              const aiResults = aiPrompts.slice(0, 2).map(prompt => ({
                prompt,
                url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=600&height=400&nologo=true&seed=${Date.now()}`,
                type: 'ai'
              }));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'images', images: aiResults })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: 'AI se response nahi aaya.' }, { status: 500 });
  }
}

// ============================================
// Image Search — Pexels + Openverse + Pixabay
// ============================================
async function searchImage(query) {
  const PEXELS_KEY = process.env.PEXELS_API_KEY;
  if (PEXELS_KEY) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=squarish`,
        { headers: { 'Authorization': PEXELS_KEY } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.photos?.length > 0) {
          const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
          return photo.src.large || photo.src.medium;
        }
      }
    } catch (err) { console.log('⚠️ Pexels failed'); }
  }

  try {
    const res = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=3&mature=false`,
      { headers: { 'User-Agent': 'NexusAI-Chat/1.0' } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.results?.length > 0) {
        return data.results[0].url || data.results[0].thumbnail;
      }
    }
  } catch (err) { console.log('⚠️ Openverse failed'); }

  try {
    const res = await fetch(
      `https://pixabay.com/api/?key=46684669-4dbb35f62c02ba02be2c2b5cd&q=${encodeURIComponent(query)}&image_type=photo&per_page=3&safesearch=true`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.hits?.length > 0) return data.hits[0].largeImageURL || data.hits[0].webformatURL;
    }
  } catch (err) { console.log('⚠️ Pixabay failed'); }

  return `https://picsum.photos/seed/${encodeURIComponent(query + Date.now())}/600/400`;
}