import React, { useState, useCallback } from 'react';
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
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');

  // Add selected text to context
  const addToContext = useCallback(() => {
    if (selectedText && selectedText.trim()) {
      const newContext: ContextItem = {
        id: Date.now().toString(),
        text: selectedText.trim(),
        timestamp: new Date()
      };
      setContextItems(prev => [...prev, newContext]);
    } else if (onRequestTextSelection) {
      onRequestTextSelection();
    }
  }, [selectedText, onRequestTextSelection]);

  // Remove context item
  const removeContext = (id: string) => {
    setContextItems(prev => prev.filter(item => item.id !== id));
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

  // Chat with context
  const sendChatMessage = useCallback(async () => {
    if (!currentMessage.trim()) return;
    
    const userMessage = currentMessage.trim();
    setCurrentMessage('');
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
          contextItems,
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
  }, [currentMessage, mainContent, comparisonContent, contextItems, chatHistory]);

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

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="ai-tab-content">
          <div className="ai-section">
            <h3>AI Chat with Context</h3>
            
            {/* Context Management */}
            <div className="context-section">
              <div className="context-header">
                <h4>Selected Context</h4>
                <button 
                  onClick={addToContext}
                  className="ai-button secondary small"
                >
                  {selectedText ? 'Add Selected Text' : 'Select Text to Add'}
                </button>
              </div>
              
              {contextItems.length > 0 ? (
                <div className="context-items">
                  {contextItems.map(item => (
                    <div key={item.id} className="context-item">
                      <div className="context-text">"{item.text}"</div>
                      <button 
                        onClick={() => removeContext(item.id)}
                        className="context-remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-context">No context selected. Select text in your document and click "Add Selected Text".</p>
              )}
            </div>

            {/* Chat History */}
            <div className="chat-history">
              {chatHistory.map((message, index) => (
                <div key={index} className={`chat-message ${message.role}`}>
                  <div className="message-content">{message.content}</div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
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