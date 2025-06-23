import { NextRequest, NextResponse } from 'next/server';
import { TiptapDocument } from '@/types/tiptap';

export async function POST(request: NextRequest) {
  try {
    const { mainContent, comparisonContent } = await request.json();
    
    const analysis = await analyzeIdentityFacets(mainContent, comparisonContent);
    
    return NextResponse.json({ identityFacets: analysis });
  } catch (error) {
    console.error('Identity analysis error:', error);
    return NextResponse.json({ error: 'Identity analysis failed' }, { status: 500 });
  }
}

async function analyzeIdentityFacets(main: TiptapDocument, comparison: TiptapDocument) {
  const mainText = documentToText(main);
  const comparisonText = documentToText(comparison);
  
  const prompt = `Analyze these two versions of a personal narrative and identify how the writer presents different aspects of their identity. Focus on specific identity facets and provide evidence.

VERSION 1 (Current):
${mainText}

VERSION 2 (Saved Version):
${comparisonText}

Please identify identity differences in this exact JSON format:
[
  {
    "facet": "Self-Confidence",
    "mainVersion": "confident and assertive tone",
    "comparisonVersion": "more questioning and vulnerable",
    "evidence": ["specific quote from text that shows this difference"]
  }
]

Focus on these identity facets: self-confidence, family relationships, professional identity, personal values, emotional expression, future aspirations, social connections.`;

  // For now, return mock data - replace with actual AI API call
  return [
    {
      facet: "Self-Confidence",
      mainVersion: "More confident and assertive",
      comparisonVersion: "More questioning and reflective", 
      evidence: ["Uses more definitive language like 'I know' vs 'I think'"]
    },
    {
      facet: "Family Relationships",
      mainVersion: "Complex, acknowledges conflicts",
      comparisonVersion: "Idealized, focuses on positive aspects",
      evidence: ["Mentions specific disagreements vs general appreciation"]
    }
  ];
}

function documentToText(doc: TiptapDocument): string {
  return doc.content?.map(node => nodeToText(node)).join('\n') || '';
}

function nodeToText(node: any): string {
  if (node.text) return node.text;
  if (node.content) return node.content.map(nodeToText).join(' ');
  return '';
} 