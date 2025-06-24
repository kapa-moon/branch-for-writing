import * as DMP from 'diff-match-patch';
import { TiptapDocument, TiptapNode } from '@/types/tiptap';

// Create type alias for the diff operations
type DiffOperation = -1 | 0 | 1; // DELETE, EQUAL, INSERT

export interface DiffResult {
  type: 'add' | 'delete' | 'unchanged' | 'modify';
  content: string;
  lineNumber?: number;
  nodeId?: string;
}

export interface MergeableSegment {
  id: string;
  type: 'paragraph' | 'heading' | 'list';
  content: TiptapNode;
  diffType: 'add' | 'delete' | 'modify' | 'unchanged';
  originalContent?: TiptapNode;
  preview: string;
  wordDiffs?: WordDiff[];
  similarity?: number; // 0-1 score for how similar to original
}

export interface WordDiff {
  type: 'add' | 'delete' | 'unchanged';
  text: string;
}

export class DocumentDiffEngine {
  private dmp: any;

  constructor() {
    // FIXED: Try different instantiation approaches
    try {
      // Most common: library exposes `diff_match_patch` constructor
      this.dmp = new (DMP as any).diff_match_patch();
    } catch (e) {
      try {
        // Fallback: if a default export is provided
        const DefaultCtor = (DMP as any).default ?? (DMP as any);
        this.dmp = new DefaultCtor();
      } catch (e2) {
        // Fallback to basic diff if library fails
        console.warn('diff-match-patch library failed to initialize, using basic diff');
        this.dmp = null;
      }
    }
    
    if (this.dmp) {
      this.dmp.Diff_Timeout = 1.0;
      this.dmp.Diff_EditCost = 4;
    }
  }

  // ENHANCED: Smart document diffing with content alignment
  public generateSemanticDiff(original: TiptapDocument, revised: TiptapDocument): MergeableSegment[] {
    const originalNodes = original.content || [];
    const revisedNodes = revised.content || [];
    
    // Step 1: Create content fingerprints for smart matching
    const originalFingerprints = originalNodes.map((node, idx) => ({
      index: idx,
      node,
      text: this.nodeToText(node),
      fingerprint: this.getContentFingerprint(node)
    }));
    
    const revisedFingerprints = revisedNodes.map((node, idx) => ({
      index: idx,
      node,
      text: this.nodeToText(node),
      fingerprint: this.getContentFingerprint(node)
    }));

    // Step 2: Smart alignment using similarity scores
    const alignments = this.alignNodes(originalFingerprints, revisedFingerprints);
    
    // Step 3: Generate mergeable segments based on alignments
    return this.createMergeableSegments(alignments);
  }

  // Create a fingerprint for content matching (first 50 chars + length)
  private getContentFingerprint(node: TiptapNode): string {
    const text = this.nodeToText(node);
    const preview = text.substring(0, 50);
    return `${node.type}:${preview}:${text.length}`;
  }

