'use client';

import React, { useState, useEffect } from 'react';
import { TiptapDocument } from '@/types/tiptap';
import { 
  IdentityDiffResult, 
  ThemeComparison
} from '@/lib/diffEngine';
import { AIIdentityDiffEngine } from '@/lib/aiDiffEngine';
import { UserComment } from '@/types/comments';
import UserCommentCard from './UserCommentCard';
import InlineCommentCard from './InlineCommentCard';
import AICommentCard from './AICommentCard';
import './diff-editor.css';

interface Evidence {
  id: string;
  text: string;
  position: { from: number; to: number };
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface UserReflection {
  id: string;
  text: string;
  timestamp: Date;
}

interface ChatThread {
  id: string;
  initialQuestion: string;
  messages: ChatMessage[];
  isExpanded: boolean;
  timestamp: Date;
}

interface AIComment {
  id: string;
  type: 'overlapping' | 'unique' | 'conflicting';
  timestamp: string;
  insight: string;
  socraticPrompt: string;
  evidence: Evidence[];
  isResolved: boolean;
  userReflections: UserReflection[];
  chatThreads: ChatThread[];
}

interface CommentCardsProps {
  originalContent: TiptapDocument;
  comparisonContent: TiptapDocument;
  onHighlightText?: (text: string) => void;
  mainDocId?: string;
  refDocId?: string;
  userComments?: UserComment[];
  onResolveComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onEditComment?: (commentId: string, newText: string) => void;
  // Inline comment editing props
  inlineCommentData?: {
    selectedText: string;
    authorName: string;
    authorEmail: string;
    position: { from: number; to: number };
  } | null;
  onSaveInlineComment?: (commentText: string) => void;
  onCancelInlineComment?: () => void;
  // Active comment props
  activeCommentId?: string | null;
  onCommentClick?: (commentId: string) => void;
  // Regenerate functionality
  onRegenerateComments?: () => void;
}

type CardStatus = 'active' | 'resolved' | 'ignored' | 'ai-enhancing' | 'ai-enhanced';

interface CardState {
  [cardId: string]: {
    status: CardStatus;
    expandedMain: boolean;
    expandedComparison: boolean;
    aiEnhanced?: any;
  };
}

const CommentCards: React.FC<CommentCardsProps> = ({
  originalContent,
  comparisonContent,
  onHighlightText,
  mainDocId,
  refDocId,
  userComments = [],
  onResolveComment,
  onDeleteComment,
  onEditComment,
  inlineCommentData,
  onSaveInlineComment,
  onCancelInlineComment,
  activeCommentId,
  onCommentClick,
  onRegenerateComments
}) => {
  const [diffResult, setDiffResult] = useState<IdentityDiffResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cardStates, setCardStates] = useState<CardState>({});
  const [confirmAction, setConfirmAction] = useState<{
    cardId: string;
    action: 'resolve' | 'merge' | 'ignore';
    show: boolean;
  }>({ cardId: '', action: 'resolve', show: false });
  const [aiHolisticSummary, setAiHolisticSummary] = useState<string[] | null>(null);
  const [isGeneratingHolisticSummary, setIsGeneratingHolisticSummary] = useState(false);
  const [aiComments, setAiComments] = useState<AIComment[]>([]);
  const [activeAICard, setActiveAICard] = useState<string | null>(null);
  const [activeThreadIds, setActiveThreadIds] = useState<{[cardId: string]: string | null}>({});

  const aiDiffEngine = new AIIdentityDiffEngine();

