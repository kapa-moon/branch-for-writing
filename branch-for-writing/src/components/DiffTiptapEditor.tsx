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

type ViewMode = 'holistic' | 'overlapping' | 'unique' | 'conflicts';

type CardStatus = 'active' | 'resolved' | 'ignored';

interface CardState {
  [cardId: string]: {
    status: CardStatus;
    expandedMain: boolean;
    expandedComparison: boolean;
  };
}

const DiffTiptapEditor: React.FC<DiffTiptapEditorProps> = ({ 
  originalContent, 
  comparisonContent, 
  onMergeSegments 
}) => {
  const [diffResult, setDiffResult] = useState<IdentityDiffResult | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('holistic');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cardStates, setCardStates] = useState<CardState>({});
  const [confirmAction, setConfirmAction] = useState<{
    cardId: string;
    action: 'resolve' | 'merge' | 'ignore';
    show: boolean;
  }>({ cardId: '', action: 'resolve', show: false });

  useEffect(() => {
    analyzeDifferences();
  }, [originalContent, comparisonContent]);

  const analyzeDifferences = async () => {
    setIsAnalyzing(true);
    try {
      const diffEngine = new IdentityDiffEngine();
      const result = await diffEngine.generateIdentityDiff(originalContent, comparisonContent);
      
      setDiffResult(result);
      
      const initialCardStates: CardState = {};
      const allCards = [
        ...result.holistic,
        ...result.overlapping,
        ...result.unique.mainNarrative,
        ...result.unique.comparisonNarrative,
        ...result.conflicts
      ];
      
      allCards.forEach((card, index) => {
        const cardId = `${card.type}-${card.category}-${index}`;
        initialCardStates[cardId] = {
          status: 'active',
          expandedMain: false,
          expandedComparison: false
        };
      });
      
      setCardStates(initialCardStates);
    } catch (error) {
      console.error('Error analyzing differences:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getCardId = (comparison: ThemeComparison, index: number) => {
    return `${comparison.type}-${comparison.category}-${index}`;
  };

  const handleActionClick = (cardId: string, action: 'resolve' | 'merge' | 'ignore') => {
    setConfirmAction({ cardId, action, show: true });
  };

  const confirmActionHandler = () => {
    const { cardId, action } = confirmAction;
    const status = action === 'ignore' ? 'ignored' : 'resolved';
    
    setCardStates(prev => ({
      ...prev,
      [cardId]: {
        ...prev[cardId],
        status
      }
    }));
    
    setConfirmAction({ cardId: '', action: 'resolve', show: false });
  };

  const cancelAction = () => {
    setConfirmAction({ cardId: '', action: 'resolve', show: false });
  };

  const toggleExpansion = (cardId: string, field: 'expandedMain' | 'expandedComparison', event: React.MouseEvent) => {
    event.stopPropagation();
    
    setCardStates(prev => ({
      ...prev,
      [cardId]: {
        ...prev[cardId],
        status: prev[cardId]?.status || 'active',
        expandedMain: prev[cardId]?.expandedMain || false,
        expandedComparison: prev[cardId]?.expandedComparison || false,
        [field]: !prev[cardId]?.[field]
      }
    }));
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const getCardViewMode = (comparison: ThemeComparison): ViewMode => {
    // Determine which tab/view this card belongs to based on its type
    switch (comparison.type) {
      case 'overlapping':
        return 'overlapping';
      case 'unique':
        return 'unique';
      case 'conflict':
        return 'conflicts';
      case 'holistic':
      default:
        // For holistic cards, we need to check which array they came from
        if (!diffResult) return 'holistic';
        
        // Check if it's in overlapping
        if (diffResult.overlapping.find(card => card.description === comparison.description)) {
          return 'overlapping';
        }
        // Check if it's in unique arrays
        if (diffResult.unique.mainNarrative.find(card => card.description === comparison.description) ||
            diffResult.unique.comparisonNarrative.find(card => card.description === comparison.description)) {
          return 'unique';
        }
        // Check if it's in conflicts
        if (diffResult.conflicts.find(card => card.description === comparison.description)) {
          return 'conflicts';
        }
        
        return 'holistic';
    }
  };

  const handleThumbnailClick = (comparison: ThemeComparison) => {
    const targetView = getCardViewMode(comparison);
    if (targetView !== 'holistic') {
      setCurrentView(targetView);
    }
  };

  const renderComparisonCard = (comparison: ThemeComparison, index: number, isThumnail: boolean = false) => {
    const cardId = getCardId(comparison, index);
    const cardState = cardStates[cardId] || { status: 'active', expandedMain: false, expandedComparison: false };

    return (
      <div 
        key={cardId} 
        className={`comparison-card ${comparison.category} ${comparison.type} ${cardState.status} ${isThumnail ? 'thumbnail' : ''}`}
        onClick={isThumnail ? () => handleThumbnailClick(comparison) : undefined}
        style={isThumnail ? { cursor: 'pointer' } : undefined}
      >
        <div className="card-header">
          <div className="card-badges">
            <span className={`theme-category ${comparison.category}`}>
              {comparison.category}
            </span>
            {cardState.status !== 'active' && (
              <span className={`status-badge ${cardState.status}`}>
                {cardState.status}
              </span>
            )}
          </div>
          
          {!isThumnail && cardState.status === 'active' && (
            <div className="card-actions" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionClick(cardId, 'resolve');
                }}
                className="action-btn resolve-btn"
                title="Manual Resolve"
              >
                ✓ Resolve
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionClick(cardId, 'merge');
                }}
                className="action-btn merge-btn"
                title="Auto Merge with AI"
              >
                🤖 AI Merge
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionClick(cardId, 'ignore');
                }}
                className="action-btn ignore-btn"
                title="Ignore"
              >
                ✕ Ignore
              </button>
            </div>
          )}
        </div>

        <h4 className="card-title">{comparison.description}</h4>

        {!isThumnail && (
          <>
            <div className="evidence-section">
              {comparison.mainNarrativeSpan && (
                <div className="evidence-item main-evidence">
                  <div className="evidence-header">
                    <strong>Main Document Evidence:</strong>
                    <button 
                      onClick={(e) => toggleExpansion(cardId, 'expandedMain', e)}
                      className="expand-btn"
                    >
                      {cardState.expandedMain ? '▼ Collapse' : '▶ Expand'}
                    </button>
                  </div>
                  <div className="evidence-text">
                    "{cardState.expandedMain 
                      ? comparison.mainNarrativeSpan 
                      : truncateText(comparison.mainNarrativeSpan)}"
                  </div>
                </div>
              )}

              {comparison.comparisonNarrativeSpan && (
                <div className="evidence-item comparison-evidence">
                  <div className="evidence-header">
                    <strong>Comparison Document Evidence:</strong>
                    <button 
                      onClick={(e) => toggleExpansion(cardId, 'expandedComparison', e)}
                      className="expand-btn"
                    >
                      {cardState.expandedComparison ? '▼ Collapse' : '▶ Expand'}
                    </button>
                  </div>
                  <div className="evidence-text">
                    "{cardState.expandedComparison 
                      ? comparison.comparisonNarrativeSpan 
                      : truncateText(comparison.comparisonNarrativeSpan)}"
                  </div>
                </div>
              )}
            </div>

            {comparison.explanation && (
              <div className="rationale-section">
                <h5>Analysis Rationale:</h5>
                <p>{comparison.explanation}</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const getAllCards = () => {
    if (!diffResult) return [];
    return [
      ...diffResult.holistic,
      ...diffResult.overlapping,
      ...diffResult.unique.mainNarrative,
      ...diffResult.unique.comparisonNarrative,
      ...diffResult.conflicts
    ];
  };

  const renderHolisticSummary = () => {
    const summaryPoints = [
      "Your narrative shows a significant shift from external validation to internal self-worth, indicating growing emotional maturity. This change suggests you're developing a more stable sense of identity that doesn't depend on others' approval.",
      
      "There's an emerging pattern of increased self-compassion and acceptance of personal flaws across multiple identity dimensions. This represents healthy psychological development and suggests better emotional regulation skills.",
      
      "The comparison reveals stronger integration of past experiences into a coherent life story, showing improved narrative coherence. This indicates you're becoming more skilled at making meaning from your experiences and seeing connections between different life events."
    ];

    return (
      <div className="holistic-summary">
        <h4> Summary</h4>
        <ul className="summary-points">
          {summaryPoints.map((point, index) => (
            <li key={index} className="summary-point">{point}</li>
          ))}
        </ul>
      </div>
    );
  };

  const renderCurrentView = () => {
    if (!diffResult) return null;

    switch (currentView) {
      case 'holistic':
        const allCards = getAllCards();
        return (
          <div className="comparison-view holistic-view">
            <div className="holistic-upper">
              {renderHolisticSummary()}
            </div>
            
            <div className="holistic-lower">
              <div className="thumbnail-section">
                <h4>Comparison Cards</h4>
                <div className="thumbnail-grid">
                  {allCards.map((card, index) => renderComparisonCard(card, index, true))}
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'overlapping':
        return (
          <div className="comparison-view">
            <p className="view-description">
              ℹ️ Shared identity themes between versions
            </p>
            <div className="cards-container">
              {diffResult.overlapping.length > 0 ? 
                diffResult.overlapping.map((card, index) => renderComparisonCard(card, index)) :
                <div className="no-themes">No overlapping themes found.</div>
              }
            </div>
          </div>
        );
      
      case 'unique':
        return (
          <div className="comparison-view">
            <p className="view-description">
            ℹ️ Themes appearing in only one version
            </p>
            
            <div className="unique-sections">
              <div className="unique-main">
                <h4>Main Version Only</h4>
                <div className="cards-container">
                  {diffResult.unique.mainNarrative.length > 0 ? 
                    diffResult.unique.mainNarrative.map((card, index) => renderComparisonCard(card, index)) :
                    <div className="no-themes">No unique themes found.</div>
                  }
                </div>
              </div>
              
              <div className="unique-comparison">
                <h4>Comparison Version Only</h4>
                <div className="cards-container">
                  {diffResult.unique.comparisonNarrative.length > 0 ? 
                    diffResult.unique.comparisonNarrative.map((card, index) => renderComparisonCard(card, index)) :
                    <div className="no-themes">No unique themes found.</div>
                  }
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'conflicts':
        return (
          <div className="comparison-view">
            <p className="view-description">
            ℹ️ Contradictory identity representations
            </p>
            <div className="cards-container">
              {diffResult.conflicts.length > 0 ? 
                diffResult.conflicts.map((card, index) => renderComparisonCard(card, index)) :
                <div className="no-themes">No identity conflicts detected.</div>
              }
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
        <div className="view-selector">
          {(['holistic', 'overlapping', 'unique', 'conflicts'] as ViewMode[]).map((mode) => (
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
        <div className="analysis-panel full-width">
          {renderCurrentView()}
        </div>
      </div>

      {confirmAction.show && (
        <div className="confirmation-overlay">
          <div className="confirmation-modal">
            <h4>Confirm Action</h4>
            <p>
              Are you sure you want to {confirmAction.action === 'ignore' ? 'ignore' : 'resolve'} this theme comparison?
              {confirmAction.action === 'merge' && ' This will use AI to automatically merge the theme.'}
            </p>
            <div className="confirmation-actions">
              <button 
                onClick={confirmActionHandler}
                className={`confirm-btn ${confirmAction.action === 'ignore' ? 'ignore' : 'resolve'}`}
              >
                Yes, {confirmAction.action === 'ignore' ? 'Ignore' : 'Resolve'}
              </button>
              <button 
                onClick={cancelAction}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiffTiptapEditor; 