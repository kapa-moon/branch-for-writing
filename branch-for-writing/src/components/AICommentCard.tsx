'use client';

import React, { useState, useRef, useEffect } from 'react';

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

interface AICommentCardProps {
  id: string;
  type: 'overlapping' | 'unique' | 'conflicting';
  timestamp: string;
  insight: string;
  socraticPrompt: string;
  evidence: Evidence[];
  isActive?: boolean;
  isResolved?: boolean;
  onResolve?: (id: string) => void;
  onEvidenceClick?: (evidence: Evidence) => void;
  onActivate?: (id: string) => void;
  userReflections?: UserReflection[];
  chatThreads?: ChatThread[];
  activeThreadId?: string | null;
  onSendReflection?: (id: string, reflection: string) => void;
  onStartChat?: (id: string, question: string) => void;
  onContinueChat?: (id: string, threadId: string, message: string) => void;
  onFinishChat?: (id: string, threadId: string) => void;
  onToggleThread?: (id: string, threadId: string) => void;
}

const AICommentCard: React.FC<AICommentCardProps> = ({
  id,
  type,
  timestamp,
  insight,
  socraticPrompt,
  evidence,
  isActive = false,
  isResolved = false,
  onResolve,
  onEvidenceClick,
  onActivate,
  userReflections = [],
  chatThreads = [],
  activeThreadId = null,
  onSendReflection,
  onStartChat,
  onContinueChat,
  onFinishChat,
  onToggleThread
}) => {
  const [userInput, setUserInput] = useState('');
  const [hoveredEvidence, setHoveredEvidence] = useState<string | null>(null);
  const [clickedEvidence, setClickedEvidence] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Add CSS for hiding scrollbar
  React.useEffect(() => {
    if (!document.getElementById('no-scrollbar-style')) {
      const style = document.createElement('style');
      style.id = 'no-scrollbar-style';
      style.textContent = `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const getIconColor = () => {
    switch (type) {
      case 'overlapping': return '#f0f9f0'; // very light green
      case 'unique': return '#f5f0ff'; // very light purple
      case 'conflicting': return '#fff5f0'; // very light orange
      default: return '#f8f9fa';
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'overlapping': return 'Overlapping';
      case 'unique': return 'Unique';
      case 'conflicting': return 'Conflicting';
      default: return 'Insight';
    }
  };

  const handleEvidenceClick = (evidenceItem: Evidence) => {
    setClickedEvidence(evidenceItem.id);
    onEvidenceClick?.(evidenceItem);
    setTimeout(() => setClickedEvidence(null), 2000); // Clear after 2 seconds
  };

  const handleSendReflection = () => {
    if (userInput.trim() && onSendReflection) {
      onSendReflection(id, userInput.trim());
      setUserInput('');
    }
  };

  const handleStartChat = () => {
    if (userInput.trim()) {
      if (activeThreadId && onContinueChat) {
        // Continue existing thread
        onContinueChat(id, activeThreadId, userInput.trim());
      } else if (onStartChat) {
        // Start new thread
        onStartChat(id, userInput.trim());
      }
      setUserInput('');
    }
  };

  const handleFinishChat = () => {
    if (activeThreadId && onFinishChat) {
      onFinishChat(id, activeThreadId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendReflection();
    }
  };

  return (
    <div 
      className={`ai-comment-card ${isActive ? 'active' : ''} ${isResolved ? 'resolved' : ''}`}
      onClick={() => onActivate?.(id)}
      style={{
        background: 'white',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '8px',
        cursor: 'pointer',
        boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        transition: 'box-shadow 0.2s ease',
        opacity: isResolved ? 0.6 : 1
      }}
    >
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        {/* Left side: AI icon and timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: getIconColor(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '600',
            color: '#495057'
          }}>
            AI
          </div>
          <span style={{
            fontSize: '0.65rem',
            color: '#6c757d',
            fontWeight: '400'
          }}>
            {timestamp}
          </span>
        </div>

        {/* Right side: Evidence circles and resolve button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Evidence circles */}
          {evidence.map((item, index) => (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                handleEvidenceClick(item);
              }}
              onMouseEnter={() => setHoveredEvidence(item.id)}
              onMouseLeave={() => setHoveredEvidence(null)}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: '1px solid #6c757d',
                backgroundColor: clickedEvidence === item.id 
                  ? '#ffeb3b' 
                  : hoveredEvidence === item.id 
                    ? '#fff9c4' 
                    : 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6rem',
                fontWeight: '600',
                color: '#495057',
                transition: 'all 0.2s ease'
              }}
              title={`Evidence: ${item.text.substring(0, 50)}...`}
            >
              {index + 1}
            </div>
          ))}
          
          {/* Resolve button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResolve?.(id);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: isResolved ? '#28a745' : '#6c757d',
              padding: '2px'
            }}
            title={isResolved ? 'Resolved' : 'Mark as resolved'}
          >
            {isResolved ? '✓' : '○'}
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ marginBottom: '12px' }}>
        {/* AI Insights */}
        <p style={{
          fontSize: '0.8rem',
          color: '#2d3748',
          margin: '0 0 8px 0',
          lineHeight: '1.4',
          fontWeight: '400'
        }}>
          {insight}
        </p>

        {/* Socratic Prompt */}
        <p style={{
          fontSize: '0.75rem',
          color: '#6b46c1',
          margin: '0',
          lineHeight: '1.4',
          fontWeight: '300',
          fontStyle: 'italic'
        }}>
          {socraticPrompt}
        </p>
      </div>

      {/* User Reflections */}
      {userReflections.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {userReflections.map((reflection) => (
            <div
              key={reflection.id}
              style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                padding: '8px',
                marginBottom: '6px',
                borderLeft: '3px solid #007bff'
              }}
            >
              <div style={{
                fontSize: '0.7rem',
                lineHeight: '1.4',
                color: '#2d3748',
                marginBottom: '4px'
              }}>
                {reflection.text}
              </div>
              <div style={{
                fontSize: '0.6rem',
                color: '#6c757d'
              }}>
                {reflection.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat Threads */}
      {chatThreads.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {chatThreads.map((thread) => (
            <div key={thread.id} style={{ marginBottom: '8px' }}>
              {/* Thread Header - Clickable to expand/collapse */}
              <div
                onClick={() => onToggleThread?.(id, thread.id)}
                style={{
                  backgroundColor: '#f0f8ff',
                  borderRadius: '6px',
                  padding: '8px',
                  cursor: 'pointer',
                  borderLeft: '3px solid #6f42c1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{
                    fontSize: '0.7rem',
                    lineHeight: '1.4',
                    color: '#2d3748',
                    marginBottom: '2px'
                  }}>
                    {thread.initialQuestion}
                  </div>
                  <div style={{
                    fontSize: '0.6rem',
                    color: '#6c757d'
                  }}>
                    {thread.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {thread.messages.length} messages
                  </div>
                </div>
                <div style={{
                  fontSize: '0.7rem',
                  color: '#6c757d'
                }}>
                  {thread.isExpanded ? '▼' : '▶'}
                </div>
              </div>

              {/* Thread Messages - Only show when expanded */}
              {thread.isExpanded && (
                <div style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  padding: '8px',
                  marginTop: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {thread.messages.map((message) => (
                    <div
                      key={message.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px',
                        marginBottom: '6px'
                      }}
                    >
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: message.type === 'ai' ? getIconColor() : '#e9ecef',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: '600',
                        color: '#495057',
                        flexShrink: 0
                      }}>
                        {message.type === 'ai' ? 'AI' : 'U'}
                      </div>
                      <div style={{
                        backgroundColor: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        lineHeight: '1.3',
                        flex: 1
                      }}>
                        {message.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom Input Area - Hidden when resolved */}
      {!isResolved && (
        <div style={{
          border: '1px solid #e9ecef',
          borderRadius: '6px',
          padding: '4px'
        }}>
          <textarea
            ref={textareaRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your reflection or question..."
            style={{
              width: '100%',
              minHeight: '28px',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: '0.75rem',
              fontFamily: 'inherit',
              lineHeight: '1.3',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              overflowY: 'auto'
            }}
            className="no-scrollbar"
          />
          
          {/* Bottom buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '2px',
            marginTop: '0px'
          }}>
            <button
              onClick={handleSendReflection}
              disabled={!userInput.trim()}
              style={{
                background: 'none',
                color: userInput.trim() ? '#6c757d' : '#adb5bd',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.65rem',
                cursor: userInput.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (userInput.trim()) {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.color = '#000';
                }
              }}
              onMouseLeave={(e) => {
                if (userInput.trim()) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6c757d';
                }
              }}
            >
              Reply
            </button>
            <button
              onClick={handleStartChat}
              disabled={!userInput.trim()}
              style={{
                background: 'none',
                color: userInput.trim() ? '#6c757d' : '#adb5bd',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.65rem',
                cursor: userInput.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (userInput.trim()) {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.color = '#000';
                }
              }}
              onMouseLeave={(e) => {
                if (userInput.trim()) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6c757d';
                }
              }}
            >
              {activeThreadId ? 'Continue' : 'Ask AI'}
            </button>
            {activeThreadId && (
              <button
                onClick={handleFinishChat}
                style={{
                  background: 'none',
                  color: '#6c757d',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.color = '#000';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6c757d';
                }}
                title="Finish this conversation thread"
              >
                Finish
              </button>
            )}
            <button
              onClick={() => setUserInput('')}
              style={{
                background: 'none',
                color: '#6c757d',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.65rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
                e.currentTarget.style.color = '#000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#6c757d';
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AICommentCard; 