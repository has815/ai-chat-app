// app/api/ai-image/route.js — Image Proxy (CORS fix)
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get('prompt');
    const seed = searchParams.get('seed') || Math.floor(Math.random() * 999999);

    if (!prompt) {
      return new NextResponse('Missing prompt', { status: 400 });
    }

    // Fetch image from Pollinations server-side (no CORS!)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${seed}`;

    console.log('🔄 Proxying image:', imageUrl);

    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'NexusAI-Chat/1.0',
        'Accept': 'image/*',
      },
    });

    if (!imageResponse.ok) {
      throw new Error(`Pollinations error: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Return image with CORS-friendly headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': imageResponse.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('❌ Image proxy error:', error);
    return new NextResponse('Image fetch failed', { status: 500 });
  }
}