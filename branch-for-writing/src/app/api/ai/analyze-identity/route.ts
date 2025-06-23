import { NextRequest, NextResponse } from 'next/server';
import { TiptapDocument } from '@/types/tiptap';

export async function POST(request: NextRequest) {
  try {
    const { mainContent, comparisonContent } = await request.json();
    
    const analysis = await analyzeIdentityDifferences(mainContent, comparisonContent);
    
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

async function analyzeIdentityDifferences(
  main: TiptapDocument, 
  comparison: TiptapDocument
): Promise<string> {
  const mainText = documentToText(main);
  const comparisonText = documentToText(comparison);
  
  // For now, return a simulated analysis
  // Replace this with actual AI API call (OpenAI, Claude, etc.)
  const changes = getBasicDifferences(mainText, comparisonText);
  
  return `Identity Theme Analysis:

Key Changes Detected:
${changes.length > 0 ? changes.join('\n') : 'No significant identity themes detected in the changes.'}

Recommendations:
- Consider how these changes reflect your evolving self-perception
- Look for patterns in the way you describe yourself
- Notice any shifts in values or priorities expressed`;
}

function getBasicDifferences(text1: string, text2: string): string[] {
  const changes: string[] = [];
  
  // Basic word count comparison
  const words1 = text1.split(/\s+/).length;
  const words2 = text2.split(/\s+/).length;
  
  if (words2 > words1) {
    changes.push(`• Expanded content by ${words2 - words1} words`);
  } else if (words1 > words2) {
    changes.push(`• Reduced content by ${words1 - words2} words`);
  }
  
  // Look for identity-related keywords
  const identityKeywords = ['I am', 'I feel', 'I believe', 'my values', 'identity', 'myself', 'who I am'];
  const foundKeywords = identityKeywords.filter(keyword => 
    text2.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (foundKeywords.length > 0) {
    changes.push(`• Contains identity-related themes: ${foundKeywords.join(', ')}`);
  }
  
  return changes;
}

function documentToText(doc: TiptapDocument): string {
  return doc.content?.map(node => nodeToText(node)).join('\n') || '';
}

function nodeToText(node: any): string {
  if (node.text) return node.text;
  if (node.content) return node.content.map(nodeToText).join(' ');
  return '';
} 