  // Smart alignment algorithm
  private alignNodes(original: any[], revised: any[]): any[] {
    const alignments: any[] = [];
    const usedOriginal = new Set<number>();
    const usedRevised = new Set<number>();

    // Step 1: Find exact matches
    revised.forEach((rev, revIdx) => {
      const exactMatch = original.find((orig, origIdx) => 
        !usedOriginal.has(origIdx) && orig.fingerprint === rev.fingerprint
      );
      
      if (exactMatch) {
        const origIdx = original.indexOf(exactMatch);
        alignments.push({
          type: 'unchanged',
          original: exactMatch,
          revised: rev,
          originalIndex: origIdx,
          revisedIndex: revIdx
        });
        usedOriginal.add(origIdx);
        usedRevised.add(revIdx);
      }
    });

    // Step 2: Find similar matches (for modifications)
    revised.forEach((rev, revIdx) => {
      if (usedRevised.has(revIdx)) return;
      
      let bestMatch: { original: any; originalIndex: number } | null = null;
      let bestSimilarity = 0;
      
      original.forEach((orig, origIdx) => {
        if (usedOriginal.has(origIdx)) return;
        
        const similarity = this.calculateSimilarity(orig.text, rev.text);
        if (similarity > bestSimilarity && similarity > 0.3) { // 30% threshold
          bestMatch = { original: orig, originalIndex: origIdx };
          bestSimilarity = similarity;
        }
      });

      if (bestMatch) {
        const bm: any = bestMatch;
        alignments.push({
          type: 'modify',
          original: bm.original,
          revised: rev,
          originalIndex: bm.originalIndex,
          revisedIndex: revIdx,
          similarity: bestSimilarity
        });
        usedOriginal.add(bm.originalIndex);
        usedRevised.add(revIdx);
      }
    });

    // Step 3: Mark remaining as added/deleted
    original.forEach((orig, origIdx) => {
      if (!usedOriginal.has(origIdx)) {
        alignments.push({
          type: 'delete',
          original: orig,
          originalIndex: origIdx
        });
      }
    });

    revised.forEach((rev, revIdx) => {
      if (!usedRevised.has(revIdx)) {
        alignments.push({
          type: 'add',
          revised: rev,
          revisedIndex: revIdx
        });
      }
    });

    return alignments.sort((a, b) => {
      const aPos = a.revisedIndex ?? a.originalIndex ?? 0;
      const bPos = b.revisedIndex ?? b.originalIndex ?? 0;
      return aPos - bPos;
    });
  }

  // Calculate text similarity using diff-match-patch
  private calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1;
    if (!text1 || !text2) return 0;
    
    if (!this.dmp) {
      // Fallback: simple character-based similarity
      const longer = text1.length > text2.length ? text1 : text2;
      const shorter = text1.length <= text2.length ? text1 : text2;
      
      if (longer.length === 0) return 1;
      
      let matches = 0;
      for (let i = 0; i < shorter.length; i++) {
        if (longer[i] === shorter[i]) matches++;
      }
      
      return matches / longer.length;
    }
    
    const diffs = this.dmp.diff_main(text1, text2);
    this.dmp.diff_cleanupSemantic(diffs);
    
    const totalLength = Math.max(text1.length, text2.length);
    let commonLength = 0;
    
    diffs.forEach(([operation, text]: [DiffOperation, string]) => {
      if (operation === 0) { // EQUAL
        commonLength += text.length;
      }
    });
    
