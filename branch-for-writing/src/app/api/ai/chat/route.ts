import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message, mainContent, comparisonContent, selectedContext, chatHistory } = await request.json();
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }
    
    const response = await generateContextualResponse(message, mainContent, comparisonContent, selectedContext, chatHistory);
    
    return NextResponse.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}

async function generateContextualResponse(
  message: string, 
  mainContent: any, 
  comparisonContent: any, 
  selectedContext: string,
  chatHistory: any[]
) {
  const mainText = documentToText(mainContent);
  const comparisonText = comparisonContent ? documentToText(comparisonContent) : '';
  
  const contextSection = selectedContext ? `SELECTED CONTEXT:\n"${selectedContext}"\n\n` : '';
  
  const historySection = chatHistory.length > 0 
    ? `CHAT HISTORY:\n${chatHistory.slice(-5).map(h => `${h.role}: ${h.content}`).join('\n')}\n\n`
    : '';

  const prompt = `You are an AI assistant helping someone with personal narrative writing and identity exploration. You're an expert in narrative identity theory, emerging adult development, and helping people understand their identity themes.

FULL DOCUMENT CONTEXT:
${mainText}

${comparisonText ? `COMPARISON VERSION:\n${comparisonText}\n\n` : ''}

${contextSection}${historySection}USER MESSAGE: ${message}

Respond helpfully about their writing, identity themes, or provide guidance. Reference the selected context when relevant. Keep responses conversational, insightful, and focused on identity development. Be supportive and constructive.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in narrative identity and emerging adult development. Help users understand their identity themes, narrative patterns, and personal growth through their writing. Be supportive, insightful, and conversational.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || 'I apologize, but I encountered an issue generating a response. Please try again.';
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    // Fallback response
    if (selectedContext) {
      return `I can see you're referring to "${selectedContext.substring(0, 50)}...". This part of your writing suggests meaningful identity development. Regarding your question "${message}", I'd encourage you to reflect on how this connects to your broader sense of self and personal growth.`;
    } else {
      return `Thank you for your question about "${message}". Based on your writing, I notice patterns of identity development and self-reflection. Would you like me to help you explore specific themes or patterns in your narrative?`;
    }
  }
}

function documentToText(doc: any): string {
  return doc.content?.map((node: any) => nodeToText(node)).join('\n') || '';
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