  // Initialize dummy AI comments
  useEffect(() => {
    const dummyAIComments: AIComment[] = [
      {
        id: 'ai-1',
        type: 'overlapping',
        timestamp: '5:15 PM Today',
        insight: 'Your narrative consistently emphasizes personal growth through challenges, showing a strong resilience theme that appears in both versions.',
        socraticPrompt: 'How might this resilience theme connect to your core values, and what does it reveal about your identity development?',
        evidence: [
          {
            id: 'ev-1',
            text: 'I learned that setbacks are not failures but opportunities to grow stronger.',
            position: { from: 45, to: 110 }
          },
          {
            id: 'ev-2',
            text: 'Each challenge has taught me something valuable about myself.',
            position: { from: 200, to: 260 }
          },
          {
            id: 'ev-3',
            text: 'I now see difficult times as a chance to discover my inner strength.',
            position: { from: 350, to: 415 }
          }
        ],
        isResolved: false,
        userReflections: [],
        chatThreads: []
      },
      {
        id: 'ai-2',
        type: 'unique',
        timestamp: '5:12 PM Today',
        insight: 'This version introduces a new dimension of creative expression that wasn\'t present before, suggesting an evolving sense of artistic identity.',
        socraticPrompt: 'What prompted this shift toward creative expression, and how does it align with your deeper sense of purpose?',
        evidence: [
          {
            id: 'ev-4',
            text: 'I discovered my passion for writing during the quiet moments of reflection.',
            position: { from: 500, to: 570 }
          },
          {
            id: 'ev-5',
            text: 'Art became my way of processing emotions and experiences.',
            position: { from: 650, to: 705 }
          }
        ],
        isResolved: false,
        userReflections: [
          {
            id: 'reflection-1',
            text: 'This is really insightful. I hadn\'t noticed how creativity became such a central part of my identity.',
            timestamp: new Date()
          }
        ],
        chatThreads: [
          {
            id: 'thread-1',
            initialQuestion: 'What specific moments triggered this creative awakening?',
            messages: [
              {
                id: 'chat-2',
                type: 'ai',
                text: 'It\'s fascinating how creative expression can serve as both a mirror and a tool for self-discovery. What specific moments triggered this creative awakening?',
                timestamp: new Date()
              }
            ],
            isExpanded: false,
            timestamp: new Date()
          }
        ]
      },
      {
        id: 'ai-3',
        type: 'conflicting',
        timestamp: '5:08 PM Today',
        insight: 'There appears to be tension between your desire for independence and your need for community connection, creating an interesting identity paradox.',
        socraticPrompt: 'How might you reconcile these seemingly opposing needs, and what does this tension teach you about your authentic self?',
        evidence: [
          {
            id: 'ev-6',
            text: 'I value my independence above all else and prefer to solve problems alone.',
            position: { from: 800, to: 870 }
          },
          {
            id: 'ev-7',
            text: 'I find my greatest strength comes from the support of my community.',
            position: { from: 950, to: 1015 }
          }
        ],
        isResolved: false,
        userReflections: [],
        chatThreads: []
      }
    ];
    
    setAiComments(dummyAIComments);
  }, []);

  // Only run analysis when explicitly triggered by version changes, not content changes
  useEffect(() => {
    // Only analyze if we have both mainDocId and refDocId (comparing specific versions)
    if (mainDocId && refDocId) {
      analyzeDifferences();
    }
  }, [mainDocId, refDocId]); // Removed originalContent and comparisonContent from dependencies

  const documentToText = (doc: TiptapDocument): string => {
    return doc.content?.map((node: any) => nodeToText(node)).join('\n') || '';
  };

  const nodeToText = (node: any): string => {
    if (node.type === 'text') {
      return node.text || '';
    }
    if (node.content) {
      return node.content.map((child: any) => nodeToText(child)).join(' ');
    }
    return '';
  };