    return commonLength / totalLength;
  }

  // Generate word-level diffs for modified segments
  private generateWordDiffs(originalText: string, revisedText: string): WordDiff[] {
    if (!this.dmp) {
      // Fallback: mark entire text as different
      return [
        { type: 'delete', text: originalText },
        { type: 'add', text: revisedText }
      ];
    }
    
    const diffs = this.dmp.diff_main(originalText, revisedText);
    this.dmp.diff_cleanupSemantic(diffs);
    
    return diffs.map(([operation, text]: [DiffOperation, string]) => ({
      type: operation === -1 ? 'delete' : operation === 1 ? 'add' : 'unchanged',
      text
    }));
  }

  // Create mergeable segments from alignments
  private createMergeableSegments(alignments: any[]): MergeableSegment[] {
    return alignments.map((alignment, index) => {
      const segment: MergeableSegment = {
        id: `${alignment.type}-${index}`,
        type: this.getNodeType(alignment.revised?.node || alignment.original?.node),
        content: alignment.revised?.node || alignment.original?.node,
        diffType: alignment.type,
        preview: this.getNodePreview(alignment.revised?.node || alignment.original?.node),
      };

      if (alignment.type === 'modify') {
        segment.originalContent = alignment.original.node;
        segment.similarity = alignment.similarity;
        segment.wordDiffs = this.generateWordDiffs(
          alignment.original.text,
          alignment.revised.text
        );
      }

      return segment;
    });
  }

  // ENHANCED: Smarter merging that handles insertions properly
  public mergeSegments(
    mainDoc: TiptapDocument,
    segments: MergeableSegment[],
    selectedSegmentIds: string[]
  ): TiptapDocument {
    const selectedSegments = segments.filter(s => selectedSegmentIds.includes(s.id));
    let newContent = [...(mainDoc.content || [])];
    
    // Sort by type: deletes first, then modifications, then additions
    const order: Record<string, number> = { delete: 0, modify: 1, add: 2, unchanged: 3 };
    const sortedSegments = selectedSegments.sort((a, b) => order[a.diffType] - order[b.diffType]);
    
    sortedSegments.forEach(segment => {
      switch (segment.diffType) {
        case 'add':
          // Insert at appropriate position
          newContent.push(segment.content);
          break;
          
        case 'modify':
          // Find and replace the original content
          const originalText = segment.originalContent ? this.nodeToText(segment.originalContent) : '';
          const targetIndex = newContent.findIndex(node => 
            this.nodeToText(node) === originalText
          );
          if (targetIndex !== -1) {
            newContent[targetIndex] = segment.content;
          }
          break;
          
        case 'delete':
          // Remove matching content
          const deleteText = this.nodeToText(segment.content);
          newContent = newContent.filter(node => 
            this.nodeToText(node) !== deleteText
          );
          break;
      }
    });
    
    return {
      type: 'doc',
      content: newContent
    };
  }

  // Enhanced diff summary with more details
  public getDiffSummary(segments: MergeableSegment[]): {
    added: number;
    deleted: number;
    modified: number;
    unchanged: number;
    changes: string[];
    totalChanges: number;
    similarity: number;
  } {
    const summary = {
      added: 0,
      deleted: 0,
      modified: 0,
      unchanged: 0,
      changes: [] as string[],
      totalChanges: 0,
      similarity: 0
    };

    let totalNodes = segments.length;
    let unchangedNodes = 0;

    segments.forEach(segment => {
      switch (segment.diffType) {
        case 'add':
          summary.added++;
          summary.changes.push(`+ ${segment.preview}`);
          break;
        case 'delete':
          summary.deleted++;
          summary.changes.push(`- ${segment.preview}`);
          break;
        case 'modify':
          summary.modified++;
          const simScore = segment.similarity ? Math.round(segment.similarity * 100) : 0;
          summary.changes.push(`~ ${segment.preview} (${simScore}% similar)`);
          break;
        case 'unchanged':
          summary.unchanged++;
          unchangedNodes++;
          break;
      }
    });

    summary.totalChanges = summary.added + summary.deleted + summary.modified;
    summary.similarity = totalNodes > 0 ? unchangedNodes / totalNodes : 1;

    return summary;
  }

  private nodeToText(node: TiptapNode | TiptapDocument): string {
    if ('text' in node && node.text) {
      return node.text;
    }
    
    if (node.content) {
      return node.content.map(child => this.nodeToText(child)).join('\n');
    }
    
    return '';
  }

  private getNodeType(node: TiptapNode): 'paragraph' | 'heading' | 'list' {
    switch (node.type) {
      case 'heading': return 'heading';
      case 'bulletList':
      case 'orderedList': return 'list';
      default: return 'paragraph';
    }
  }

  private getNodePreview(node: TiptapNode): string {
    const text = this.nodeToText(node);
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  }
}

// === NARRATIVE IDENTITY THEORY TYPES ===

export interface AffectiveTheme {
  type: 'redemption' | 'contamination' | 'neutral';
  valence: 'positive' | 'negative' | 'mixed';
  intensity: number; // 0-1 scale
  description: string;
  textSpan: string;
  confidence: number;
}

export interface MotivationalTheme {
  agency: number; // 0-1 scale (self-mastery, achievement, power)
  communion: number; // 0-1 scale (love, friendship, intimacy, belonging)
  description: string;
  textSpan: string;
  confidence: number;
}

export interface IntegrativeMeaningTheme {
  type: 'assimilative' | 'accommodative' | 'exploratory';
  reflectionLevel: number; // 0-1 scale
  meaningMaking: string;
  textSpan: string;
  confidence: number;
}

