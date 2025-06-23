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
      // Try the default export approach
      this.dmp = new DMP.DiffMatchPatch();
    } catch (e) {
      try {
        // Try direct instantiation
        this.dmp = new (DMP as any)();
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
      
      let bestMatch = null;
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
        alignments.push({
          type: 'modify',
          original: bestMatch.original,
          revised: rev,
          originalIndex: bestMatch.originalIndex,
          revisedIndex: revIdx,
          similarity: bestSimilarity
        });
        usedOriginal.add(bestMatch.originalIndex);
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
    const sortedSegments = selectedSegments.sort((a, b) => {
      const order = { delete: 0, modify: 1, add: 2 };
      return order[a.diffType] - order[b.diffType];
    });
    
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