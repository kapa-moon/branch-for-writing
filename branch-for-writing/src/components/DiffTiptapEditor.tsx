'use client';

import React, { useState } from 'react';
import { TiptapDocument } from '@/types/tiptap';
import { DocumentDiffEngine, MergeableSegment } from '@/lib/diffEngine';
import './DiffTiptapEditor.css';

interface DiffTiptapEditorProps {
  originalContent: TiptapDocument;
  comparisonContent: TiptapDocument;
  onMergeSegments: (selectedSegments: string[]) => void;
}

const DiffTiptapEditor: React.FC<DiffTiptapEditorProps> = ({ 
  originalContent, 
  comparisonContent, 
  onMergeSegments
}) => {
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const diffEngine = new DocumentDiffEngine();
  
  const mergeableSegments = diffEngine.generateSemanticDiff(originalContent, comparisonContent);
  const diffSummary = diffEngine.getDiffSummary(mergeableSegments);

  const handleSegmentToggle = (segmentId: string) => {
    setSelectedSegments(prev => 
      prev.includes(segmentId) 
        ? prev.filter(id => id !== segmentId)
        : [...prev, segmentId]
    );
  };

  const handleMergeSelected = () => {
    onMergeSegments(selectedSegments);
    setSelectedSegments([]);
  };

  const handleSelectAll = (diffType: string) => {
    const segmentsOfType = mergeableSegments.filter(s => s.diffType === diffType).map(s => s.id);
    setSelectedSegments(prev => [...new Set([...prev, ...segmentsOfType])]);
  };

  const renderSegmentContent = (segment: MergeableSegment): string => {
    return segment.preview;
  };

  return (
    <div className="diff-editor-container">
      <div className="diff-header">
        <h3>Document Comparison</h3>
        <div className="diff-summary">
          <span className="diff-stat added">+{diffSummary.added}</span>
          <span className="diff-stat deleted">-{diffSummary.deleted}</span>
          <span className="diff-stat modified">~{diffSummary.modified}</span>
        </div>
      </div>

      <div className="diff-controls">
        <button 
          onClick={handleMergeSelected}
          disabled={selectedSegments.length === 0}
          className="merge-button"
        >
          Merge Selected ({selectedSegments.length})
        </button>
        <div className="quick-select">
          <button onClick={() => handleSelectAll('add')} className="select-button add">
            Select All Added
          </button>
          <button onClick={() => handleSelectAll('modify')} className="select-button modify">
            Select All Modified
          </button>
        </div>
      </div>
      
      <div className="segments-list">
        {mergeableSegments.map(segment => (
          <div 
            key={segment.id}
            className={`segment segment-${segment.diffType} ${
              selectedSegments.includes(segment.id) ? 'selected' : ''
            }`}
            onClick={() => handleSegmentToggle(segment.id)}
          >
            <div className="segment-header">
              <span className={`diff-label diff-${segment.diffType}`}>
                {segment.diffType.toUpperCase()}
              </span>
              <span className="segment-type">{segment.type}</span>
              <input 
                type="checkbox" 
                checked={selectedSegments.includes(segment.id)}
                onChange={() => handleSegmentToggle(segment.id)}
              />
            </div>
            <div className="segment-content">
              <p>{renderSegmentContent(segment)}</p>
              {segment.diffType === 'modify' && segment.originalContent && (
                <div className="original-content">
                  <small>Original: {segment.preview}</small>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiffTiptapEditor; 