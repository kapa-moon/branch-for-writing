import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { TiptapDocument } from '@/types/tiptap';
import { ThemeComparison } from '@/lib/diffEngine';
import { db } from '@/lib/db';
import { aiComparisonResults } from '../../../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { mainContent, comparisonContent, mainDocId, refDocId } = await request.json();
    
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

    console.log('📝 Processing AI comparison request for user:', session.user.id, { mainDocId, refDocId });

    // Check if we have cached results for this comparison
    if (mainDocId && refDocId) {
      console.log('🔍 Checking for cached AI comparison results...', { mainDocId, refDocId });
      
      try {
        const cachedResult = await db
          .select()
          .from(aiComparisonResults)
          .where(and(
            eq(aiComparisonResults.mainDocId, mainDocId),
            eq(aiComparisonResults.refDocId, refDocId),
            eq(aiComparisonResults.userId, session.user.id)
          ))
          .limit(1);

        if (cachedResult.length > 0) {
          console.log('✅ Found cached AI comparison results, returning cached data');
          const results = cachedResult[0].comparisonResults;
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

    console.log('🤖 No cached results found, generating new AI comparison...');
    const comparisonResult = await generateAIComparisons(mainContent, comparisonContent);
    
    // Save results to cache if we have document IDs
    if (mainDocId && refDocId) {
      try {
        const cacheId = `ai_comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await db.insert(aiComparisonResults).values({
          id: cacheId,
          mainDocId,
          refDocId,
          comparisonResults: comparisonResult,
          userId: session.user.id,
        });
        
        console.log('💾 AI comparison results saved to cache');
      } catch (cacheError) {
        console.error('❌ Error saving to cache (non-blocking):', cacheError);
        // Don't fail the request if caching fails
      }
    }
    
    return NextResponse.json({
      ...comparisonResult,
      cached: false
    });
  } catch (error: unknown) {
    console.error('❌ AI comparison generation error:', error);
    
    // Provide more specific error information
    let errorMessage = 'Failed to generate AI comparisons';
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

async function generateAIComparisons(
  mainContent: TiptapDocument,
  comparisonContent: TiptapDocument
): Promise<{
  holistic: ThemeComparison[];
  overlapping: ThemeComparison[];
  unique: {
    mainNarrative: ThemeComparison[];
    comparisonNarrative: ThemeComparison[];
  };
  conflicts: ThemeComparison[];
  summary: {
    majorDifferences: string[];
    identityShifts: string[];
    recommendations: string[];
  };
}> {
  
  const mainText = documentToText(mainContent);
  const comparisonText = documentToText(comparisonContent);

  const prompt = `You are an expert psychologist specializing in narrative identity analysis. Compare these two versions of a personal narrative and generate detailed identity theme comparisons.

MAIN VERSION: 
${mainText}

COMPARISON VERSION:
${comparisonText}

Analyze differences across four psychological dimensions:
1. AFFECTIVE (emotional patterns, tone, affect regulation)
2. MOTIVATIONAL (agency vs communion, goals, drives)  
3. INTEGRATIVE (meaning-making, coherence, reflection)
4. STRUCTURAL (narrative organization, temporal clarity)

Generate comparison cards in these categories:
- HOLISTIC: Overall pattern changes across the narrative
- OVERLAPPING: Shared themes that appear in both versions
- UNIQUE: Themes that appear in only one version
- CONFLICTS: Contradictory representations between versions

For each comparison card, extract specific text spans as evidence from the narratives.

IMPORTANT: Respond with ONLY valid JSON, no markdown formatting. Use this exact structure:

{
  "holistic": [
    {
      "type": "holistic",
      "category": "affective|motivational|integrative|structural",
      "description": "Clear description of the overall change pattern",
      "significance": 0.8,
      "explanation": "Detailed psychological interpretation",
      "mainNarrativeSpan": "specific quote from main version",
      "comparisonNarrativeSpan": "specific quote from comparison version"
    }
  ],
  "overlapping": [
    {
      "type": "overlapping", 
      "category": "affective|motivational|integrative|structural",
      "description": "Description of shared theme",
      "significance": 0.6,
      "explanation": "Why this theme persists across versions",
      "mainNarrativeSpan": "evidence from main",
      "comparisonNarrativeSpan": "evidence from comparison"
    }
  ],
  "unique": {
    "mainNarrative": [
      {
        "type": "unique",
        "category": "affective|motivational|integrative|structural", 
        "description": "Theme only in main version",
        "significance": 0.7,
        "explanation": "What this unique element represents",
        "mainNarrativeSpan": "specific evidence"
      }
    ],
    "comparisonNarrative": [
      {
        "type": "unique",
        "category": "affective|motivational|integrative|structural",
        "description": "Theme only in comparison version", 
        "significance": 0.7,
        "explanation": "Significance of this new element",
        "comparisonNarrativeSpan": "specific evidence"
      }
    ]
  },
  "conflicts": [
    {
      "type": "conflict",
      "category": "affective|motivational|integrative|structural",
      "description": "Description of contradictory representations",
      "significance": 0.9,
      "explanation": "Analysis of identity conflict and implications",
      "mainNarrativeSpan": "conflicting evidence from main",
      "comparisonNarrativeSpan": "conflicting evidence from comparison"
    }
  ],
  "summary": {
    "majorDifferences": ["bullet point 1", "bullet point 2", "bullet point 3"],
    "identityShifts": ["shift 1", "shift 2", "shift 3"],
    "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
  }
}

Focus on:
- Psychological depth and insight
- Specific textual evidence
- Identity development patterns
- Constructive analysis for personal growth
- Accurate categorization across the four dimensions`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert psychologist specializing in narrative identity analysis and emerging adult development. Generate thorough, evidence-based comparisons that help people understand their identity development patterns.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.3, // Lower temperature for more consistent analysis
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    // Parse the JSON response
    let comparisonResult;
    try {
      // Clean the response by removing markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      comparisonResult = JSON.parse(cleanContent);
    } catch (parseError: unknown) {
      console.error('❌ Failed to parse OpenAI response as JSON:', parseError);
      console.error('Raw OpenAI content:', content);
      throw new Error(`OpenAI response parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    
    return comparisonResult;
    
  } catch (error: unknown) {
    console.error('❌ Error generating AI comparisons:', error);
    
    // Handle different types of OpenAI errors
    if (error && typeof error === 'object' && 'code' in error) {
      const apiError = error as { code: string; message?: string };
      if (apiError.code === 'insufficient_quota') {
        throw new Error('OpenAI quota exceeded. Please check your API billing.');
      } else if (apiError.code === 'invalid_api_key') {
        throw new Error('Invalid OpenAI API key configuration.');
      } else if (apiError.code === 'model_not_found') {
        throw new Error('OpenAI model not available.');
      }
    }
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('OpenAI request timed out. Please try again.');
      } else if (error.message.includes('rate limit')) {
        throw new Error('OpenAI rate limit exceeded. Please wait and try again.');
      }
    }
    
    // Fallback to a minimal structure if AI fails
    return {
      holistic: [],
      overlapping: [],
      unique: {
        mainNarrative: [],
        comparisonNarrative: []
      },
      conflicts: [],
      summary: {
        majorDifferences: ['Analysis temporarily unavailable'],
        identityShifts: ['AI service error occurred'],
        recommendations: ['Please try refreshing or check system status']
      }
    };
  }
}

function documentToText(doc: TiptapDocument): string {
  const extractFromNodes = (nodes: any[]): string => {
    return nodes.map(node => {
      if (node.type === 'text') {
        return node.text || '';
      } else if (node.content) {
        return extractFromNodes(node.content);
      }
      return '';
    }).join(' ');
  };

  return extractFromNodes(doc.content || []);
} 