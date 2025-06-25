import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { comparison, mainText, comparisonText, category } = await request.json();
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const enhancedAnalysis = await generateEnhancedComparison(comparison, mainText, comparisonText, category);
    
    return NextResponse.json({ enhancedAnalysis });
  } catch (error) {
    console.error('Enhanced comparison generation error:', error);
    return NextResponse.json({ error: 'Failed to generate enhanced analysis' }, { status: 500 });
  }
}

async function generateEnhancedComparison(
  comparison: any,
  mainText: string,
  comparisonText: string,
  category: string
): Promise<any> {
  
  const prompt = `You are an expert in narrative identity analysis. Analyze the following comparison between two versions of a personal narrative and provide enhanced insights.

COMPARISON CATEGORY: ${category}
CURRENT ANALYSIS: ${comparison.description}
EXPLANATION: ${comparison.explanation || 'No explanation provided'}

MAIN DOCUMENT EVIDENCE: "${comparison.mainNarrativeSpan || 'No specific evidence provided'}"
COMPARISON DOCUMENT EVIDENCE: "${comparison.comparisonNarrativeSpan || 'No specific evidence provided'}"

FULL CONTEXT:
Main Version: ${mainText.substring(0, 1000)}...
Comparison Version: ${comparisonText.substring(0, 1000)}...

Please provide an enhanced analysis in the following JSON format:
{
  "enhancedDescription": "A more detailed, nuanced description of the identity theme difference",
  "psychologicalInsight": "Deeper psychological interpretation of what this change means for identity development",
  "developmentalSignificance": "Assessment of how significant this change is for personal growth (high/medium/low) and why",
  "actionableInsight": "Specific, actionable suggestion for the writer about how to integrate or address this difference",
  "emotionalPattern": "Description of the emotional pattern or shift this represents",
  "narrativeCoherence": "Assessment of how this difference affects overall narrative coherence"
}

IMPORTANT: Respond with ONLY valid JSON, no markdown formatting or code blocks. Do not wrap your response in \`\`\`json or \`\`\`.

Focus on providing insights that are:
1. Psychologically informed but accessible
2. Specific to the evidence provided
3. Constructive and growth-oriented
4. Relevant to identity development in emerging adults`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert psychologist specializing in narrative identity and emerging adult development. Provide insightful, evidence-based analysis that helps people understand their identity development.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let enhancedAnalysis;
    try {
      // Clean the response by removing markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      enhancedAnalysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw content:', content);
      throw parseError;
    }
    
    // Add confidence score based on the quality of evidence
    const confidenceScore = calculateConfidenceScore(comparison);
    enhancedAnalysis.confidenceScore = confidenceScore;
    
    return enhancedAnalysis;
    
  } catch (parseError) {
    console.error('Error parsing OpenAI response:', parseError);
    // Fallback to a structured response if JSON parsing fails
    return {
      enhancedDescription: comparison.description + " (Enhanced analysis temporarily unavailable)",
      psychologicalInsight: "This difference suggests meaningful identity development that warrants further exploration.",
      developmentalSignificance: "medium",
      actionableInsight: "Consider reflecting on what this change means for your sense of self and future goals.",
      emotionalPattern: "Shows evolving emotional awareness and expression patterns.",
      narrativeCoherence: "Contributes to the overall narrative of personal growth and change.",
      confidenceScore: 0.5
    };
  }
}

function calculateConfidenceScore(comparison: any): number {
  let score = 0.5; // Base score
  
  // Increase confidence if we have specific evidence
  if (comparison.mainNarrativeSpan && comparison.mainNarrativeSpan.length > 20) {
    score += 0.2;
  }
  if (comparison.comparisonNarrativeSpan && comparison.comparisonNarrativeSpan.length > 20) {
    score += 0.2;
  }
  
  // Increase confidence if we have a detailed explanation
  if (comparison.explanation && comparison.explanation.length > 50) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
} 