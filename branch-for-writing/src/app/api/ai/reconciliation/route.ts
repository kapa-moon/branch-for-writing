import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { identityDifferences, mainContent, comparisonContent } = await request.json();
    
    const suggestions = await generateReconciliationSuggestions(identityDifferences);
    
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Reconciliation analysis error:', error);
    return NextResponse.json({ error: 'Reconciliation analysis failed' }, { status: 500 });
  }
}

async function generateReconciliationSuggestions(identityDifferences: any[]) {
  const prompt = `Based on these identity differences across versions, provide reconciliation suggestions:

${JSON.stringify(identityDifferences, null, 2)}

Provide suggestions in three categories:
1. Addition (Revealing): Ways to reveal more authentic aspects
2. Filtering (Comfortable Sharing): Ways to maintain appropriate boundaries  
3. Awareness (Multiple Facets): Ways to understand identity complexity

Return in this JSON format:
[
  {
    "type": "addition",
    "suggestion": "specific actionable suggestion",
    "reasoning": "why this would help"
  }
]`;

  // Mock data - replace with actual AI API call
  return [
    {
      type: "addition",
      suggestion: "Consider sharing your vulnerable moments in the peer version to deepen authentic connections",
      reasoning: "Your confident tone in the current version may prevent others from relating to your struggles"
    },
    {
      type: "filtering", 
      suggestion: "Your family version appropriately emphasizes growth while protecting private details",
      reasoning: "This maintains family harmony while showing personal development"
    },
    {
      type: "awareness",
      suggestion: "These different presentations show healthy identity complexity - you adapt appropriately to different relationships",
      reasoning: "This flexibility in self-presentation is a strength, not inconsistency"
    }
  ];
} 