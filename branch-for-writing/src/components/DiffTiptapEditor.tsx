'use client';

import React, { useState, useEffect } from 'react';
import { TiptapDocument } from '@/types/tiptap';
import { 
  IdentityDiffEngine, 
  IdentityDiffResult, 
  ThemeComparison, 
  MergeableThemeSegment 
} from '@/lib/diffEngine';
import './diff-editor.css';

interface DiffTiptapEditorProps {
  originalContent: TiptapDocument;
  comparisonContent: TiptapDocument;
  onMergeSegments: (selectedSegmentIds: string[]) => void;
}

type ViewMode = 'holistic' | 'overlapping' | 'unique' | 'conflicts' | 'themes';

const DiffTiptapEditor: React.FC<DiffTiptapEditorProps> = ({ 
  originalContent, 
  comparisonContent, 
  onMergeSegments 
}) => {
  const [diffResult, setDiffResult] = useState<IdentityDiffResult | null>(null);
  const [mergeableSegments, setMergeableSegments] = useState<MergeableThemeSegment[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set());
  const [currentView, setCurrentView] = useState<ViewMode>('holistic');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    analyzeDifferences();
  }, [originalContent, comparisonContent]);

  const analyzeDifferences = async () => {
    setIsAnalyzing(true);
    try {
      const diffEngine = new IdentityDiffEngine();
      const result = await diffEngine.generateIdentityDiff(originalContent, comparisonContent);
      const segments = diffEngine.generateMergeableSegments(originalContent, comparisonContent, result);
      
      setDiffResult(result);
      setMergeableSegments(segments);
    } catch (error) {
      console.error('Error analyzing differences:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSegmentToggle = (segmentId: string) => {
    const newSelected = new Set(selectedSegments);
    if (newSelected.has(segmentId)) {
      newSelected.delete(segmentId);
    } else {
      newSelected.add(segmentId);
    }
    setSelectedSegments(newSelected);
  };

  const handleMergeSelected = () => {
    if (selectedSegments.size > 0) {
      onMergeSegments(Array.from(selectedSegments));
      setSelectedSegments(new Set());
    }
  };

  const renderThemeComparison = (comparison: ThemeComparison, index: number) => {
    const significanceLevel = comparison.significance > 0.7 ? 'high' : 
                             comparison.significance > 0.4 ? 'medium' : 'low';
    
    return (
      <div key={index} className={`theme-comparison ${comparison.category} ${comparison.type}`}>
        <div className="theme-header">
          <span className={`theme-category ${comparison.category}`}>
            {comparison.category}
          </span>
          <span className={`significance-badge ${significanceLevel}`} title={`Significance level: ${significanceLevel}`}>
            {significanceLevel}
          </span>
        </div>
        <h4 className="theme-description">{comparison.description}</h4>
        
        <div className="theme-details">
          {comparison.mainNarrativeSpan && (
            <div className="text-span main-span">
              <strong>Main:</strong> "{comparison.mainNarrativeSpan}"
            </div>
          )}
          
          {comparison.comparisonNarrativeSpan && (
            <div className="text-span comparison-span">
              <strong>Comparison:</strong> "{comparison.comparisonNarrativeSpan}"
            </div>
          )}
          
          {comparison.explanation && (
            <div className="theme-explanation-full">
              <p>{comparison.explanation}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMergeableSegments = () => {
    if (mergeableSegments.length === 0) {
      return <div className="no-segments">No mergeable segments found.</div>;
    }

    return (
      <div className="mergeable-segments">
        <h3>Mergeable Identity Themes</h3>
        <p className="merge-instruction">
          Select themes from the comparison version that you'd like to integrate into your main narrative:
        </p>
        
        {mergeableSegments.map((segment) => (
          <div 
            key={segment.id} 
            className={`mergeable-segment ${segment.themeType} ${segment.mergeRecommendation}`}
          >
            <div className="segment-header">
              <label className="segment-checkbox">
                <input
                  type="checkbox"
                  checked={selectedSegments.has(segment.id)}
                  onChange={() => handleSegmentToggle(segment.id)}
                />
                <span className={`theme-type ${segment.themeType}`}>
                  {segment.themeType.toUpperCase()}
                </span>
                <span className={`recommendation ${segment.mergeRecommendation}`}>
                  {segment.mergeRecommendation} priority
                </span>
              </label>
            </div>
            
            <div className="segment-preview">
              <strong>Theme:</strong> {segment.preview}
            </div>
            
            <div className="segment-explanation">
              {segment.explanation}
            </div>
          </div>
        ))}
        
        {selectedSegments.size > 0 && (
          <div className="merge-actions">
            <button 
              onClick={handleMergeSelected}
              className="merge-button"
            >
              Merge Selected Themes ({selectedSegments.size})
            </button>
            <button 
              onClick={() => setSelectedSegments(new Set())}
              className="clear-selection-button"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderCurrentView = () => {
    if (!diffResult) return null;

    switch (currentView) {
      case 'holistic':
        return (
          <div className="comparison-view">
            <h3>Holistic Identity Analysis</h3>
            <p className="view-description">
              Overall identity themes and patterns comparison
            </p>
            {diffResult.holistic.map(renderThemeComparison)}
          </div>
        );
      
      case 'overlapping':
        return (
          <div className="comparison-view">
            <h3>Overlapping Themes</h3>
            <p className="view-description">
              Shared identity themes between versions
            </p>
            {diffResult.overlapping.length > 0 ? 
              diffResult.overlapping.map(renderThemeComparison) :
              <div className="no-themes">No overlapping themes found.</div>
            }
          </div>
        );
      
      case 'unique':
        return (
          <div className="comparison-view">
            <h3>Unique Themes</h3>
            <p className="view-description">
              Themes appearing in only one version
            </p>
            
            <div className="unique-sections">
              <div className="unique-main">
                <h4>Main Version Only</h4>
                {diffResult.unique.mainNarrative.length > 0 ? 
                  diffResult.unique.mainNarrative.map(renderThemeComparison) :
                  <div className="no-themes">No unique themes found.</div>
                }
              </div>
              
              <div className="unique-comparison">
                <h4>Comparison Version Only</h4>
                {diffResult.unique.comparisonNarrative.length > 0 ? 
                  diffResult.unique.comparisonNarrative.map(renderThemeComparison) :
                  <div className="no-themes">No unique themes found.</div>
                }
              </div>
            </div>
          </div>
        );
      
      case 'conflicts':
        return (
          <div className="comparison-view">
            <h3>Identity Conflicts</h3>
            <p className="view-description">
              Contradictory identity representations
            </p>
            {diffResult.conflicts.length > 0 ? 
              diffResult.conflicts.map(renderThemeComparison) :
              <div className="no-themes">No identity conflicts detected.</div>
            }
          </div>
        );
      
      case 'themes':
        return (
          <div className="comparison-view">
            <h3>Mergeable Identity Themes</h3>
            <p className="view-description">
              Select themes from the comparison version to integrate into your main narrative
            </p>
            
            <div className="themes-grid">
              {mergeableSegments.length > 0 ? (
                <>
                  {mergeableSegments.map((segment) => (
                    <div 
                      key={segment.id} 
                      className={`theme-card ${segment.themeType} ${segment.mergeRecommendation}`}
                    >
                      <div className="theme-card-header">
                        <label className="theme-card-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedSegments.has(segment.id)}
                            onChange={() => handleSegmentToggle(segment.id)}
                          />
                          <span className={`theme-type ${segment.themeType}`}>
                            {segment.themeType}
                          </span>
                          <span className={`recommendation ${segment.mergeRecommendation}`}>
                            {segment.mergeRecommendation}
                          </span>
                        </label>
                      </div>
                      
                      <div className="theme-card-content">
                        <h4 className="theme-card-title">{segment.preview}</h4>
                        <p className="theme-card-explanation">{segment.explanation}</p>
                      </div>
                    </div>
                  ))}
                  
                  {selectedSegments.size > 0 && (
                    <div className="themes-actions">
                      <button 
                        onClick={handleMergeSelected}
                        className="merge-button"
                      >
                        Merge Selected Themes ({selectedSegments.size})
                      </button>
                      <button 
                        onClick={() => setSelectedSegments(new Set())}
                        className="clear-selection-button"
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-themes">No mergeable themes found.</div>
              )}
            </div>
          </div>
        );
    }
  };

  if (isAnalyzing) {
    return (
      <div className="diff-editor-container">
        <div className="analyzing-state">
          <div className="spinner"></div>
          <h3>Analyzing Identity Themes...</h3>
          <p>Comparing affective, motivational, integrative, and structural elements.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="diff-editor-container">
      <div className="diff-header">
        <h2>Identity-Level Narrative Comparison</h2>
        <div className="view-selector">
          {(['holistic', 'overlapping', 'unique', 'conflicts', 'themes'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setCurrentView(mode)}
              className={`view-button ${currentView === mode ? 'active' : ''}`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="diff-content">
        <div className="analysis-panel">
          {renderCurrentView()}
        </div>
        
        {currentView === 'themes' && (
          <div className="merge-panel">
            {renderMergeableSegments()}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiffTiptapEditor; 