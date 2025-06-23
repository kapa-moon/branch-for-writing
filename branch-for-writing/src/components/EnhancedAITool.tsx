import React, { useState, useCallback, useEffect } from 'react';
import { TiptapDocument } from '@/types/tiptap';
import { DocumentDiffEngine } from '@/lib/diffEngine';
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
  facet: string;
  mainVersion: string;
  comparisonVersion: string;
  evidence: string[];
}

interface ReconciliationSuggestion {
  type: 'addition' | 'filtering' | 'awareness';
  suggestion: string;
  reasoning: string;
}

const EnhancedAITool: React.FC<EnhancedAIToolProps> = ({ 
  mainContent, 
  comparisonContent,
  selectedText,
  onRequestTextSelection
}) => {
  const [activeTab, setActiveTab] = useState<'analysis' | 'reconciliation' | 'chat'>('analysis');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Identity Analysis State
  const [identityAnalysis, setIdentityAnalysis] = useState<IdentityFacet[]>([]);
  
  // Reconciliation State  
  const [reconciliationSuggestions, setReconciliationSuggestions] = useState<ReconciliationSuggestion[]>([]);
  
  // Chat State
  const [currentContext, setCurrentContext] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');

  // CLEANED UP: Manual add without excessive feedback
  const addToContext = useCallback(() => {
    if (!selectedText || selectedText.trim().length <= 3) {
      alert('Please select text in the main editor first.');
      return;
    }

    const textToAdd = selectedText.trim();
    
    // Check if this is the same text as already in context
    if (currentContext === textToAdd) {
      return; // Silently ignore if same text
    }

    // Add to context
    setCurrentContext(textToAdd);
  }, [selectedText, currentContext]);

  // Clear context
  const clearContext = () => {
    setCurrentContext('');
  };

  // Identity Diff Analysis
  const analyzeIdentityDifferences = useCallback(async () => {
    if (!comparisonContent) {
      alert('Please select a version to compare first.');
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/identity-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainContent,
          comparisonContent
        })
      });
      
      const result = await response.json();
      setIdentityAnalysis(result.identityFacets || []);
    } catch (error) {
      console.error('Identity analysis failed:', error);
      alert('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [mainContent, comparisonContent]);

  // Reconciliation Analysis
  const generateReconciliation = useCallback(async () => {
    if (identityAnalysis.length === 0) {
      alert('Please run Identity Analysis first.');
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityDifferences: identityAnalysis,
          mainContent,
          comparisonContent
        })
      });
      
      const result = await response.json();
      setReconciliationSuggestions(result.suggestions || []);
    } catch (error) {
      console.error('Reconciliation analysis failed:', error);
      alert('Reconciliation analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [identityAnalysis, mainContent, comparisonContent]);

  // FIXED: Chat with context and clear after sending
  const sendChatMessage = useCallback(async () => {
    if (!currentMessage.trim()) return;
    
    const userMessage = currentMessage.trim();
    const contextForThisMessage = currentContext; // Capture current context
    
    // Clear inputs immediately
    setCurrentMessage('');
    setCurrentContext(''); // FIXED: Clear context after sending
    
    // Add user message to history
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          mainContent,
          comparisonContent,
          selectedContext: contextForThisMessage, // Send the context that was selected
          chatHistory
        })
      });
      
      const result = await response.json();
      setChatHistory(prev => [...prev, { role: 'assistant', content: result.response }]);
    } catch (error) {
      console.error('Chat failed:', error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsAnalyzing(false);
    }
  }, [currentMessage, currentContext, mainContent, comparisonContent, chatHistory]);

  return (
    <div className="ai-tool-wrapper enhanced">
      {/* Tab Navigation */}
      <div className="ai-tabs">
        <button 
          className={`ai-tab ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          Identity Analysis
        </button>
        <button 
          className={`ai-tab ${activeTab === 'reconciliation' ? 'active' : ''}`}
          onClick={() => setActiveTab('reconciliation')}
        >
          Reconciliation
        </button>
        <button 
          className={`ai-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          AI Chat
        </button>
      </div>

      {/* Identity Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="ai-tab-content">
          <div className="ai-section">
            <h3>Identity Difference Analysis</h3>
            <p className="ai-description">
              Analyzes how you present different aspects of your identity across versions.
            </p>
            
            <button 
              onClick={analyzeIdentityDifferences}
              disabled={!comparisonContent || isAnalyzing}
              className="ai-button primary"
            >
              {isAnalyzing ? 'Analyzing Identity Themes...' : 'Analyze Identity Differences'}
            </button>
            
            {identityAnalysis.length > 0 && (
              <div className="analysis-results">
                <h4>Identity Facets Found:</h4>
                {identityAnalysis.map((facet, index) => (
                  <div key={index} className="identity-facet">
                    <h5>{facet.facet}</h5>
                    <div className="facet-comparison">
                      <div className="version main-version">
                        <strong>Current Version:</strong> {facet.mainVersion}
                      </div>
                      <div className="version comparison-version">
                        <strong>Saved Version:</strong> {facet.comparisonVersion}
                      </div>
                    </div>
                    {facet.evidence.length > 0 && (
                      <div className="evidence">
                        <strong>Evidence:</strong>
                        <ul>
                          {facet.evidence.map((evidence, i) => (
                            <li key={i}>{evidence}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reconciliation Tab */}
      {activeTab === 'reconciliation' && (
        <div className="ai-tab-content">
          <div className="ai-section">
            <h3>Identity Reconciliation</h3>
            <p className="ai-description">
              Get suggestions on how to handle identity differences across versions.
            </p>
            
            <button 
              onClick={generateReconciliation}
              disabled={identityAnalysis.length === 0 || isAnalyzing}
              className="ai-button primary"
            >
              {isAnalyzing ? 'Generating Suggestions...' : 'Get Reconciliation Suggestions'}
            </button>
            
            {reconciliationSuggestions.length > 0 && (
              <div className="reconciliation-results">
                <h4>Reconciliation Strategies:</h4>
                {reconciliationSuggestions.map((suggestion, index) => (
                  <div key={index} className={`reconciliation-item ${suggestion.type}`}>
                    <div className="suggestion-header">
                      <span className={`suggestion-type ${suggestion.type}`}>
                        {suggestion.type === 'addition' ? '🔍 Addition (Revealing)' : 
                         suggestion.type === 'filtering' ? '🛡️ Filtering (Comfortable Sharing)' : 
                         '🧠 Awareness (Multiple Facets)'}
                      </span>
                    </div>
                    <div className="suggestion-content">
                      <p><strong>Suggestion:</strong> {suggestion.suggestion}</p>
                      <p><strong>Why:</strong> {suggestion.reasoning}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLEANED UP: Chat Tab */}
      {activeTab === 'chat' && (
        <div className="ai-tab-content">
          <div className="ai-section">
            <h3>AI Chat with Context</h3>
            
            {/* CLEANED UP: Context Management */}
            <div className="context-section">
              <div className="context-header">
                <h4>Selected Context</h4>
                <button 
                  onClick={addToContext}
                  className={`ai-button secondary small ${selectedText && selectedText.length > 3 ? 'highlight' : ''}`}
                  disabled={!selectedText || selectedText.length <= 3}
                >
                  {selectedText && selectedText.length > 3 ? 'Add Selected Text' : 'Select Text First'}
                </button>
              </div>
              
              {currentContext ? (
                <div className="context-display">
                  <div className="context-item active">
                    <div className="context-text">
                      "{currentContext.length > 150 ? currentContext.substring(0, 150) + '...' : currentContext}"
                    </div>
                    <button 
                      onClick={clearContext}
                      className="context-remove"
                      title="Clear context"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                <div className="no-context-guide">
                  <p className="no-context">No context selected yet.</p>
                  <div className="context-steps">
                    <small>
                      <strong>How to add context:</strong><br/>
                      1. Select text in the main editor (left panel)<br/>
                      2. Click "Add Selected Text" button above<br/>
                      3. Ask your question with that context
                    </small>
                  </div>
                </div>
              )}
            </div>

            {/* Chat History */}
            <div className="chat-history">
              {chatHistory.length === 0 && (
                <div className="chat-placeholder">
                  <p>💬 Start a conversation about your writing!</p>
                  <small>Tip: Add context first to get more specific help.</small>
                </div>
              )}
              {chatHistory.map((message, index) => (
                <div key={index} className={`chat-message ${message.role}`}>
                  <div className="message-content">{message.content}</div>
                </div>
              ))}
            </div>

            {/* CLEANED UP: Chat Input */}
            <div className="chat-input-section">
              <div className="chat-input-wrapper">
                <textarea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Ask about your writing, identity themes, or get advice..."
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
                  disabled={!currentMessage.trim() || isAnalyzing}
                  className="chat-send-button"
                >
                  {isAnalyzing ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedAITool; 