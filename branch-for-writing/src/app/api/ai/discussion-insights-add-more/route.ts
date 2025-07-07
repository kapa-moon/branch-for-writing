import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { TiptapDocument } from '@/types/tiptap';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { aiDiscussionInsights } from '../../../../../database/schema';
import { eq, and } from 'drizzle-orm';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { mainContent, discussionNotes, refDocContent, existingInsights, mainDocId, refDocId } = await request.json();
    
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

    console.log('📝 Processing AI "Add More" insights request for user:', session.user.id, { mainDocId, refDocId });

    const newInsight = await generateAdditionalInsight(mainContent, discussionNotes, refDocContent, existingInsights);
    
    // Save the new insight to the database if we have document IDs
    if (mainDocId && refDocId) {
      try {
        console.log('💾 Updating database with new insight...');
        
        // Get existing cached insights from database
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
          // Update existing cache with new insight
          const existingResults = cachedResult[0].insightResults;
          let updatedResults;
          
          if (typeof existingResults === 'object' && existingResults !== null && 'insights' in existingResults) {
            // Add new insight to existing insights array
            updatedResults = {
              ...existingResults,
              insights: [...(existingResults.insights as any[]), newInsight]
            };
          } else {
            // Create new structure if existing results are malformed
            updatedResults = {
              insights: [newInsight]
            };
          }

          await db
            .update(aiDiscussionInsights)
            .set({
              insightResults: updatedResults,
              updatedAt: new Date()
            })
            .where(eq(aiDiscussionInsights.id, cachedResult[0].id));
          
          console.log('✅ Database updated with new insight');
        } else {
          // Create new cache entry if none exists
          const cacheId = `ai_insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          await db.insert(aiDiscussionInsights).values({
            id: cacheId,
            mainDocId,
            refDocId,
            insightResults: { insights: [newInsight] },
            userId: session.user.id,
          });
          
          console.log('✅ New cache entry created with insight');
        }
      } catch (dbError) {
        console.error('❌ Database error while saving new insight:', dbError);
        // Continue without caching if database fails
      }
    }
    
    return NextResponse.json({
      insight: newInsight,
      cached: false
    });
  } catch (error: unknown) {
    console.error('❌ AI add more insights generation error:', error);
    
    let errorMessage = 'Failed to generate additional AI insight';
    let statusCode = 500;
    
    if (error instanceof SyntaxError) {
      errorMessage = 'Invalid request format';
      statusCode = 400;
    } else if (error instanceof Error && error.message.includes('OpenAI')) {
      errorMessage = 'AI service temporarily unavailable';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    }, { status: statusCode });
  }
}

async function generateAdditionalInsight(mainContent: TiptapDocument, discussionNotes: string, refDocContent?: TiptapDocument, existingInsights: any[] = []) {
  const mainText = documentToText(mainContent);
  const refText = refDocContent ? documentToText(refDocContent) : '';
  
  // Create a summary of existing insights to avoid duplication
  const existingInsightsSummary = existingInsights.map(insight => `- ${insight.insight}`).join('\n');
  
  const prompt = `You are a personal narrative writing assistant specializing in identity exploration. Your task is to provide ONE additional insight that complements the existing analysis.

MAIN DOCUMENT (Current Writing):
${mainText}

${refText ? `REFERENCE VERSION (Previous Writing):
${refText}

` : ''}DISCUSSION NOTES (From conversation with supporter):
${discussionNotes}

EXISTING INSIGHTS (do NOT duplicate these themes):
${existingInsightsSummary}

Your task is to find a NEW, DIFFERENT angle that hasn't been covered yet. Look for:
- A different aspect of the discussion notes not yet addressed
- A subtle pattern or theme that was missed
- A unique connection between supporter feedback and identity development
- A different type of relationship (overlapping/conflicting/unique) than already covered

Generate exactly 1 NEW insight in this EXACT JSON format:
{
  "insight": {
    "id": "insight-new",
    "type": "overlapping|conflicting|unique",
    "insight": "Brief NEW insight about how discussion notes relate to main document (1-2 sentences)",
    "socraticPrompt": "Thought-provoking question to help integrate this NEW perspective",
    "evidence": [
      {
        "id": "ev-new-1",
        "text": "Specific quote from main document that relates to this NEW insight",
        "type": "main_document"
      }
    ],
    "discussionReference": "Brief reference to relevant part of discussion notes not covered before"
  }
}

Guidelines:
- Find a completely DIFFERENT theme or angle than existing insights
- Focus on identity development and personal growth
- Include 2-4 evidence quotes from the main document
- Make the socratic prompt specific and actionable
- Ensure this adds value beyond what's already been identified`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert in narrative identity theory. Your goal is to find NEW angles and perspectives that complement existing analysis. Focus on:
- Different aspects of affective themes (emotional patterns)
- Unexplored motivational themes (agency, communion)
- Deeper integrative meaning (identity connections)
- Structural elements not yet addressed

Always provide a FRESH perspective that adds genuine value to the existing insights.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.8, // Higher temperature for more creative/diverse insights
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let parsedResponse;
    try {
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
    const newInsight = {
      id: `ai-discussion-${Date.now()}`,
      type: parsedResponse.insight.type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
      insight: parsedResponse.insight.insight,
      socraticPrompt: parsedResponse.insight.socraticPrompt,
      evidence: parsedResponse.insight.evidence.map((ev: any) => ({
        id: ev.id,
        text: ev.text,
        position: findTextPosition(mainText, ev.text)
      })),
      discussionReference: parsedResponse.insight.discussionReference,
      isResolved: false,
      userReflections: [],
      chatThreads: []
    };
    
    return newInsight;
    
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