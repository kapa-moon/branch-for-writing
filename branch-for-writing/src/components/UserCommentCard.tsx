'use client';

import React, { useState } from 'react';
import { UserComment } from '@/types/comments';

interface UserCommentCardProps {
  comment: UserComment;
  onResolve: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onEdit?: (commentId: string, newText: string) => void;
  onHighlightText?: (text: string) => void;
  isActive?: boolean;
  onClick?: () => void;
}

const UserCommentCard: React.FC<UserCommentCardProps> = ({
  comment,
  onResolve,
  onDelete,
  onEdit,
  onHighlightText,
  isActive = false,
  onClick
}) => {
  const [showConfirm, setShowConfirm] = useState<'delete' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const truncateText = (text: string, maxLength: number = 60) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const handleSaveEdit = () => {
    if (editText.trim() && onEdit) {
      onEdit(comment.id, editText.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditText(comment.text);
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <div 
      className={`comment-card user-comment ${comment.resolved ? 'resolved' : ''} ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        {/* Left side: Profile icon and timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#e3f2fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '600',
            color: '#1976d2'
          }}>
            👤
          </div>
          <span style={{
            fontSize: '0.65rem',
            color: '#6c757d',
            fontWeight: '400'
          }}>
            {formatDate(comment.createdAt)}
          </span>
          {comment.resolved && (
            <span style={{
              fontSize: '0.6rem',
              color: '#28a745',
              fontWeight: '500'
            }}>
              ✓ Resolved
            </span>
          )}
        </div>

        {/* Right side: Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!comment.resolved && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onResolve(comment.id);
              }}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: '1px solid #28a745',
                backgroundColor: 'white',
                color: '#28a745',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 'bold'
              }}
              title="Resolve comment"
            >
              ✓
            </button>
          )}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowConfirm('delete');
            }}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '1px solid #dc3545',
              backgroundColor: 'white',
              color: '#dc3545',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.7rem'
            }}
            title="Delete comment"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="comment-card-content">
        <div className="comment-metadata">
          <span className="comment-author">{comment.authorName}</span>
        </div>
        
        {isEditing ? (
          <div className="comment-edit-container">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
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
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <div style={{ fontSize: '0.6rem', color: '#999' }}>
                Cmd+Enter to save, Esc to cancel
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={handleCancelEdit}
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
                  onClick={handleSaveEdit}
                  disabled={!editText.trim()}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.65rem',
                    border: '1px solid #007bff',
                    borderRadius: '3px',
                    background: editText.trim() ? '#007bff' : '#ccc',
                    color: 'white',
                    cursor: editText.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p 
            className="comment-text" 
            onClick={onEdit ? () => setIsEditing(true) : undefined}
            style={{ 
              cursor: onEdit ? 'pointer' : 'default',
              padding: onEdit ? '2px' : '0',
              borderRadius: onEdit ? '2px' : '0',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              if (onEdit) e.currentTarget.style.background = '#f8f9fa';
            }}
            onMouseLeave={(e) => {
              if (onEdit) e.currentTarget.style.background = 'transparent';
            }}
          >
            {comment.text}
          </p>
        )}
      </div>

      {/* Confirmation modal for delete */}
      {showConfirm === 'delete' && (
        <div className="comment-confirm-overlay">
          <div className="comment-confirm-modal">
            <p>Delete this comment?</p>
            <div className="comment-confirm-actions">
              <button 
                onClick={() => {
                  onDelete(comment.id);
                  setShowConfirm(null);
                }}
                className="confirm-delete-btn"
              >
                Delete
              </button>
              <button 
                onClick={() => setShowConfirm(null)}
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

export default UserCommentCard; 