import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { TiptapDocument } from '@/types/tiptap';
import { db } from '@/lib/db';
import { aiChatRecords } from '../../../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { 
      aiCommentId,
      threadId,
      userMessage,
      aiCommentData,
      mainDocumentContent,
      refDocumentContent,
      chatHistory = []
    } = await request.json();
    
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

    console.log('💬 Processing AI comment chat request for user:', session.user.id, { aiCommentId, threadId });

    // Generate AI response
    const aiResponse = await generateAIResponse(
      userMessage,
      aiCommentData,
      mainDocumentContent,
      refDocumentContent,
      chatHistory
    );
    
    // Save chat interaction to database
    const chatRecordId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.insert(aiChatRecords).values({
      id: chatRecordId,
      mainDocId: aiCommentData.mainDocId,
      refDocId: aiCommentData.refDocId,
      aiCommentId: aiCommentId,
      threadId: threadId,
      contextContent: aiCommentData.evidence?.map((e: any) => e.text).join('; ') || '',
      userPrompt: userMessage,
      aiOutput: aiResponse,
      userId: session.user.id,
    });
    
    console.log('💾 Chat interaction saved to database');
    
    return NextResponse.json({
      response: aiResponse,
      chatRecordId: chatRecordId,
      cached: false
    });
  } catch (error: unknown) {
    console.error('❌ AI comment chat error:', error);
    
    let errorMessage = 'Failed to generate AI response';
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

async function generateAIResponse(
  userMessage: string,
  aiCommentData: any,
  mainDocumentContent: TiptapDocument,
  refDocumentContent?: TiptapDocument,
  chatHistory: any[] = []
): Promise<string> {
  
  const mainText = documentToText(mainDocumentContent);
  const refText = refDocumentContent ? documentToText(refDocumentContent) : '';
  
  // Build context for the AI
  const contextMessages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> = [
    {
      role: 'system' as const,
      content: `You're chatting with someone about their writing. Match their tone and style. Use their words, not fancy ones.

THEIR WRITING:
${mainText.substring(0, 2000)}${mainText.length > 2000 ? '...' : ''}

${refText ? `EARLIER VERSION: ${refText.substring(0, 1000)}${refText.length > 1000 ? '...' : ''}` : ''}

WHAT WE'RE DISCUSSING:
"${aiCommentData.insight}"

SPECIFIC PASSAGES:
${aiCommentData.evidence?.map((e: any) => `"${e.text}"`).join('\n') || 'None'}

HOW TO RESPOND:
- Under 50 words
- Short sentences
- Use their writing style and vocabulary
- Quote their exact words when relevant
- Ask about what they actually wrote
- No big concepts or theory
- Sound like a friend, not a coach`
    }
  ];

  // Extract some sample sentences from their writing to match style
  const sentences = mainText.split(/[.!?]+/).filter(s => s.trim().length > 10 && s.trim().length < 100);
  if (sentences.length > 0) {
    const sampleSentences = sentences.slice(0, 3).join('. ');
    contextMessages[0].content += `\n\nTHEIR WRITING STYLE (match this): ${sampleSentences}`;
  }

  // Add chat history
  chatHistory.forEach((message: any) => {
    contextMessages.push({
      role: message.type === 'user' ? 'user' as const : 'assistant' as const,
      content: message.text
    });
  });

  // Add current user message
  contextMessages.push({
    role: 'user' as const,
    content: userMessage
  });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: contextMessages,
      max_tokens: 100, // Limit tokens to ensure responses stay under 50 words
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Ensure response is under 50 words
    const words = content.trim().split(/\s+/);
    if (words.length > 50) {
      return words.slice(0, 50).join(' ') + '...';
    }

    return content.trim();
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

function documentToText(doc: TiptapDocument): string {
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