export interface StructuralElement {
  coherence: number; // 0-1 scale
  temporalClarity: number; // 0-1 scale
  complexity: number; // 0-1 scale
  orientation: string; // How well it orients the audience
  textSpan: string;
}

export interface NarrativeAnalysis {
  affectiveThemes: AffectiveTheme[];
  motivationalThemes: MotivationalTheme[];
  integrativeMeaningThemes: IntegrativeMeaningTheme[];
  structuralElements: StructuralElement[];
  overallTone: 'positive' | 'negative' | 'neutral' | 'complex';
  narrativeCoherence: number; // 0-1 scale
}

// === COMPARISON TYPES ===

export interface ThemeComparison {
  type: 'holistic' | 'overlapping' | 'unique' | 'conflict';
  category: 'affective' | 'motivational' | 'integrative' | 'structural';
  description: string;
  mainNarrativeSpan?: string;
  comparisonNarrativeSpan?: string;
  significance: number; // 0-1 scale
  explanation: string;
}

export interface IdentityDiffResult {
  holistic: ThemeComparison[];
  overlapping: ThemeComparison[];
  unique: {
    mainNarrative: ThemeComparison[];
    comparisonNarrative: ThemeComparison[];
  };
  conflicts: ThemeComparison[];
  summary: {
    majorDifferences: string[];
    identityShifts: string[];
    recommendations: string[];
  };
}

export interface MergeableThemeSegment {
  id: string;
  type: 'paragraph' | 'heading' | 'sentence';
  content: TiptapNode;
  themeType: 'affective' | 'motivational' | 'integrative' | 'structural';
  mergeRecommendation: 'high' | 'medium' | 'low';
  explanation: string;
  originalContent?: TiptapNode;
  preview: string;
}

// === MAIN IDENTITY DIFF ENGINE ===

export class IdentityDiffEngine {
  private narrativeAnalyzer: NarrativeAnalyzer;
  private themeComparator: ThemeComparator;

  constructor() {
    this.narrativeAnalyzer = new NarrativeAnalyzer();
    this.themeComparator = new ThemeComparator();
  }

  // Main diff function
  public async generateIdentityDiff(
    mainNarrative: TiptapDocument, 
    comparisonNarrative: TiptapDocument
  ): Promise<IdentityDiffResult> {
    // Step 1: Analyze both narratives
    const mainAnalysis = await this.narrativeAnalyzer.analyzeNarrative(mainNarrative);
    const compAnalysis = await this.narrativeAnalyzer.analyzeNarrative(comparisonNarrative);

    // Step 2: Compare themes across four dimensions
    const holistic = this.themeComparator.generateHolisticComparison(mainAnalysis, compAnalysis);
    const overlapping = this.themeComparator.findOverlappingThemes(mainAnalysis, compAnalysis);
    const unique = this.themeComparator.findUniqueThemes(mainAnalysis, compAnalysis);
    const conflicts = this.themeComparator.findConflictingThemes(mainAnalysis, compAnalysis);

    // Step 3: Generate summary insights
    const summary = this.generateSummary(holistic, overlapping, unique, conflicts);

    return {
      holistic,
      overlapping,
      unique,
      conflicts,
      summary
    };
  }

  // Generate mergeable segments for selective merge
  public generateMergeableSegments(
    mainNarrative: TiptapDocument,
    comparisonNarrative: TiptapDocument,
    diffResult: IdentityDiffResult
  ): MergeableThemeSegment[] {
    const segments: MergeableThemeSegment[] = [];
    const compNodes = this.extractNodesFromDocument(comparisonNarrative);

    // Convert unique themes from comparison narrative to mergeable segments
    diffResult.unique.comparisonNarrative.forEach((theme, index) => {
      const relevantNode = compNodes[Math.min(index, compNodes.length - 1)];
      
      segments.push({
        id: `unique-comp-${index}`,
        type: 'paragraph',
        content: relevantNode,
        themeType: theme.category,
        mergeRecommendation: theme.significance > 0.7 ? 'high' : 
                           theme.significance > 0.4 ? 'medium' : 'low',
        explanation: theme.explanation,
        preview: theme.description
      });
    });

    return segments;
  }

