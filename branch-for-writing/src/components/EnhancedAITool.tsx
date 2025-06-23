import React, { useState, useCallback } from 'react';
import { TiptapDocument } from '@/types/tiptap';
import { DocumentDiffEngine } from '@/lib/diffEngine';
import './ai-tool.css';

interface EnhancedAIToolProps {
  mainContent: TiptapDocument;
  comparisonContent?: TiptapDocument;
}

const EnhancedAITool: React.FC<EnhancedAIToolProps> = ({ 
  mainContent, 
  comparisonContent 
}) => {
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [writingPrompts, setWritingPrompts] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'prompts' | 'insights'>('analysis');

  const analyzeIdentityThemes = useCallback(async () => {
    if (!comparisonContent) {
      setAnalysisResult('Please select a version to compare first.');
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/analyze-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainContent,
          comparisonContent
        })
      });
      
      const result = await response.json();
      setAnalysisResult(result.analysis || 'No significant changes detected.');
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysisResult('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [mainContent, comparisonContent]);

  const generateWritingPrompts = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/writing-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: mainContent })
      });
      
      const result = await response.json();
      setWritingPrompts(result.prompts || []);
    } catch (error) {
      console.error('Prompt generation failed:', error);
      setWritingPrompts(['Failed to generate prompts. Please try again.']);
    } finally {
      setIsAnalyzing(false);
    }
  }, [mainContent]);

  const getQuickInsights = useCallback(() => {
    if (!comparisonContent) return;
    
    const diffEngine = new DocumentDiffEngine();
    const segments = diffEngine.generateSemanticDiff(mainContent, comparisonContent);
    const summary = diffEngine.getDiffSummary(segments);
    
    const insights = [
      `${summary.added} new sections added`,
      `${summary.modified} sections modified`,
      `${summary.deleted} sections removed`,
      `${Math.round((summary.added + summary.modified) / segments.length * 100)}% content changed`
    ];
    
    setAnalysisResult(insights.join('\n'));
  }, [mainContent, comparisonContent]);

  return (
    <div className="ai-tool-wrapper enhanced">
      {/* Tab Navigation */}
      <div className="ai-tabs">
        <button 
          className={`ai-tab ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          Analysis
        </button>
        <button 
          className={`ai-tab ${activeTab === 'prompts' ? 'active' : ''}`}
          onClick={() => setActiveTab('prompts')}
        >
          Prompts
        </button>
        <button 
          className={`ai-tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          Insights
        </button>
      </div>

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="column column-1">
          <h3>Identity Analysis</h3>
          <div className="ai-buttons-group">
            <button 
              onClick={analyzeIdentityThemes}
              disabled={!comparisonContent || isAnalyzing}
              className="ai-button primary"
            >
              {isAnalyzing ? 'Analyzing...' : 'Deep Analysis'}
            </button>
            <button 
              onClick={getQuickInsights}
              disabled={!comparisonContent}
              className="ai-button secondary"
            >
              Quick Insights
            </button>
          </div>
          
          {analysisResult && (
            <div className="analysis-result">
              <h4>Analysis Results:</h4>
              <div className="result-content">
                {analysisResult.split('\n').map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Writing Prompts Tab */}
      {activeTab === 'prompts' && (
        <div className="column column-2">
          <h3>Writing Prompts</h3>
          <button 
            onClick={generateWritingPrompts}
            disabled={isAnalyzing}
            className="ai-button primary"
          >
            {isAnalyzing ? 'Generating...' : 'Generate Prompts'}
          </button>
          
          {writingPrompts.length > 0 && (
            <div className="prompts-list">
              {writingPrompts.map((prompt, index) => (
                <div key={index} className="prompt-item">
                  <p>{prompt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Insights Tab */}
      {activeTab === 'insights' && (
        <div className="column column-3">
          <h3>Quick Actions</h3>
          <div className="grid-container">
            <div className="grid-item grid-1">
              <button className="grid-button" onClick={() => setActiveTab('analysis')}>
                Compare Themes
              </button>
            </div>
            <div className="grid-item grid-2">
              <button className="grid-button" onClick={() => setActiveTab('prompts')}>
                Get Prompts
              </button>
            </div>
            <div className="grid-item grid-3">
              <button className="grid-button" onClick={getQuickInsights}>
                Summary Stats
              </button>
            </div>
            <div className="grid-item grid-4">
              <button className="grid-button">
                Export Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedAITool; 