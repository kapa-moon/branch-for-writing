import React, { useState, useCallback, useEffect } from 'react';
import { TiptapDocument } from '@/types/tiptap';
import { IdentityDiffEngine, IdentityDiffResult, ThemeComparison } from '@/lib/diffEngine';
import './ai-tool.css';

interface EnhancedAIToolProps {
  mainContent: TiptapDocument;
  comparisonContent?: TiptapDocument;
  selectedText?: string;
  onRequestTextSelection?: () => void;
}

interface ContextItem {
  id: string;
  text: string;
  timestamp: Date;
}

interface IdentityFacet {
  category: 'affective' | 'motivational' | 'integrative' | 'structural';
  description: string;
  mainScore: number;
  comparisonScore?: number;
  analysis: string;
  suggestions: string[];
}

interface ReconciliationSuggestion {
  type: 'addition' | 'filtering' | 'reconciliation' | 'awareness';
  priority: 'high' | 'medium' | 'low';
  description: string;
  explanation: string;
  actionable: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: string;
}

const EnhancedAITool: React.FC<EnhancedAIToolProps> = ({ 
  mainContent, 
  comparisonContent,
  selectedText,
  onRequestTextSelection
}) => {
  // Default to 'chat'; 'analysis' tab option hidden for now
  const [activeTab, setActiveTab] = useState<'analysis' | 'reconciliation' | 'chat'>('chat');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Identity Analysis State
  const [identityAnalysis, setIdentityAnalysis] = useState<IdentityFacet[]>([]);
  
  // Reconciliation State  
  const [reconciliationSuggestions, setReconciliationSuggestions] = useState<ReconciliationSuggestion[]>([]);
  
  // Chat State
  const [currentContext, setCurrentContext] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Auto-add selected text to context
  useEffect(() => {
    if (selectedText && selectedText.trim().length > 3) {
      setCurrentContext(selectedText.trim());
    }
  }, [selectedText]);

  const runIdentityAnalysis = async () => {
    if (!comparisonContent) {
      alert('Please select a version to compare for identity analysis.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const diffEngine = new IdentityDiffEngine();
      const diffResult = await diffEngine.generateIdentityDiff(mainContent, comparisonContent);
      
      // Transform diff result into identity facets
      const facets = transformDiffToIdentityFacets(diffResult);
      setIdentityAnalysis(facets);
      
    } catch (error) {
      console.error('Error in identity analysis:', error);
      alert('Error analyzing identity themes. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateReconciliationSuggestions = async () => {
    if (!comparisonContent) {
      alert('Please select a version to compare for reconciliation analysis.');
      return;
    }

    setIsAnalyzing(true);
    try {
      // TODO: Replace with actual LLM call
      // For now, using sophisticated dummy suggestions
      const suggestions = await generateDummyReconciliationSuggestions();
      setReconciliationSuggestions(suggestions);
      
    } catch (error) {
      console.error('Error generating reconciliation suggestions:', error);
      alert('Error generating suggestions. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendChatMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date(),
      context: currentContext || undefined
    };

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsChatLoading(true);

    try {
      // TODO: Replace with actual OpenAI API call
      const response = await generateDummyChatResponse(currentMessage, currentContext, mainContent);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Clear context after sending
      setCurrentContext('');
      
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const clearContext = () => {
    setCurrentContext('');
  };

  // Helper functions for dummy data (TODO: Replace with actual LLM calls)
  const transformDiffToIdentityFacets = (diffResult: IdentityDiffResult): IdentityFacet[] => {
    const facets: IdentityFacet[] = [];

    // Analyze affective themes
    const affectiveComparisons = diffResult.holistic.filter(c => c.category === 'affective');
    if (affectiveComparisons.length > 0) {
      facets.push({
        category: 'affective',
        description: 'Emotional tone and affective patterns',
        mainScore: 0.7,
        comparisonScore: 0.8,
        analysis: affectiveComparisons[0]?.explanation || 'Emotional narrative patterns analyzed',
        suggestions: [
          'Consider integrating more redemptive sequences',
          'Balance negative and positive emotional content',
          'Strengthen emotional resilience themes'
        ]
      });
    }

    // Analyze motivational themes
    const motivationalComparisons = diffResult.holistic.filter(c => c.category === 'motivational');
    if (motivationalComparisons.length > 0) {
      facets.push({
        category: 'motivational',
        description: 'Agency and communion themes',
        mainScore: 0.6,
        comparisonScore: 0.75,
        analysis: motivationalComparisons[0]?.explanation || 'Agency/communion balance analyzed',
        suggestions: [
          'Enhance agency themes around personal control',
          'Integrate more communion-oriented experiences',
          'Balance individual achievement with relational themes'
        ]
      });
    }

    return facets;
  };

  const generateDummyReconciliationSuggestions = async (): Promise<ReconciliationSuggestion[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return [
      {
        type: 'reconciliation',
        priority: 'high',
        description: 'Integrate conflicting identity representations',
        explanation: 'Your narratives show tension between achievement-focused and relationship-focused identity. This is common in emerging adulthood.',
        actionable: 'Create a "bridge narrative" that shows how both aspects can coexist in your identity.'
      },
      {
        type: 'addition',
        priority: 'medium',
        description: 'Reveal more vulnerable aspects',
        explanation: 'Your comparison version shows increased openness about struggles and growth.',
        actionable: 'Consider incorporating 1-2 specific examples of overcoming challenges from your comparison version.'
      },
      {
        type: 'filtering',
        priority: 'medium',
        description: 'Adjust narrative for different audiences',
        explanation: 'Different supporters may need different levels of detail about personal struggles.',
        actionable: 'Create audience-specific versions: detailed for therapeutic contexts, moderate for mentors.'
      },
      {
        type: 'awareness',
        priority: 'low',
        description: 'Recognize multiple identity facets',
        explanation: 'Your analysis shows you have rich, multifaceted identity representation.',
        actionable: 'Reflect on how different aspects of yourself emerge in different contexts.'
      }
    ];
  };

  const generateDummyChatResponse = async (message: string, context: string, content: TiptapDocument): Promise<string> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (context) {
      return `Based on the selected text "${context.substring(0, 50)}...", I can see this relates to identity themes around personal growth and self-reflection. This passage shows elements of both agency (taking control) and meaning-making (learning from experience). Would you like me to suggest how this might connect to other parts of your narrative?`;
    }
    
    if (message.toLowerCase().includes('identity')) {
      return `Your narrative shows strong identity development patterns. I notice themes of growth, self-reflection, and evolving relationships. The comparison between your versions suggests you're developing a more integrated sense of self. What specific aspect of your identity development would you like to explore further?`;
    }
    
    if (message.toLowerCase().includes('theme')) {
      return `The main themes I see in your writing include personal agency, meaningful relationships, overcoming challenges, and self-discovery. These are common in emerging adult narratives. Which theme resonates most strongly with your current life experience?`;
    }
    
    return `I'm analyzing your narrative for identity themes, emotional patterns, and personal growth indicators. Feel free to select specific text from your writing and ask me about identity patterns, themes, or how different versions compare. What would you like to explore?`;
  };

  return (
    <div className="ai-tool-wrapper enhanced">
      <div className="enhanced-ai-header">
        <h3>🧰 AI Toolbox</h3>
        <div className="tab-selector">
          {/* Analysis tab temporarily hidden
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`tab-button ${activeTab === 'analysis' ? 'active' : ''}`}
          >
            Analysis
          </button>
          */}
          <button 
            onClick={() => setActiveTab('chat')}
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
          >
            Chat
          </button>
          <button 
            onClick={() => setActiveTab('reconciliation')}
            className={`tab-button ${activeTab === 'reconciliation' ? 'active' : ''}`}
          >
            Reconciliation
          </button>
        </div>
      </div>

      <div className="enhanced-ai-content">
        {activeTab === 'analysis' && (
          <div className="analysis-tab">
            <div className="tab-header">
              <h4>Identity Diff Analysis</h4>
              <button 
                onClick={runIdentityAnalysis}
                disabled={isAnalyzing || !comparisonContent}
                className="run-analysis-button"
              >
                {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
              </button>
            </div>
            
            <p className="tab-description">
              Analyzes affective, motivational, integrative, and structural differences between narrative versions.
            </p>

            {identityAnalysis.length > 0 ? (
              <div className="identity-facets">
                {identityAnalysis.map((facet, index) => (
                  <div key={index} className={`identity-facet ${facet.category}`}>
                    <div className="facet-header">
                      <h5>{facet.category.toUpperCase()}</h5>
                      <div className="facet-scores">
                        <span>Main: {(facet.mainScore * 100).toFixed(0)}%</span>
                        {facet.comparisonScore && (
                          <span>Comp: {(facet.comparisonScore * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                    <p className="facet-description">{facet.description}</p>
                    <p className="facet-analysis">{facet.analysis}</p>
                    <div className="facet-suggestions">
                      <strong>Suggestions:</strong>
                      <ul>
                        {facet.suggestions.map((suggestion, idx) => (
                          <li key={idx}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-analysis">
                {comparisonContent ? 
                  'Click "Run Analysis" to compare identity themes between versions.' :
                  'Select a version to compare first.'
                }
              </div>
            )}
          </div>
        )}

        {activeTab === 'reconciliation' && (
          <div className="reconciliation-tab">
            <div className="tab-header">
              <h4>Identity Reconciliation</h4>
              <button 
                onClick={generateReconciliationSuggestions}
                disabled={isAnalyzing || !comparisonContent}
                className="run-analysis-button"
              >
                {isAnalyzing ? 'Generating...' : 'Generate Suggestions'}
              </button>
            </div>
            
            <p className="tab-description">
              Provides suggestions for reconciling identity divergences and managing multiple identity facets.
            </p>

            {reconciliationSuggestions.length > 0 ? (
              <div className="reconciliation-suggestions">
                {reconciliationSuggestions.map((suggestion, index) => (
                  <div key={index} className={`suggestion ${suggestion.type} ${suggestion.priority}`}>
                    <div className="suggestion-header">
                      <span className={`suggestion-type ${suggestion.type}`}>
                        {suggestion.type.toUpperCase()}
                      </span>
                      <span className={`priority-badge ${suggestion.priority}`}>
                        {suggestion.priority}
                      </span>
                    </div>
                    <h5>{suggestion.description}</h5>
                    <p className="suggestion-explanation">{suggestion.explanation}</p>
                    <div className="suggestion-action">
                      <strong>Action:</strong> {suggestion.actionable}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-analysis">
                {comparisonContent ? 
                  'Click "Generate Suggestions" to get reconciliation recommendations.' :
                  'Select a version to compare first.'
                }
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="chat-tab">
            <h4>Contextual AI Chat</h4>
            <p className="tab-description">
              Select text from your main narrative to add context, then ask questions about themes, patterns, or get writing advice.
            </p>

            {/* Context Display */}
            {currentContext && (
              <div className="current-context">
                <div className="context-header">
                  <strong>Selected Context:</strong>
                  <button onClick={clearContext} className="clear-context">×</button>
                </div>
                <div className="context-text">
                  "{currentContext.substring(0, 100)}{currentContext.length > 100 ? '...' : ''}"
                </div>
              </div>
            )}

            {/* Chat Messages */}
            <div className="chat-messages">
              {chatMessages.length === 0 ? (
                <div className="chat-empty">
                  <p>Start a conversation about your writing, identity themes, or narrative patterns.</p>
                </div>
              ) : (
                chatMessages.map((message) => (
                  <div key={message.id} className={`chat-message ${message.role}`}>
                    <div className="message-content">
                      {message.content}
                    </div>
                    {message.context && (
                      <div className="message-context">
                        Context: "{message.context.substring(0, 50)}..."
                      </div>
                    )}
                    <div className="message-timestamp">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="chat-message assistant loading">
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="chat-input-section">
              <div className="chat-input-wrapper">
                <textarea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  className="chat-input"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                />
                <button 
                  onClick={sendChatMessage}
                  disabled={!currentMessage.trim() || isChatLoading}
                  className="send-button"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedAITool; 