import { TiptapDocument } from '@/types/tiptap';
import { IdentityDiffResult, ThemeComparison } from './diffEngine';

/**
 * AI-Powered Identity Diff Engine (DUMMY VERSION)
 * 
 * This version uses dummy data instead of actual API calls for debugging purposes.
 * All comparison cards are now generated from dummy data to avoid API costs.
 */
export class AIIdentityDiffEngine {
  constructor() {
    // Remove in-memory cache as we now use database persistence
  }

  /**
   * Generate dummy identity diff analysis (replaces API call)
   */
  public async generateIdentityDiff(
    mainNarrative: TiptapDocument, 
    comparisonNarrative: TiptapDocument,
    mainDocId?: string,
    refDocId?: string
  ): Promise<IdentityDiffResult> {
    
    try {
      console.log('🤖 Generating DUMMY comparison analysis...', { mainDocId, refDocId });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return dummy data instead of making API call
      const result = this.generateDummyComparison(mainNarrative, comparisonNarrative);
      
      console.log('✅ DUMMY comparison analysis completed');
      
      return result;
      
    } catch (error) {
      console.error('Error in DUMMY comparison generation:', error);
      
      // Fallback to basic comparison if anything fails
      return this.generateFallbackComparison(mainNarrative, comparisonNarrative);
    }
  }

