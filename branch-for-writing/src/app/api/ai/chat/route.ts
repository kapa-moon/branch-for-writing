import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message, mainContent, comparisonContent, selectedContext, chatHistory } = await request.json();
    
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
  
  const prompt = `You are an AI assistant helping someone with personal narrative writing and identity exploration.

FULL DOCUMENT CONTEXT:
${mainText}

${comparisonText ? `COMPARISON VERSION:\n${comparisonText}` : ''}

${selectedContext ? `SELECTED CONTEXT:\n"${selectedContext}"` : ''}

CHAT HISTORY:
${chatHistory.map(h => `${h.role}: ${h.content}`).join('\n')}

USER MESSAGE: ${message}

Respond helpfully about their writing, identity themes, or provide guidance. Reference the selected context when relevant.`;

  // Mock response - replace with actual AI API call
  if (selectedContext) {
    return `I can see you're referring to "${selectedContext.substring(0, 50)}...". This part of your writing suggests [analysis based on context]. Regarding your question "${message}", I'd say [helpful response].`;
  } else {
    return `Based on your overall writing, I notice [general observation]. About your question "${message}", I'd suggest [helpful response].`;
  }
}

function documentToText(doc: any): string {
  return doc.content?.map((node: any) => nodeToText(node)).join('\n') || '';
}

function nodeToText(node: any): string {
  if (node.text) return node.text;
  if (node.content) return node.content.map(nodeToText).join(' ');
  return '';
} 