  const analyzeDifferences = async () => {
    setIsAnalyzing(true);
    try {
      const result = await aiDiffEngine.generateIdentityDiff(
        originalContent, 
        comparisonContent,
        mainDocId,
        refDocId
      );
      
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
          status: 'ai-enhanced',
          expandedMain: false,
          expandedComparison: false,
          aiEnhanced: {
            enhancedDescription: card.description,
            psychologicalInsight: card.explanation,
            developmentalSignificance: `Significance: ${Math.round(card.significance * 100)}%`,
            actionableInsight: 'This AI-generated insight helps understand identity development patterns.',
            emotionalPattern: 'Generated through comprehensive narrative analysis',
            narrativeCoherence: 'Contributes to overall narrative understanding'
          }
        };
      });
      
      setCardStates(initialCardStates);
      generateHolisticSummary(result);
    } catch (error) {
      console.error('Error analyzing differences:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateHolisticSummary = async (diffResult: IdentityDiffResult) => {
    setIsGeneratingHolisticSummary(true);
    try {
      const mainText = documentToText(originalContent);
      const comparisonText = documentToText(comparisonContent);
      
      const allCards = [
        ...diffResult.holistic,
        ...diffResult.overlapping,
        ...diffResult.unique.mainNarrative,
        ...diffResult.unique.comparisonNarrative,
        ...diffResult.conflicts
      ];

      console.log('🎭 Generating DUMMY holistic summary...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const dummyHolisticSummary = [
        "The comparison reveals a significant evolution in narrative voice, moving from tentative self-exploration to more confident self-assertion. This suggests growing identity clarity and self-acceptance over time.",
        "Key themes of family relationships and personal values remain consistent across versions, indicating these represent stable core identity elements that persist through personal development.",
        "The emergence of career-focused content and future planning in the main version suggests developmental progression toward establishing adult identity and life direction.",
        "Emotional expression patterns show increased sophistication, with more nuanced descriptions of internal states and better integration of challenging experiences into a coherent self-narrative."
      ];
      
      setAiHolisticSummary(dummyHolisticSummary);
      console.log('✅ DUMMY holistic summary completed');
    } catch (error) {
      console.error('Error generating DUMMY holistic summary:', error);
    } finally {
      setIsGeneratingHolisticSummary(false);
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

  const truncateText = (text: string, maxLength: number = 100) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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

  // AI Comment handlers
  const handleAICardActivate = (cardId: string) => {
    setActiveAICard(prevActive => prevActive === cardId ? null : cardId);
  };

  const handleAICardResolve = (cardId: string) => {
    setAiComments(prev => prev.map(comment => 
      comment.id === cardId 
        ? { ...comment, isResolved: !comment.isResolved }
        : comment
    ));
  };

  const handleAIEvidenceClick = (evidence: Evidence) => {
    if (onHighlightText) {
      onHighlightText(evidence.text);
    }
  };

  // Handler for sending reflection (Reply button)
  const handleAISendReflection = (cardId: string, reflection: string) => {
    const newReflection: UserReflection = {
      id: `reflection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: reflection,
      timestamp: new Date()
    };

    setAiComments(prev => prev.map(comment => 
      comment.id === cardId 
        ? { ...comment, userReflections: [...comment.userReflections, newReflection] }
        : comment
    ));
  };

  // Handler for starting a chat thread (Ask AI button)
  const handleAIStartChat = (cardId: string, question: string) => {
    const newThread: ChatThread = {
      id: `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      initialQuestion: question,
      messages: [],
      isExpanded: true,
      timestamp: new Date()
    };

    // Add user's question as first message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      text: question,
      timestamp: new Date()
    };

    setAiComments(prev => prev.map(comment => 
      comment.id === cardId 
        ? { ...comment, chatThreads: [...comment.chatThreads, { ...newThread, messages: [userMessage] }] }
        : comment
    ));

    // Set this thread as active
    setActiveThreadIds(prev => ({ ...prev, [cardId]: newThread.id }));

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'ai',
        text: `That's a thoughtful question. Based on your writing, I can see that this insight connects to several patterns in your narrative. What specific aspect would you like to explore further?`,
        timestamp: new Date()
      };

      setAiComments(prev => prev.map(comment => 
        comment.id === cardId 
          ? { 
              ...comment, 
              chatThreads: comment.chatThreads.map(thread => 
                thread.id === newThread.id 
                  ? { ...thread, messages: [...thread.messages, aiResponse] }
                  : thread
              )
            }
          : comment
      ));
    }, 1000);
  };

  // Handler for continuing a chat thread
  const handleAIContinueChat = (cardId: string, threadId: string, message: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      text: message,
      timestamp: new Date()
    };

    setAiComments(prev => prev.map(comment => 
      comment.id === cardId 
        ? { 
            ...comment, 
            chatThreads: comment.chatThreads.map(thread => 
              thread.id === threadId 
                ? { ...thread, messages: [...thread.messages, userMessage] }
                : thread
            )
          }
        : comment
    ));

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'ai',
        text: `I see what you mean. Let me think about that further... [This is a simulated response to continue the conversation]`,
        timestamp: new Date()
      };

      setAiComments(prev => prev.map(comment => 
        comment.id === cardId 
          ? { 
              ...comment, 
              chatThreads: comment.chatThreads.map(thread => 
                thread.id === threadId 
                  ? { ...thread, messages: [...thread.messages, aiResponse] }
                  : thread
              )
            }
          : comment
      ));
    }, 1000);
  };

  // Handler for finishing a chat thread
  const handleAIFinishChat = (cardId: string, threadId: string) => {
    // Remove the active thread ID for this card
    setActiveThreadIds(prev => ({ ...prev, [cardId]: null }));
  };

  // Handler for toggling chat thread expansion
  const handleAIToggleThread = (cardId: string, threadId: string) => {
    setAiComments(prev => prev.map(comment => 
      comment.id === cardId 
        ? { 
            ...comment, 
            chatThreads: comment.chatThreads.map(thread => 
              thread.id === threadId 
                ? { ...thread, isExpanded: !thread.isExpanded }
                : thread
            )
          }
        : comment
    ));
  };

  // Handler for regenerating AI comments
  const handleRegenerateComments = () => {
    const newAIComments: AIComment[] = [
      {
        id: `ai-${Date.now()}-1`,
        type: 'overlapping',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
        insight: 'Your recent writing shows a deepening awareness of how personal relationships shape your identity, with increased emotional sophistication compared to earlier versions.',
        socraticPrompt: 'How has your understanding of relationship dynamics evolved, and what does this reveal about your emotional growth?',
        evidence: [
          {
            id: 'new-ev-1',
            text: 'I\'ve learned to navigate complex emotions in relationships.',
            position: { from: 100, to: 160 }
          },
          {
            id: 'new-ev-2',
            text: 'Understanding others helps me understand myself better.',
            position: { from: 300, to: 360 }
          }
        ],
        isResolved: false,
        userReflections: [],
        chatThreads: []
      },
      {
        id: `ai-${Date.now()}-2`,
        type: 'unique',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
        insight: 'A new theme of environmental consciousness emerges in your latest writing, suggesting an expanding sense of responsibility beyond personal concerns.',
        socraticPrompt: 'What experiences or insights led to this environmental awareness, and how does it connect to your broader life philosophy?',
        evidence: [
          {
            id: 'new-ev-3',
            text: 'I feel a deep connection to nature and our planet\'s wellbeing.',
            position: { from: 500, to: 565 }
          }
        ],
        isResolved: false,
        userReflections: [],
        chatThreads: []
      }
    ];

    // Add new comments to the bottom without interfering with existing ones
    setAiComments(prev => [...prev, ...newAIComments]);
    
    // Also call parent's regenerate handler if provided
    if (onRegenerateComments) {
      onRegenerateComments();
    }
  };

  const renderCommentCards = () => {
    const allCards = getAllCards();

    return (
      <div className="comment-cards-list">
        {/* Render comments and inline editor in position order */}
        {(() => {
          // Create a combined list of comments and inline editor
          const allItems = [...userComments];
          
          // Add inline comment editor to the list if it exists
          if (inlineCommentData && onSaveInlineComment && onCancelInlineComment) {
            // Find insertion position based on text position
            const insertPosition = inlineCommentData.position.from;
            let insertIndex = 0;
            
            for (let i = 0; i < allItems.length; i++) {
              if (allItems[i].position.from < insertPosition) {
                insertIndex = i + 1;
              } else {
                break;
              }
            }
            
            // Insert inline editor at the calculated position
            allItems.splice(insertIndex, 0, {
              id: 'inline-editor',
              isInlineEditor: true,
              position: inlineCommentData.position
            } as any);
          }
          
          return allItems.map((item) => {
            if ((item as any).isInlineEditor) {
              return (
                <InlineCommentCard
                  key="inline-editor"
                  selectedText={inlineCommentData!.selectedText}
                  authorName={inlineCommentData!.authorName}
                  authorEmail={inlineCommentData!.authorEmail}
                  onSave={onSaveInlineComment!}
                  onCancel={onCancelInlineComment!}
                  position={inlineCommentData!.position}
                />
              );
            } else {
              const comment = item as UserComment;
              return (
                <UserCommentCard
                  key={comment.id}
                  comment={comment}
                  onResolve={onResolveComment || (() => {})}
                  onDelete={onDeleteComment || (() => {})}
                  onEdit={onEditComment}
                  onHighlightText={onHighlightText}
                  isActive={activeCommentId === comment.id}
                  onClick={() => onCommentClick?.(comment.id)}
                />
              );
            }
          });
                 })()}

        {/* AI Comment Cards */}
        {aiComments.map((aiComment) => (
          <AICommentCard
            key={aiComment.id}
            id={aiComment.id}
            type={aiComment.type}
            timestamp={aiComment.timestamp}
            insight={aiComment.insight}
            socraticPrompt={aiComment.socraticPrompt}
            evidence={aiComment.evidence}
            isActive={activeAICard === aiComment.id}
            isResolved={aiComment.isResolved}
            onResolve={handleAICardResolve}
            onEvidenceClick={handleAIEvidenceClick}
            onActivate={handleAICardActivate}
            userReflections={aiComment.userReflections}
            chatThreads={aiComment.chatThreads}
            activeThreadId={activeThreadIds[aiComment.id] || null}
            onSendReflection={handleAISendReflection}
            onStartChat={handleAIStartChat}
            onContinueChat={handleAIContinueChat}
            onFinishChat={handleAIFinishChat}
            onToggleThread={handleAIToggleThread}
          />
        ))}

        {/* Holistic Summary Card */}
        {aiHolisticSummary && (
          <div className="summary-comment-card">
            <div className="comment-card-header">
              <h5>📊 Overall Analysis</h5>
            </div>
            <div className="comment-card-content">
              {aiHolisticSummary.map((point, index) => (
                <p key={index} className="summary-point">{point}</p>
              ))}
            </div>
          </div>
        )}

        {/* Individual Comparison Cards */}
        {allCards.map((card, index) => {
          const cardId = getCardId(card, index);
          const cardState = cardStates[cardId] || { 
            status: 'ai-enhanced', 
            expandedMain: false, 
            expandedComparison: false 
          };
          const aiEnhanced = cardState.aiEnhanced;

          return (
            <div key={cardId} className={`comment-card ${card.category} ${card.type} ${cardState.status}`}>
              <div className="comment-card-header">
                <div className="card-badges">
                  <span className={`theme-category ${card.category}`}>
                    {card.category}
                  </span>
                  <span className={`card-type ${card.type}`}>
                    {card.type}
                  </span>
                </div>
                
                <div className="card-actions">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActionClick(cardId, 'resolve');
                    }}
                    className="action-btn resolve-btn"
                    title="Resolve"
                  >
                    ✓
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActionClick(cardId, 'ignore');
                    }}
                    className="action-btn ignore-btn"
                    title="Ignore"
                  >
                    ✕
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mainDocId && refDocId) {
                        aiDiffEngine.clearComparisonCache(mainDocId, refDocId).then(() => {
                          analyzeDifferences();
                        });
                      } else {
                        analyzeDifferences();
                      }
                    }}
                    className="action-btn refresh-btn"
                    title="Refresh AI"
                  >
                    🔄
                  </button>
                </div>
              </div>

              <div className="comment-card-content">
                <h5 className="card-title">
                  {aiEnhanced ? aiEnhanced.enhancedDescription : card.description}
                </h5>
                
                <p className="card-explanation">
                  {card.explanation}
                </p>

                {/* Evidence from documents */}
                {card.mainNarrativeSpan && (
                  <div className="evidence-snippet main-evidence">
                    <div className="evidence-header">
                      <span>Main:</span>
                      {onHighlightText && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onHighlightText(card.mainNarrativeSpan!);
                          }}
                          className="highlight-btn"
                          title="Highlight in main document"
                        >
                          🔍
                        </button>
                      )}
                    </div>
                    <div className="evidence-text">
                      "{truncateText(card.mainNarrativeSpan, 120)}"
                    </div>
                  </div>
                )}

                {card.comparisonNarrativeSpan && (
                  <div className="evidence-snippet comparison-evidence">
                    <div className="evidence-header">
                      <span>Reference:</span>
                    </div>
                    <div className="evidence-text">
                      "{truncateText(card.comparisonNarrativeSpan, 120)}"
                    </div>
                  </div>
                )}

                {/* AI Enhancement */}
                {aiEnhanced && (
                  <div className="ai-insights">
                    <div className="ai-insight">
                      <strong>💡 Insight:</strong> {aiEnhanced.psychologicalInsight}
                    </div>
                    <div className="significance-badge">
                      Significance: {Math.round(card.significance * 100)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="comment-cards-container">
      <div className="comment-cards-scroll">
        {renderCommentCards()}
        
        {/* Show analysis status at the bottom, not blocking */}
        {isAnalyzing && (
          <div className="analyzing-state-inline">
            <div className="spinner-small"></div>
            <span>Analyzing themes in background...</span>
          </div>
        )}
      </div>
      
      {confirmAction.show && (
        <div className="confirmation-overlay">
          <div className="confirmation-modal">
            <h4>Confirm Action</h4>
            <p>
              Are you sure you want to {confirmAction.action === 'ignore' ? 'ignore' : 'resolve'} this theme comparison?
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

export default CommentCards; 