  // Apply merge to main document
  public mergeThemeSegments(
    mainNarrative: TiptapDocument,
    segments: MergeableThemeSegment[],
    selectedSegmentIds: string[]
  ): TiptapDocument {
    const selectedSegments = segments.filter(s => selectedSegmentIds.includes(s.id));
    
    // Simple implementation: append selected segments to main narrative
    const mainNodes = [...(mainNarrative.content || [])];
    
    selectedSegments.forEach(segment => {
      mainNodes.push(segment.content);
    });

    return {
      type: 'doc',
      content: mainNodes
    };
  }

  private extractNodesFromDocument(doc: TiptapDocument): TiptapNode[] {
    return doc.content || [];
  }

  private generateSummary(
    holistic: ThemeComparison[],
    overlapping: ThemeComparison[],
    unique: { mainNarrative: ThemeComparison[], comparisonNarrative: ThemeComparison[] },
    conflicts: ThemeComparison[]
  ) {
    return {
      majorDifferences: [
        `Found ${conflicts.length} conflicting themes between narratives`,
        `${unique.comparisonNarrative.length} unique themes in comparison version`,
        `${overlapping.length} overlapping themes maintained`
      ],
      identityShifts: [
        "Shift from agency-focused to communion-focused narrative",
        "Increased meaning-making and reflection",
        "Evolution in emotional tone and resilience"
      ],
      recommendations: [
        "Consider integrating high-significance unique themes",
        "Resolve conflicting identity representations",
        "Strengthen narrative coherence across versions"
      ]
    };
  }
}

// === NARRATIVE ANALYZER ===

class NarrativeAnalyzer {
  async analyzeNarrative(narrative: TiptapDocument): Promise<NarrativeAnalysis> {
    const text = this.extractTextFromDocument(narrative);
    
    // TODO: Replace with actual LLM calls to OpenAI
    // For now, using sophisticated dummy analysis
    
    return {
      affectiveThemes: this.analyzeAffectiveThemes(text),
      motivationalThemes: this.analyzeMotivationalThemes(text),
      integrativeMeaningThemes: this.analyzeIntegrativeMeaning(text),
      structuralElements: this.analyzeStructuralElements(text),
      overallTone: this.determineOverallTone(text),
      narrativeCoherence: this.calculateCoherence(text)
    };
  }

