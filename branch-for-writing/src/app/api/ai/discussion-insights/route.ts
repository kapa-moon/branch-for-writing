import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { TiptapDocument } from '@/types/tiptap';
import { db } from '@/lib/db';
import { aiDiscussionInsights } from '../../../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { mainContent, discussionNotes, refDocContent, mainDocId, refDocId } = await request.json();
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('🔑 OpenAI API key not configured');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Get user session for authentication
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    if (!session?.user) {
      console.error('🚫 Unauthorized request - no user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📝 Processing AI discussion insights request for user:', session.user.id, { mainDocId, refDocId });

    // Check if we have cached results for this discussion
    if (mainDocId && refDocId) {
      console.log('🔍 Checking for cached AI discussion insights...', { mainDocId, refDocId });
      
      try {
        const cachedResult = await db
          .select()
          .from(aiDiscussionInsights)
          .where(and(
            eq(aiDiscussionInsights.mainDocId, mainDocId),
            eq(aiDiscussionInsights.refDocId, refDocId),
            eq(aiDiscussionInsights.userId, session.user.id)
          ))
          .limit(1);

        if (cachedResult.length > 0) {
          console.log('✅ Found cached AI discussion insights, returning cached data');
          const results = cachedResult[0].insightResults;
          return NextResponse.json({
            ...(typeof results === 'object' && results !== null ? results : {}),
            cached: true,
            cachedAt: cachedResult[0].createdAt
          });
        }
      } catch (dbError) {
        console.error('❌ Database error while checking cache:', dbError);
        // Continue without cache if database fails
      }
    }

    console.log('🤖 No cached results found, generating new AI discussion insights...');
    const insightResults = await generateDiscussionInsights(mainContent, discussionNotes, refDocContent);
    
    // Save results to cache if we have document IDs
    if (mainDocId && refDocId) {
      try {
        const cacheId = `ai_insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await db.insert(aiDiscussionInsights).values({
          id: cacheId,
          mainDocId,
          refDocId,
          insightResults: insightResults,
          userId: session.user.id,
        });
        
        console.log('💾 AI discussion insights saved to cache');
      } catch (cacheError) {
        console.error('❌ Error saving to cache (non-blocking):', cacheError);
        // Don't fail the request if caching fails
      }
    }
    
    return NextResponse.json({
      ...insightResults,
      cached: false
    });
  } catch (error: unknown) {
    console.error('❌ AI discussion insights generation error:', error);
    
    // Provide more specific error information
    let errorMessage = 'Failed to generate AI discussion insights';
    let statusCode = 500;
    
    if (error instanceof SyntaxError) {
      errorMessage = 'Invalid request format';
      statusCode = 400;
    } else if (error instanceof Error && error.message.includes('OpenAI')) {
      errorMessage = 'AI service temporarily unavailable';
    } else if (error instanceof Error && (error.message.includes('database') || error.message.includes('db'))) {
      errorMessage = 'Database connection error';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    }, { status: statusCode });
  }
}

async function generateDiscussionInsights(mainContent: TiptapDocument, discussionNotes: string, refDocContent?: TiptapDocument) {
  const mainText = documentToText(mainContent);
  const refText = refDocContent ? documentToText(refDocContent) : '';
  
  const prompt = `You are a personal narrative writing assistant specializing in identity exploration. Your task is to help the writer integrate their supporter's perspective from discussion notes into their main document.

MAIN DOCUMENT (Current Writing):
${mainText}

${refText ? `REFERENCE VERSION (Previous Writing):
${refText}

` : ''}DISCUSSION NOTES (From conversation with supporter):
${discussionNotes}

Your task is to analyze the discussion notes and provide insights to help the writer consider how to integrate the supporter's perspective into their main document.

For each insight, identify whether the discussion notes:
- OVERLAP: Resonate with or confirm existing themes in the main document
- CONFLICT: Present opposing viewpoints or challenge existing perspectives
- UNIQUE: Bring something new that doesn't exist in the main document

 Generate exactly 5 insights in this EXACT JSON format:
{
  "insights": [
    {
      "id": "insight-1",
      "type": "overlapping|conflicting|unique",
      "insight": "Brief insight about how discussion notes relate to main document (1-2 sentences)",
      "socraticPrompt": "Thought-provoking question to help integrate the supporter's perspective",
      "evidence": [
        {
          "id": "ev-1",
          "text": "Specific quote from main document that relates to this insight",
          "type": "main_document"
        }
      ],
      "discussionReference": "Brief reference to relevant part of discussion notes"
    }
  ]
}

Guidelines:
- Focus on meaningful identity themes and personal growth
- Help the writer see connections between supporter feedback and their narrative
- Explore with the writer to thoroughly understand different aspects of thier experience and insights according to their writing, in relation to the discussion notes, and how they can move me towards practical action and clarity.
- Suggest specific parts of the main document that could benefit from the supporter's perspective
- Look for interesting, under-explored possibilities and signs.
- Keep insights close to the actual content, avoid generic advice
- Include up to 4 evidence quotes per insight from the main document
- Make socratic prompts specific and actionable and under 12 words`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert in narrative identity theory and personal development. You help writers integrate feedback from supporters into their personal narratives. Focus on:
- Affective themes (emotional patterns, redemption/contamination)
- Motivational themes (agency, communion, goals)
- Integrative meaning (how experiences connect to identity)
- Structural elements (narrative coherence, temporal flow)

Importantly, look for interesting, under-explored possibilities and signs, which, when realized fully and integrated, will largely enrich the writer's self-understanding and life.
Always provide specific, actionable insights that help writers see connections between supporter feedback and their identity development.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let parsedResponse;
    try {
      // Clean the response by removing markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      parsedResponse = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw content:', content);
      throw parseError;
    }
    
    // Transform the response to match our AIComment interface
    const aiComments = parsedResponse.insights.map((insight: any, index: number) => ({
      id: `ai-discussion-${index}`,
      type: insight.type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
      insight: insight.insight,
      socraticPrompt: insight.socraticPrompt,
      evidence: insight.evidence.map((ev: any) => ({
        id: ev.id,
        text: ev.text,
        position: findTextPosition(mainText, ev.text)
      })),
      discussionReference: insight.discussionReference,
      isResolved: false,
      userReflections: [],
      chatThreads: []
    }));
    
    return { insights: aiComments };
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

// Helper function to convert TiptapDocument to text
function documentToText(doc: TiptapDocument): string {
  if (!doc.content) return '';
  
  return doc.content.map(node => nodeToText(node)).join('\n');
}

function nodeToText(node: any): string {
  if (node.type === 'text') {
    return node.text || '';
  }
  if (node.content) {
    return node.content.map((child: any) => nodeToText(child)).join(' ');
  }
  return '';
}

// Helper function to find text position in document
function findTextPosition(fullText: string, searchText: string): { from: number; to: number } {
  const index = fullText.toLowerCase().indexOf(searchText.toLowerCase());
  if (index === -1) {
    return { from: 0, to: 0 };
  }
  return { from: index, to: index + searchText.length };
} 