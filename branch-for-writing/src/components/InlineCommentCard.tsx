'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UserComment } from '@/types/comments';

interface InlineCommentCardProps {
  selectedText: string;
  authorName: string;
  authorEmail: string;
  onSave: (commentText: string) => void;
  onCancel: () => void;
  position?: { from: number; to: number };
}

const InlineCommentCard: React.FC<InlineCommentCardProps> = ({
  selectedText,
  authorName,
  authorEmail,
  onSave,
  onCancel,
  position
}) => {
  const [commentText, setCommentText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSave = () => {
    if (commentText.trim()) {
      onSave(commentText.trim());
      setCommentText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const truncateText = (text: string, maxLength: number = 60) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="comment-card user-comment inline-edit">
      <div className="comment-card-header">
        <div className="card-badges">
          <span className="comment-type-badge user-comment-badge">
            💬 New Comment
          </span>
        </div>
        
        <div className="card-actions">
          <button 
            onClick={onCancel}
            className="action-btn ignore-btn"
            title="Cancel comment"
            style={{ fontSize: '0.6rem', padding: '2px 6px' }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="comment-card-content">
        <div className="comment-metadata">
          <span className="comment-author">{authorName}</span>
          <span className="comment-date">now</span>
        </div>
        
        <textarea
          ref={textareaRef}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add your comment..."
          style={{
            width: '100%',
            minHeight: '60px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '6px',
            fontSize: '0.75rem',
            fontFamily: 'Atkinson Hyperlegible, serif',
            resize: 'vertical',
            outline: 'none',
            marginBottom: '8px'
          }}
        />

        {/* Action buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div style={{ fontSize: '0.6rem', color: '#999' }}>
            Cmd+Enter to save
          </div>
          
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '3px 8px',
                fontSize: '0.65rem',
                border: '1px solid #ddd',
                borderRadius: '3px',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!commentText.trim()}
              style={{
                padding: '3px 8px',
                fontSize: '0.65rem',
                border: '1px solid #007bff',
                borderRadius: '3px',
                background: commentText.trim() ? '#007bff' : '#ccc',
                color: 'white',
                cursor: commentText.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InlineCommentCard; 