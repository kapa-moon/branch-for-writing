import { NextRequest, NextResponse } from 'next/server';
import { TiptapDocument } from '@/types/tiptap';

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();
    
    const prompts = await generateWritingPrompts(content);
    
    return NextResponse.json({ prompts });
  } catch (error) {
    console.error('Prompt generation error:', error);
    return NextResponse.json({ error: 'Failed to generate prompts' }, { status: 500 });
  }
}

async function generateWritingPrompts(content: TiptapDocument): Promise<string[]> {
  const text = documentToText(content);
  
  // Basic prompt generation based on content analysis
  const prompts = [
    "What experiences shaped the person you describe in this writing?",
    "How have your values changed since you first wrote about this topic?",
    "What would you tell your past self about this situation?",
    "What aspects of your identity feel most authentic in this writing?",
    "How do you think others perceive the person you describe here?"
  ];
  
  // Add content-specific prompts based on keywords
  if (text.toLowerCase().includes('family')) {
    prompts.push("How has your family influenced your sense of identity?");
  }
  
  if (text.toLowerCase().includes('work') || text.toLowerCase().includes('career')) {
    prompts.push("How does your professional identity align with your personal values?");
  }
  
  if (text.toLowerCase().includes('relationship')) {
    prompts.push("How do your relationships reflect who you are becoming?");
  }
  
  return prompts.slice(0, 5); // Return top 5 prompts
}

function documentToText(doc: TiptapDocument): string {
  return doc.content?.map(node => nodeToText(node)).join('\n') || '';
}

function nodeToText(node: any): string {
  if (node.text) return node.text;
  if (node.content) return node.content.map(nodeToText).join(' ');
  return '';
} 