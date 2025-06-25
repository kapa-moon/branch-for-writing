import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { mainText, comparisonText, comparisonCards } = await request.json();
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const holisticSummary = await generateHolisticSummary(mainText, comparisonText, comparisonCards);
    
    return NextResponse.json({ holisticSummary });
  } catch (error) {
    console.error('Holistic summary generation error:', error);
    return NextResponse.json({ error: 'Failed to generate holistic summary' }, { status: 500 });
  }
}

async function generateHolisticSummary(
  mainText: string,
  comparisonText: string,
  comparisonCards: any[]
): Promise<string[]> {
  
  const cardSummaries = comparisonCards.map(card => 
    `- ${card.category} (${card.type}): ${card.description}`
  ).join('\n');

  const prompt = `You are an expert in narrative identity analysis. Analyze the overall patterns and themes across these two versions of a personal narrative and provide a holistic summary.

MAIN VERSION: ${mainText.substring(0, 1500)}...

COMPARISON VERSION: ${comparisonText.substring(0, 1500)}...

SPECIFIC THEME DIFFERENCES DETECTED:
${cardSummaries}

Based on this comprehensive analysis, provide 3-4 key insights about the overall identity development patterns shown in these narrative changes. Each insight should be:

1. A complete, standalone observation (2-3 sentences)
2. Psychologically informed but accessible
3. Focused on identity development and personal growth
4. Specific to the evidence provided
5. Constructive and growth-oriented

IMPORTANT: Respond with ONLY a valid JSON array of strings, no markdown formatting or code blocks. Format your response exactly like this:
["First key insight about identity development...", "Second insight about narrative changes...", "Third insight about psychological growth..."]

Focus on patterns like:
- Shifts in self-concept and identity themes
- Changes in emotional regulation and expression
- Evolution in meaning-making and narrative coherence
- Development of agency, communion, and personal values
- Integration of past experiences into current identity`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert psychologist specializing in narrative identity and emerging adult development. Provide insightful, holistic analysis that helps people understand their overall identity development patterns.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let insights;
    try {
      // Clean the response by removing markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      insights = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw content:', content);
      throw parseError;
    }
    
    // Ensure we have an array of strings
    if (Array.isArray(insights) && insights.length > 0) {
      return insights;
    } else {
      throw new Error('Invalid response format');
    }
    
  } catch (parseError) {
    console.error('Error parsing OpenAI response:', parseError);
    // Fallback to default insights if parsing fails
    return [
      "Your narrative shows meaningful identity development patterns that suggest growing self-awareness and emotional maturity. The changes between versions indicate you're actively working on understanding and articulating your sense of self.",
      
      "There are emerging patterns in how you process and integrate life experiences, showing evolution in your meaning-making abilities. This suggests you're developing stronger narrative coherence and better integration of past events into your current identity.",
      
      "The comparison reveals shifts in how you present yourself and relate to others, indicating development in both personal agency and social connections. These changes suggest healthy psychological growth and increased authenticity in self-expression."
    ];
  }
} 