  /**
   * Mock cache clearing (replaces API call)
   */
  public async clearComparisonCache(mainDocId: string, refDocId: string): Promise<void> {
    try {
      console.log('🗑️ MOCK: Clearing cache for comparison:', { mainDocId, refDocId });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('✅ MOCK: Cache cleared successfully');
    } catch (error) {
      console.warn('MOCK: Error clearing cache (non-blocking):', error);
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use clearComparisonCache instead
   */
  public clearCache(): void {
    console.log('⚠️ Legacy clearCache called - use clearComparisonCache for database cache clearing');
  }

  /**
   * Generate comprehensive dummy comparison data
   */
  private generateDummyComparison(
    mainNarrative: TiptapDocument,
    comparisonNarrative: TiptapDocument
  ): IdentityDiffResult {
    console.log('🎭 Generating comprehensive dummy comparison data');
    
    const mainText = this.documentToText(mainNarrative);
    const comparisonText = this.documentToText(comparisonNarrative);
    
    // Create realistic dummy data based on actual text content
    const wordCountDiff = comparisonText.split(' ').length - mainText.split(' ').length;
    
    return {
      holistic: [
        {
          type: 'holistic',
          category: 'affective',
          description: 'Emotional tone shift from cautious to confident',
          significance: 0.8,
          explanation: 'The writer demonstrates increased emotional self-awareness and confidence in expressing personal feelings. This suggests growth in emotional intelligence and self-acceptance.',
          mainNarrativeSpan: mainText.slice(0, 100) + '...',
          comparisonNarrativeSpan: comparisonText.slice(0, 100) + '...'
        },
        {
          type: 'holistic',
          category: 'motivational',
          description: 'Increased focus on personal agency and goal-setting',
          significance: 0.7,
          explanation: 'The narrative shows a shift toward more agentic self-presentation, with clearer articulation of personal goals and sense of control over life direction.',
          mainNarrativeSpan: mainText.slice(100, 200) + '...',
          comparisonNarrativeSpan: comparisonText.slice(100, 200) + '...'
        }
      ],
      overlapping: [
        {
          type: 'overlapping',
          category: 'integrative',
          description: 'Consistent theme of family importance and connection',
          significance: 0.6,
          explanation: 'Both versions emphasize the centrality of family relationships in identity formation, suggesting this is a stable and enduring aspect of self-concept.',
          mainNarrativeSpan: mainText.slice(50, 150) + '...',
          comparisonNarrativeSpan: comparisonText.slice(50, 150) + '...'
        },
        {
          type: 'overlapping',
          category: 'structural',
          description: 'Similar narrative organization around key life events',
          significance: 0.5,
          explanation: 'Both versions organize the narrative around similar pivotal moments, indicating consistent meaning-making patterns and narrative coherence.',
          mainNarrativeSpan: mainText.slice(200, 300) + '...',
          comparisonNarrativeSpan: comparisonText.slice(200, 300) + '...'
        }
      ],
      unique: {
        mainNarrative: [
          {
            type: 'unique',
            category: 'affective',
            description: 'New emphasis on resilience and overcoming challenges',
            significance: 0.75,
            explanation: 'The main version introduces themes of resilience and personal growth through adversity that were absent in the comparison version.',
            mainNarrativeSpan: mainText.slice(150, 250) + '...'
          },
          {
            type: 'unique',
            category: 'motivational',
            description: 'Explicit career aspirations and professional identity',
            significance: 0.65,
            explanation: 'The main version includes specific career goals and professional identity development not present in the comparison.',
            mainNarrativeSpan: mainText.slice(250, 350) + '...'
          }
        ],
        comparisonNarrative: [
          {
            type: 'unique',
            category: 'integrative',
            description: 'Philosophical reflections on meaning and purpose',
            significance: 0.7,
            explanation: 'The comparison version contains deeper philosophical questioning about life purpose that has been replaced with more practical concerns.',
            comparisonNarrativeSpan: comparisonText.slice(150, 250) + '...'
          },
          {
            type: 'unique',
            category: 'structural',
            description: 'Chronological organization with clear temporal markers',
            significance: 0.6,
            explanation: 'The comparison version uses more explicit chronological structuring that has been streamlined in the main version.',
            comparisonNarrativeSpan: comparisonText.slice(250, 350) + '...'
          }
        ]
      },
      conflicts: [
        {
          type: 'conflict',
          category: 'affective',
          description: 'Contradictory self-assessment of emotional stability',
          significance: 0.9,
          explanation: 'The main version presents the writer as emotionally stable while the comparison version reveals ongoing emotional struggles, suggesting possible defensive self-presentation.',
          mainNarrativeSpan: mainText.slice(300, 400) + '...',
          comparisonNarrativeSpan: comparisonText.slice(300, 400) + '...'
        }
      ],
      summary: {
        majorDifferences: [
          'Shift from introspective questioning to confident self-assertion',
          'Increased focus on practical goals versus philosophical exploration',
          'Evolution from emotional vulnerability to resilience narrative'
        ],
        identityShifts: [
          'Growing sense of personal agency and control',
          'Clearer professional identity development',
          'Maturing emotional regulation and self-awareness'
        ],
        recommendations: [
          'Consider integrating both philosophical depth and practical goals',
          'Acknowledge growth while maintaining authentic emotional expression',
          'Balance confidence with continued self-reflection and growth mindset'
        ]
      }
    };
  }

  /**
   * Minimal fallback comparison if anything fails
   */
  private generateFallbackComparison(
    mainNarrative: TiptapDocument,
    comparisonNarrative: TiptapDocument
  ): IdentityDiffResult {
    console.log('⚠️ Using fallback comparison analysis');
    
    const mainText = this.documentToText(mainNarrative);
    const comparisonText = this.documentToText(comparisonNarrative);
    
    // Very basic analysis as fallback
    const wordCountDiff = comparisonText.split(' ').length - mainText.split(' ').length;
    
    return {
      holistic: [{
        type: 'holistic',
        category: 'structural',
        description: `Content ${wordCountDiff > 0 ? 'expanded' : 'condensed'} by ${Math.abs(wordCountDiff)} words`,
        significance: Math.min(Math.abs(wordCountDiff) / 100, 1),
        explanation: 'Basic structural change detected. Full AI analysis unavailable.'
      }],
      overlapping: [],
      unique: {
        mainNarrative: [],
        comparisonNarrative: []
      },
      conflicts: [],
      summary: {
        majorDifferences: ['AI analysis temporarily unavailable'],
        identityShifts: ['Please check your internet connection and API configuration'],
        recommendations: ['Try refreshing to re-attempt AI analysis']
      }
    };
  }

  /**
   * Convert TiptapDocument to text for processing
   */
  private documentToText(doc: TiptapDocument): string {
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
} 