'use client';

import React, { useState, useEffect } from 'react';
import { TiptapDocument } from '@/types/tiptap';
import { 
  IdentityDiffResult
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
  discussionNotes?: string; // NEW: Add discussion notes prop
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
  // Add More functionality
  onAddMoreComments?: () => void;
}



const CommentCards: React.FC<CommentCardsProps> = ({
  originalContent,
  comparisonContent,
  onHighlightText,
  mainDocId,
  refDocId,
  discussionNotes,
  userComments = [],
  onResolveComment,
  onDeleteComment,
  onEditComment,
  inlineCommentData,
  onSaveInlineComment,
  onCancelInlineComment,
  activeCommentId,
  onCommentClick,
  onAddMoreComments
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiComments, setAiComments] = useState<AIComment[]>([]);
  const [activeAICard, setActiveAICard] = useState<string | null>(null);
  const [activeThreadIds, setActiveThreadIds] = useState<{[cardId: string]: string | null}>({});

  const aiDiffEngine = new AIIdentityDiffEngine();



  // Only run analysis when explicitly triggered by version changes, not content changes
  useEffect(() => {
    // Only analyze if we have both mainDocId and refDocId (comparing specific versions)
    if (mainDocId && refDocId) {
      // Clear existing comments when switching to a new version
      setAiComments([]);
      // Then generate new insights for this version
      analyzeDiscussionInsights();
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

  // Check if we have discussion notes to analyze from the current comparison
  const checkForDiscussionNotes = (): boolean => {
    return !!(discussionNotes && discussionNotes.trim().length > 0);
  };

  // Generate AI insights from discussion notes
  const generateDiscussionInsights = async () => {
    if (!mainDocId || !refDocId) {
      throw new Error('Missing document IDs for discussion insights');
    }

    if (!discussionNotes || discussionNotes.trim().length === 0) {
      throw new Error('No discussion notes available for analysis');
    }

    const response = await fetch('/api/ai/discussion-insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mainContent: originalContent,
        discussionNotes: discussionNotes,
        refDocContent: comparisonContent,
        mainDocId,
        refDocId
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate discussion insights');
    }

    return await response.json();
  };

  const analyzeDiscussionInsights = async () => {
    setIsAnalyzing(true);
    try {
      // Check if we have discussion notes to analyze
      const hasDiscussionNotes = checkForDiscussionNotes();
      
      let initialInsights: AIComment[] = [];
      
      if (hasDiscussionNotes) {
        // Use the new discussion insights API
        const result = await generateDiscussionInsights();
        initialInsights = result.insights || [];
      } else {
        // Fall back to existing diff analysis if no discussion notes
        const result = await aiDiffEngine.generateIdentityDiff(
          originalContent, 
          comparisonContent,
          mainDocId,
          refDocId
        );
        
        // Convert old comparison result to new AI comment cards
        initialInsights = await generateAICommentsFromDiff(result);
      }
      
      // Ensure we have at least 5 insights for the first-time review
      let finalInsights = [...initialInsights];
      
      // If we have fewer than 5 insights, generate additional ones
      if (finalInsights.length < 5 && hasDiscussionNotes && mainDocId && refDocId) {
        console.log(`Only ${finalInsights.length} insights generated, generating additional ones to reach 5...`);
        
        const insightsNeeded = 5 - finalInsights.length;
        for (let i = 0; i < insightsNeeded; i++) {
          try {
            const additionalInsight = await generateSingleAdditionalInsight(finalInsights);
            if (additionalInsight) {
              finalInsights.push(additionalInsight);
            }
          } catch (error) {
            console.error('Error generating additional insight:', error);
            // Continue with whatever insights we have
            break;
          }
        }
      }
      
      // If we still don't have enough insights and don't have discussion notes, 
      // add some fallback insights to reach 5
      if (finalInsights.length < 5 && !hasDiscussionNotes) {
        const fallbackInsights = generateFallbackInsights(finalInsights.length);
        finalInsights = [...finalInsights, ...fallbackInsights];
      }
      
      // Load existing chat threads for these AI comments
      const insightsWithChatThreads = await loadExistingChatThreads(finalInsights);
      setAiComments(insightsWithChatThreads);
      
    } catch (error) {
      console.error('Error analyzing insights:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateAICommentsFromDiff = async (diffResult: IdentityDiffResult): Promise<AIComment[]> => {
    const aiComments: AIComment[] = [];
    
    // Convert holistic comparisons to AI comments
    diffResult.holistic.forEach((card, index) => {
      aiComments.push({
        id: `ai-holistic-${index}`,
        type: 'overlapping',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
        insight: card.description,
        socraticPrompt: `How does this ${card.category} pattern reflect your identity development journey?`,
        evidence: [
          ...(card.mainNarrativeSpan ? [{
            id: `ev-main-${index}`,
            text: card.mainNarrativeSpan,
            position: { from: 0, to: card.mainNarrativeSpan.length }
          }] : []),
          ...(card.comparisonNarrativeSpan ? [{
            id: `ev-comp-${index}`,
            text: card.comparisonNarrativeSpan,
            position: { from: 0, to: card.comparisonNarrativeSpan.length }
          }] : [])
        ],
        isResolved: false,
        userReflections: [],
        chatThreads: []
      });
    });

    // Convert overlapping themes to AI comments
    diffResult.overlapping.forEach((card, index) => {
      aiComments.push({
        id: `ai-overlap-${index}`,
        type: 'overlapping',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
        insight: card.description,
        socraticPrompt: `What does the persistence of this theme reveal about your core identity?`,
        evidence: [
          ...(card.mainNarrativeSpan ? [{
            id: `ev-main-overlap-${index}`,
            text: card.mainNarrativeSpan,
            position: { from: 0, to: card.mainNarrativeSpan.length }
          }] : []),
          ...(card.comparisonNarrativeSpan ? [{
            id: `ev-comp-overlap-${index}`,
            text: card.comparisonNarrativeSpan,
            position: { from: 0, to: card.comparisonNarrativeSpan.length }
          }] : [])
        ],
        isResolved: false,
        userReflections: [],
        chatThreads: []
      });
    });

    // Convert unique themes to AI comments
    diffResult.unique.mainNarrative.forEach((card, index) => {
      aiComments.push({
        id: `ai-unique-main-${index}`,
        type: 'unique',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
        insight: card.description,
        socraticPrompt: `What prompted this new aspect of your identity to emerge?`,
        evidence: card.mainNarrativeSpan ? [{
          id: `ev-unique-main-${index}`,
          text: card.mainNarrativeSpan,
          position: { from: 0, to: card.mainNarrativeSpan.length }
        }] : [],
        isResolved: false,
        userReflections: [],
        chatThreads: []
      });
    });

    diffResult.unique.comparisonNarrative.forEach((card, index) => {
      aiComments.push({
        id: `ai-unique-comp-${index}`,
        type: 'unique',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
        insight: card.description,
        socraticPrompt: `How does this previous aspect of your identity relate to who you are now?`,
        evidence: card.comparisonNarrativeSpan ? [{
          id: `ev-unique-comp-${index}`,
          text: card.comparisonNarrativeSpan,
          position: { from: 0, to: card.comparisonNarrativeSpan.length }
        }] : [],
        isResolved: false,
        userReflections: [],
        chatThreads: []
      });
    });

    // Convert conflicts to AI comments
    diffResult.conflicts.forEach((card, index) => {
      aiComments.push({
        id: `ai-conflict-${index}`,
        type: 'conflicting',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
        insight: card.description,
        socraticPrompt: `How might you reconcile these different aspects of your identity?`,
        evidence: [
          ...(card.mainNarrativeSpan ? [{
            id: `ev-main-conflict-${index}`,
            text: card.mainNarrativeSpan,
            position: { from: 0, to: card.mainNarrativeSpan.length }
          }] : []),
          ...(card.comparisonNarrativeSpan ? [{
            id: `ev-comp-conflict-${index}`,
            text: card.comparisonNarrativeSpan,
            position: { from: 0, to: card.comparisonNarrativeSpan.length }
          }] : [])
        ],
        isResolved: false,
        userReflections: [],
        chatThreads: []
      });
    });

    return aiComments;
  };



  const truncateText = (text: string, maxLength: number = 100) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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

  // Track which evidence is currently highlighted
  const [highlightedEvidenceIds, setHighlightedEvidenceIds] = useState<{[cardId: string]: string | null}>({});

  const handleAIEvidenceClick = (evidence: Evidence, cardId: string) => {
    if (onHighlightText) {
      const currentHighlightedId = highlightedEvidenceIds[cardId];
      if (currentHighlightedId === evidence.id) {
        // If this evidence is already highlighted, unhighlight it
        setHighlightedEvidenceIds(prev => ({ ...prev, [cardId]: null }));
        onHighlightText(''); // Clear highlight
      } else {
        // Highlight this evidence
        setHighlightedEvidenceIds(prev => ({ ...prev, [cardId]: evidence.id }));
        onHighlightText(evidence.text);
      }
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
  const handleAIStartChat = async (cardId: string, question: string) => {
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

    // Get real AI response
    try {
      const aiComment = aiComments.find(c => c.id === cardId);
      if (!aiComment) return;

      const aiResponseText = await generateAIChatResponse(
        cardId,
        newThread.id,
        question,
        aiComment,
        [] // Empty chat history for first message
      );

      const aiResponse: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'ai',
        text: aiResponseText,
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
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Add error message if AI call fails
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        type: 'ai',
        text: 'Sorry, I couldn\'t generate a response right now. Please try again.',
        timestamp: new Date()
      };

      setAiComments(prev => prev.map(comment => 
        comment.id === cardId 
          ? { 
              ...comment, 
              chatThreads: comment.chatThreads.map(thread => 
                thread.id === newThread.id 
                  ? { ...thread, messages: [...thread.messages, errorMessage] }
                  : thread
              )
            }
          : comment
      ));
    }
  };

  // Handler for continuing a chat thread
  const handleAIContinueChat = async (cardId: string, threadId: string, message: string) => {
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

    // Get real AI response
    try {
      const aiComment = aiComments.find(c => c.id === cardId);
      if (!aiComment) return;

      // Get the chat history for this thread
      const thread = aiComment.chatThreads.find(t => t.id === threadId);
      const chatHistory = thread ? thread.messages : [];

      const aiResponseText = await generateAIChatResponse(
        cardId,
        threadId,
        message,
        aiComment,
        chatHistory
      );

      const aiResponse: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'ai',
        text: aiResponseText,
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
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Add error message if AI call fails
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        type: 'ai',
        text: 'Sorry, I couldn\'t generate a response right now. Please try again.',
        timestamp: new Date()
      };

      setAiComments(prev => prev.map(comment => 
        comment.id === cardId 
          ? { 
              ...comment, 
              chatThreads: comment.chatThreads.map(thread => 
                thread.id === threadId 
                  ? { ...thread, messages: [...thread.messages, errorMessage] }
                  : thread
              )
            }
          : comment
      ));
    }
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

  // Helper function to call AI chat API
  const generateAIChatResponse = async (
    cardId: string,
    threadId: string,
    userMessage: string,
    aiComment: AIComment,
    chatHistory: ChatMessage[]
  ): Promise<string> => {
    try {
      const response = await fetch('/api/ai/comment-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aiCommentId: cardId,
          threadId: threadId,
          userMessage: userMessage,
          aiCommentData: {
            ...aiComment,
            mainDocId,
            refDocId
          },
          mainDocumentContent: originalContent,
          refDocumentContent: comparisonContent,
          chatHistory: chatHistory
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI chat response');
      }

      const result = await response.json();
      return result.response;
      
    } catch (error) {
      console.error('Error calling AI chat API:', error);
      throw error;
    }
  };

  // Load existing chat threads from database for AI comments
  const loadExistingChatThreads = async (aiComments: AIComment[]) => {
    if (!mainDocId || !refDocId) return aiComments;

    try {
      const response = await fetch('/api/ai/comment-chat-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mainDocId,
          refDocId,
          aiCommentIds: aiComments.map(c => c.id)
        }),
      });

      if (response.ok) {
        const chatHistoryData = await response.json();
        
        // Merge chat threads into AI comments
        return aiComments.map(comment => {
          const commentChatHistory = chatHistoryData.chatThreads[comment.id];
          if (commentChatHistory && commentChatHistory.length > 0) {
            // Group chat records by thread ID
            const threadGroups = commentChatHistory.reduce((groups: any, record: any) => {
              if (!groups[record.threadId]) {
                groups[record.threadId] = [];
              }
              groups[record.threadId].push(record);
              return groups;
            }, {});

            // Convert to ChatThread format
            const chatThreads: ChatThread[] = Object.entries(threadGroups).map(([threadId, records]: [string, any]) => {
              const messages: ChatMessage[] = [];
              records.forEach((record: any) => {
                // Add user message
                messages.push({
                  id: `msg-user-${record.id}`,
                  type: 'user',
                  text: record.userPrompt,
                  timestamp: new Date(record.createdAt)
                });
                // Add AI response
                messages.push({
                  id: `msg-ai-${record.id}`,
                  type: 'ai',
                  text: record.aiOutput,
                  timestamp: new Date(record.createdAt)
                });
              });

              return {
                id: threadId,
                initialQuestion: records[0].userPrompt,
                messages: messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
                isExpanded: false,
                timestamp: new Date(records[0].createdAt)
              };
            });

            return {
              ...comment,
              chatThreads: chatThreads
            };
          }
          return comment;
        });
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }

    return aiComments;
  };

  // Generate one additional AI insight to add to existing comments
  const generateAdditionalInsight = async () => {
    if (!mainDocId || !refDocId || !discussionNotes) {
      console.log('Missing requirements for additional insight generation');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/discussion-insights-add-more', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mainContent: originalContent,
          discussionNotes: discussionNotes,
          refDocContent: comparisonContent,
          existingInsights: aiComments,
          mainDocId: mainDocId,
          refDocId: refDocId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate additional insight');
      }

      const result = await response.json();
      
      // Add the new insight to the existing comments
      setAiComments(prev => [...prev, result.insight]);
      
    } catch (error) {
      console.error('Error generating additional insight:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate a single additional insight without updating state (for internal use)
  const generateSingleAdditionalInsight = async (existingInsights: AIComment[]): Promise<AIComment | null> => {
    if (!mainDocId || !refDocId || !discussionNotes) {
      console.log('Missing requirements for single additional insight generation');
      return null;
    }

    try {
      const response = await fetch('/api/ai/discussion-insights-add-more', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mainContent: originalContent,
          discussionNotes: discussionNotes,
          refDocContent: comparisonContent,
          existingInsights: existingInsights,
          mainDocId: mainDocId,
          refDocId: refDocId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate single additional insight');
      }

      const result = await response.json();
      return result.insight;
      
    } catch (error) {
      console.error('Error generating single additional insight:', error);
      return null;
    }
  };

  // Generate fallback insights when we don't have enough and no discussion notes
  const generateFallbackInsights = (currentCount: number): AIComment[] => {
    const fallbackInsights: AIComment[] = [];
    const insightsNeeded = 5 - currentCount;
    
    const fallbackTemplates = [
      {
        type: 'overlapping' as const,
        insight: 'Your writing demonstrates consistent themes of personal growth and self-reflection across different versions.',
        socraticPrompt: 'What specific experiences have contributed most to your ongoing personal development?',
        evidence: 'Selected passages that show personal growth themes'
      },
      {
        type: 'unique' as const,
        insight: 'There are emerging patterns in how you process and understand your experiences, showing evolution in your self-awareness.',
        socraticPrompt: 'How has your way of understanding and interpreting your experiences changed over time?',
        evidence: 'Passages that demonstrate evolving self-understanding'
      },
      {
        type: 'conflicting' as const,
        insight: 'Your narrative reveals some tension between different aspects of your identity, which is natural and valuable for growth.',
        socraticPrompt: 'What might these different aspects of yourself be trying to tell you about your authentic identity?',
        evidence: 'Passages that show different aspects of identity'
      },
      {
        type: 'overlapping' as const,
        insight: 'Your writing shows recurring themes around relationships and connection with others as central to your identity.',
        socraticPrompt: 'How do your relationships with others reflect and shape your sense of who you are?',
        evidence: 'Passages that highlight relationship themes'
      },
      {
        type: 'unique' as const,
        insight: 'There are subtle shifts in how you present yourself and your values, indicating ongoing identity development.',
        socraticPrompt: 'What recent experiences or insights have influenced these shifts in how you see yourself?',
        evidence: 'Passages that show evolving self-presentation'
      }
    ];
    
    for (let i = 0; i < Math.min(insightsNeeded, fallbackTemplates.length); i++) {
      const template = fallbackTemplates[i];
      fallbackInsights.push({
        id: `ai-fallback-${Date.now()}-${i}`,
        type: template.type,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
        insight: template.insight,
        socraticPrompt: template.socraticPrompt,
        evidence: [{
          id: `ev-fallback-${i}`,
          text: template.evidence,
          position: { from: 0, to: template.evidence.length }
        }],
        isResolved: false,
        userReflections: [],
        chatThreads: []
      });
    }
    
    return fallbackInsights;
  };

  // Handler for adding more AI comments
  const handleAddMoreComments = () => {
    if (mainDocId && refDocId && discussionNotes) {
      // If we're in comparison mode with discussion notes, add one more insight
      generateAdditionalInsight();
    } else {
      // If not in comparison mode or no discussion notes, regenerate from existing analysis
      if (mainDocId && refDocId) {
        analyzeDiscussionInsights();
      } else {
        // Generate new dummy comments as fallback
        const newAIComment: AIComment = {
          id: `ai-${Date.now()}`,
          type: 'unique',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today',
          insight: 'Your writing reveals an evolving sense of purpose and direction, suggesting continued growth in self-understanding.',
          socraticPrompt: 'What recent experiences have contributed most to this sense of clarity about your direction?',
          evidence: [
            {
              id: `new-ev-${Date.now()}`,
              text: 'Selected text from your document that relates to this insight.',
              position: { from: 100, to: 160 }
            }
          ],
          isResolved: false,
          userReflections: [],
          chatThreads: []
        };

        // Add one new comment to the existing ones
        setAiComments(prev => [...prev, newAIComment]);
      }
    }
    
    // Also call parent's add more handler if provided
    if (onAddMoreComments) {
      onAddMoreComments();
    }
  };

  const renderCommentCards = () => {

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
        {aiComments.length > 0 ? (
          aiComments.map((aiComment) => (
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
              onEvidenceClick={(evidence) => handleAIEvidenceClick(evidence, aiComment.id)}
              onActivate={handleAICardActivate}
              userReflections={aiComment.userReflections}
              chatThreads={aiComment.chatThreads}
              activeThreadId={activeThreadIds[aiComment.id] || null}
              onSendReflection={handleAISendReflection}
              onStartChat={handleAIStartChat}
              onContinueChat={handleAIContinueChat}
              onFinishChat={handleAIFinishChat}
              onToggleThread={handleAIToggleThread}
              highlightedEvidenceId={highlightedEvidenceIds[aiComment.id] || null}
            />
          ))
        ) : (
          <div className="no-ai-comments-reminder" style={{
            textAlign: 'center',
            padding: '20px',
            color: '#666',
            fontSize: '0.8rem',
            fontStyle: 'italic'
          }}>
            <div style={{ marginBottom: '8px' }}>💡</div>
            <div>Double-click on a version to review and see AI insights</div>
          </div>
        )}


      </div>
    );
  };

  return (
    <div className="comment-cards-container">
      {/* Header with Add More button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '8px 0',
        borderBottom: '1px solid #eee',
        marginBottom: '8px'
      }}>
        <div style={{ fontSize: '0.8rem', color: '#666' }}>
          AI Insights {aiComments.length > 0 && `(${aiComments.length})`}
        </div>
        <button 
          onClick={handleAddMoreComments}
          disabled={isAnalyzing}
          className="add-more-button"
          style={{
            background: isAnalyzing ? '#ccc' : '#6f42c1',
            border: 'none',
            color: 'white',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            fontSize: '0.65rem',
            padding: '2px 6px',
            borderRadius: '3px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '2px'
          }}
          onMouseEnter={(e) => {
            if (!isAnalyzing) {
              e.currentTarget.style.background = '#5a32a3';
            }
          }}
          onMouseLeave={(e) => {
            if (!isAnalyzing) {
              e.currentTarget.style.background = '#6f42c1';
            }
          }}
          title="Add one more AI insight"
        >
          {isAnalyzing ? '⏳ Adding...' : '➕ Add More'}
        </button>
      </div>
      
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
      

    </div>
  );
};

export default CommentCards; 