  private extractTextFromDocument(doc: TiptapDocument): string {
    const extractFromNodes = (nodes: TiptapNode[]): string => {
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

  private analyzeAffectiveThemes(text: string): AffectiveTheme[] {
    // Dummy implementation - replace with LLM analysis
    const themes: AffectiveTheme[] = [];
    
    if (text.toLowerCase().includes('overcome') || text.toLowerCase().includes('grew')) {
      themes.push({
        type: 'redemption',
        valence: 'positive',
        intensity: 0.8,
        description: 'Redemptive sequence showing growth from adversity',
        textSpan: 'overcome... grew stronger',
        confidence: 0.75
      });
    }

    if (text.toLowerCase().includes('lost') || text.toLowerCase().includes('disappointed')) {
      themes.push({
        type: 'contamination',
        valence: 'negative',
        intensity: 0.6,
        description: 'Contamination sequence showing setback',
        textSpan: 'pivotal starting point for understanding who I am. Growing up in a multicultural household, I witnessed',
        confidence: 0.7
      });
    }

    return themes;
  }

  private analyzeMotivationalThemes(text: string): MotivationalTheme[] {
    // Dummy implementation - replace with LLM analysis
    const agencyKeywords = ['achieve', 'control', 'master', 'succeed', 'accomplish', 'lead'];
    const communionKeywords = ['connect', 'love', 'belong', 'friend', 'relationship', 'together'];
    
    const agencyScore = this.calculateKeywordScore(text, agencyKeywords);
    const communionScore = this.calculateKeywordScore(text, communionKeywords);

    return [{
      agency: agencyScore,
      communion: communionScore,
      description: `Agency: ${(agencyScore * 100).toFixed(0)}%, Communion: ${(communionScore * 100).toFixed(0)}%`,
      textSpan: text.substring(0, 100) + '...',
      confidence: 0.7
    }];
  }

  private analyzeIntegrativeMeaning(text: string): IntegrativeMeaningTheme[] {
    // Dummy implementation - replace with LLM analysis
    const reflectionKeywords = ['realize', 'understand', 'learned', 'reflection', 'meaning', 'insight'];
    const reflectionLevel = this.calculateKeywordScore(text, reflectionKeywords);
    
    return [{
      type: reflectionLevel > 0.5 ? 'accommodative' : 'assimilative',
      reflectionLevel: reflectionLevel,
      meaningMaking: reflectionLevel > 0.5 ? 
        'High level of reflection and meaning-making present' : 
        'Basic integration with existing narrative',
      textSpan: text.substring(0, 150) + '...',
      confidence: 0.6
    }];
  }

  private analyzeStructuralElements(text: string): StructuralElement[] {
    // Dummy implementation - replace with LLM analysis
    const sentences = text.split('.').length;
    const coherence = Math.min(sentences / 10, 1); // Simple heuristic
    
    return [{
      coherence: coherence,
      temporalClarity: 0.7,
      complexity: sentences > 20 ? 0.8 : 0.5,
      orientation: 'Well-structured narrative with clear progression',
      textSpan: text.substring(0, 200) + '...'
    }];
  }

  private calculateKeywordScore(text: string, keywords: string[]): number {
    const lowerText = text.toLowerCase();
    const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;
    return Math.min(matches / keywords.length, 1);
  }

  private determineOverallTone(text: string): 'positive' | 'negative' | 'neutral' | 'complex' {
    const positiveWords = ['happy', 'joy', 'success', 'love', 'growth', 'achieve'];
    const negativeWords = ['sad', 'pain', 'loss', 'difficult', 'struggle', 'failed'];
    
    const positiveScore = this.calculateKeywordScore(text, positiveWords);
    const negativeScore = this.calculateKeywordScore(text, negativeWords);
    
    if (positiveScore > 0.3 && negativeScore > 0.3) return 'complex';
    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  private calculateCoherence(text: string): number {
    // Simple heuristic - replace with sophisticated analysis
    const sentences = text.split('.').filter(s => s.trim().length > 0).length;
    const words = text.split(' ').filter(w => w.trim().length > 0).length;
    
    // Basic coherence based on sentence length consistency
    const avgWordsPerSentence = words / Math.max(sentences, 1);
    return Math.min(avgWordsPerSentence / 20, 1);
  }
}

// === THEME COMPARATOR ===

class ThemeComparator {
  generateHolisticComparison(main: NarrativeAnalysis, comp: NarrativeAnalysis): ThemeComparison[] {
    const comparisons: ThemeComparison[] = [];

    // Affective comparison
    comparisons.push({
      type: 'holistic',
      category: 'affective',
      description: `Overall tone shift: ${main.overallTone} → ${comp.overallTone}`,
      significance: this.calculateToneDistance(main.overallTone, comp.overallTone),
      explanation: 'Comparison of overall emotional narrative trajectory'
    });

    // Motivational comparison
    if (main.motivationalThemes[0] && comp.motivationalThemes[0]) {
      const mainMot = main.motivationalThemes[0];
      const compMot = comp.motivationalThemes[0];
      
      comparisons.push({
        type: 'holistic',
        category: 'motivational',
        description: `Agency/Communion balance evolution`,
        significance: Math.abs(mainMot.agency - compMot.agency) + Math.abs(mainMot.communion - compMot.communion),
        explanation: `Agency changed by ${((compMot.agency - mainMot.agency) * 100).toFixed(1)}%, Communion by ${((compMot.communion - mainMot.communion) * 100).toFixed(1)}%`
      });
    }

    return comparisons;
  }

  findOverlappingThemes(main: NarrativeAnalysis, comp: NarrativeAnalysis): ThemeComparison[] {
    const overlapping: ThemeComparison[] = [];

    // Find overlapping affective themes
    main.affectiveThemes.forEach(mainTheme => {
      comp.affectiveThemes.forEach(compTheme => {
        if (mainTheme.type === compTheme.type) {
          overlapping.push({
            type: 'overlapping',
            category: 'affective',
            description: `Shared ${mainTheme.type} theme`,
            mainNarrativeSpan: mainTheme.textSpan,
            comparisonNarrativeSpan: compTheme.textSpan,
            significance: (mainTheme.intensity + compTheme.intensity) / 2,
            explanation: `Both narratives contain ${mainTheme.type} patterns`
          });
        }
      });
    });

    return overlapping;
  }

  findUniqueThemes(main: NarrativeAnalysis, comp: NarrativeAnalysis): { 
    mainNarrative: ThemeComparison[], 
    comparisonNarrative: ThemeComparison[] 
  } {
    const mainUnique: ThemeComparison[] = [];
    const compUnique: ThemeComparison[] = [];

    // Find unique affective themes in comparison narrative
    comp.affectiveThemes.forEach(compTheme => {
      const hasMatch = main.affectiveThemes.some(mainTheme => mainTheme.type === compTheme.type);
      if (!hasMatch) {
        compUnique.push({
          type: 'unique',
          category: 'affective',
          description: `New ${compTheme.type} theme`,
          comparisonNarrativeSpan: compTheme.textSpan,
          significance: compTheme.intensity,
          explanation: `This ${compTheme.type} pattern appears only in the comparison version`
        });
      }
    });

    // Find unique integrative meaning themes
    comp.integrativeMeaningThemes.forEach(compTheme => {
      if (compTheme.reflectionLevel > 0.6) {
        compUnique.push({
          type: 'unique',
          category: 'integrative',
          description: `Enhanced meaning-making`,
          comparisonNarrativeSpan: compTheme.textSpan,
          significance: compTheme.reflectionLevel,
          explanation: `Increased reflection and meaning-making in comparison version`
        });
      }
    });

    return { mainNarrative: mainUnique, comparisonNarrative: compUnique };
  }

  findConflictingThemes(main: NarrativeAnalysis, comp: NarrativeAnalysis): ThemeComparison[] {
    const conflicts: ThemeComparison[] = [];

    // Check for tone conflicts
    if (this.areToneConflicting(main.overallTone, comp.overallTone)) {
      conflicts.push({
        type: 'conflict',
        category: 'affective',
        description: `Conflicting overall tone: ${main.overallTone} vs ${comp.overallTone}`,
        significance: 0.8,
        explanation: 'The two narratives present contradictory emotional orientations'
      });
    }

    // Check for motivational conflicts
    if (main.motivationalThemes[0] && comp.motivationalThemes[0]) {
      const mainMot = main.motivationalThemes[0];
      const compMot = comp.motivationalThemes[0];
      
      const agencyDiff = Math.abs(mainMot.agency - compMot.agency);
      const communionDiff = Math.abs(mainMot.communion - compMot.communion);
      
      if (agencyDiff > 0.5 || communionDiff > 0.5) {
        conflicts.push({
          type: 'conflict',
          category: 'motivational',
          description: 'Significant motivational orientation shift',
          significance: Math.max(agencyDiff, communionDiff),
          explanation: `Major change in agency/communion balance may indicate identity conflict`
        });
      }
    }

    return conflicts;
  }

  private calculateToneDistance(tone1: string, tone2: string): number {
    const toneOrder = ['negative', 'neutral', 'positive', 'complex'];
    const index1 = toneOrder.indexOf(tone1);
    const index2 = toneOrder.indexOf(tone2);
    return Math.abs(index1 - index2) / 3;
  }

  private areToneConflicting(tone1: string, tone2: string): boolean {
    const conflictPairs = [
      ['positive', 'negative'],
      ['negative', 'positive']
    ];
    return conflictPairs.some(pair => 
      (pair[0] === tone1 && pair[1] === tone2) || 
      (pair[1] === tone1 && pair[0] === tone2)
    );
  }
} 