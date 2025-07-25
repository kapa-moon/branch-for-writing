'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import TiptapEditor from '@/components/TiptapEditor';
import DiffTiptapEditor from '@/components/DiffTiptapEditor';
import CommentCards from '@/components/CommentCards';
import EnhancedAITool from '@/components/EnhancedAITool';
import CommentCreator from '@/components/CommentCreator';
import CommentTooltip from '@/components/CommentTooltip';
import './writing-canvas.css';
import { TiptapDocument } from '@/types/tiptap';
import { UserComment } from '@/types/comments';
import AITool from '@/components/AITool';
import { DocumentDiffEngine } from '@/lib/diffEngine';
// @ts-ignore - type provided by @tiptap/core at runtime, suppress if linter cannot resolve
import { Editor } from '@tiptap/core';

const LOCAL_STORAGE_KEY = 'tiptap-main-document';
const COMMENTS_STORAGE_KEY = 'tiptap-user-comments';

// Initial content if nothing is in local storage for the main editor
const defaultInitialMainDocContent: TiptapDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [],
    },
  ],
};

// Interface for version data
interface Version {
  id: string;
  name: string;
  timestamp: string;
  content: TiptapDocument;
  type?: 'saved_version' | 'named_version'; // NEW: Add type field
  createdAt?: string; // NEW: Add createdAt field
  merged?: boolean; // NEW: Add merged field
  discussionNotes?: string; // NEW: Add discussion notes field
  prepNotes?: string; // NEW: Add prep notes field
}

export default function WritingCanvasPage() {
  const { data: sessionData, isPending, error } = authClient.useSession();
  const router = useRouter();
  
  // Memoize currentUser to prevent unnecessary re-renders
  const currentUser = useMemo(() => {
    return sessionData?.user ? {
      id: sessionData.user.id || 'current-user-temp-id',
      name: sessionData.user.name,
      email: sessionData.user.email
    } : null;
  }, [sessionData?.user?.id, sessionData?.user?.name, sessionData?.user?.email]);
  
  const [mainDocumentContent, setMainDocumentContent] = useState<TiptapDocument>(defaultInitialMainDocContent);
  const [mainDocumentId, setMainDocumentId] = useState<string | null>(null); // NEW: Store main document ID for caching
  const [selectedReviewVersion, setSelectedReviewVersion] = useState<Version | null>(null);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [showCommentMargin, setShowCommentMargin] = useState<boolean>(false);
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState<boolean>(false);
  const [isAIToolOpen, setAIToolOpen] = useState<boolean>(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState<boolean>(false);
  const [isSavingVersion, setIsSavingVersion] = useState<boolean>(false);
  
  // Add this state variable with your other useState declarations (around line 48)
  const [selectedText, setSelectedText] = useState<string>('');



  // NEW: Add state for reference panel view mode
  const [referenceViewMode, setReferenceViewMode] = useState<'content' | 'discussion_notes'>('discussion_notes');

  // Article title state
  const [articleTitle, setArticleTitle] = useState<string>('Untitled Article');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);

  // Comment system state
  const [userComments, setUserComments] = useState<UserComment[]>([]);
  const [showCommentTooltip, setShowCommentTooltip] = useState<boolean>(false);
  const [commentTooltipPosition, setCommentTooltipPosition] = useState<{x: number, y: number} | null>(null);
  const [commentSelectedText, setCommentSelectedText] = useState<string>('');
  const [commentTextRange, setCommentTextRange] = useState<{from: number, to: number} | null>(null);
  const [inlineCommentData, setInlineCommentData] = useState<{
    selectedText: string;
    authorName: string;
    authorEmail: string;
    position: { from: number; to: number };
  } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [tooltipTimeoutId, setTooltipTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const mainEditorRef = React.useRef<Editor | null>(null);

  // Add new state variables after the existing ones (around line 60)
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);
  const [autoSaveIntervalId, setAutoSaveIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Add refs to track current values for auto-save
  const mainDocumentContentRef = React.useRef<TiptapDocument>(mainDocumentContent);
  const articleTitleRef = React.useRef<string>(articleTitle);

  // Update refs when state changes
  React.useEffect(() => {
    mainDocumentContentRef.current = mainDocumentContent;
  }, [mainDocumentContent]);

  React.useEffect(() => {
    articleTitleRef.current = articleTitle;
  }, [articleTitle]);

  // Load main document from local storage on mount
  useEffect(() => {
    // This logic is now handled in loadLatestMainDocument()
    // We'll let the database be the source of truth for the "current main document"
  }, []);

  // Load user comments from localStorage on mount
  useEffect(() => {
    try {
      const savedComments = localStorage.getItem(COMMENTS_STORAGE_KEY);
      if (savedComments) {
        const parsedComments = JSON.parse(savedComments);
        // Convert createdAt strings back to Date objects
        const commentsWithDates = parsedComments.map((comment: any) => ({
          ...comment,
          createdAt: new Date(comment.createdAt)
        }));
        setUserComments(commentsWithDates);
      }
    } catch (error) {
      console.error('Error loading user comments from localStorage:', error);
    }
  }, []);

  // Save user comments to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(userComments));
    } catch (error) {
      console.error('Error saving user comments to localStorage:', error);
    }
  }, [userComments]);

  // Close tooltip and dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Close comment tooltip
      if (showCommentTooltip) {
        if (!target.closest('.comment-tooltip') && !target.closest('.ProseMirror')) {
          setShowCommentTooltip(false);
          setCommentTooltipPosition(null);
        }
      }
      
      // Close version dropdown
      if (isVersionDropdownOpen) {
        if (!target.closest('[data-dropdown-container]')) {
          setIsVersionDropdownOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCommentTooltip, isVersionDropdownOpen]);

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutId) {
        clearTimeout(tooltipTimeoutId);
      }
    };
  }, [tooltipTimeoutId]);

  // Load versions when user is authenticated (only run once when user ID is available)
  useEffect(() => {
    if (currentUser?.id) {
      fetchVersions();
      loadLatestMainDocument();
    }
  }, [currentUser?.id]); // Only depend on user ID to prevent infinite loops

  useEffect(() => {
    if (!isPending && !sessionData?.user) {
      router.replace('/signin?message=auth_required');
    }
  }, [isPending, sessionData, router]);

  const loadLatestMainDocument = async () => {
    try {
      console.log('Loading latest main document...');
      const response = await fetch('/api/main-document');
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.content !== null && data.title !== null) {
          // Load from database - this is the "current working document"
          console.log('Loading content and title from database');
          setMainDocumentContent(data.content);
          setArticleTitle(data.title);
          // Update localStorage with the loaded content
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.content));
          setMainDocumentId(data.id); // NEW: Store main document ID for caching
        } else {
          console.log('No main document in database, checking localStorage');
          // No main document in database, check localStorage
          const savedContentString = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (savedContentString) {
            try {
              const savedContent: TiptapDocument = JSON.parse(savedContentString);
              setMainDocumentContent(savedContent);
              // Keep default title since there's no saved title
            } catch (e) {
              console.error("Failed to parse content from local storage", e);
              setMainDocumentContent(defaultInitialMainDocContent);
            }
          } else {
            // No content anywhere, use default
            console.log('Using default content');
            setMainDocumentContent(defaultInitialMainDocContent);
          }
        }
      } else {
        console.error('Failed to load main document:', response.statusText);
        // Fallback to localStorage if API fails
        const savedContentString = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedContentString) {
          try {
            const savedContent: TiptapDocument = JSON.parse(savedContentString);
            setMainDocumentContent(savedContent);
          } catch (e) {
            console.error("Failed to parse content from local storage", e);
            setMainDocumentContent(defaultInitialMainDocContent);
          }
        }
      }
    } catch (error) {
      console.error('Error loading main document:', error);
      // Fallback to localStorage if there's an error
      const savedContentString = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedContentString) {
        try {
          const savedContent: TiptapDocument = JSON.parse(savedContentString);
          setMainDocumentContent(savedContent);
        } catch (e) {
          console.error("Failed to parse content from local storage", e);
          setMainDocumentContent(defaultInitialMainDocContent);
        }
      }
    }
  };

  const fetchVersions = async () => {
    if (isLoadingVersions) return; // Prevent multiple simultaneous calls
    
    setIsLoadingVersions(true);
    try {
      const response = await fetch('/api/versions');
      if (response.ok) {
        const fetchedVersions = await response.json();
        setVersions(fetchedVersions);
      } else {
        console.error('Failed to fetch versions:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching versions:', error);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // NEW: Auto-save function
  const autoSaveDocument = async () => {
    if (!currentUser || !mainDocumentContentRef.current || isAutoSaving) return;

    setIsAutoSaving(true);
    try {
      const response = await fetch('/api/main-document', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: mainDocumentContentRef.current,
          title: articleTitleRef.current,
        }),
      });

      if (response.ok) {
        setLastAutoSaveTime(new Date());
        console.log('Document auto-saved successfully');
      } else {
        console.error('Failed to auto-save document:', response.statusText);
      }
    } catch (error) {
      console.error('Error auto-saving document:', error);
    } finally {
      setIsAutoSaving(false);
    }
  };

  // NEW: Setup auto-save interval (fix dependencies to avoid infinite loops)
  useEffect(() => {
    if (currentUser?.id) {
      // Clear any existing interval
      if (autoSaveIntervalId) {
        clearInterval(autoSaveIntervalId);
      }

      // Setup new auto-save interval (10 seconds = 10000ms)
      const intervalId = setInterval(autoSaveDocument, 10000);
      setAutoSaveIntervalId(intervalId);

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }
  }, [currentUser?.id]); // Only depend on user ID to avoid recreating interval

  const saveVersion = async () => {
    if (!currentUser || !mainDocumentContent) return;

    setIsSavingVersion(true);
    try {
      const response = await fetch('/api/main-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: mainDocumentContent,
          title: articleTitle,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert('Version saved! Your current work continues in a new working document.');
        // Refresh versions to show the newly locked version
        fetchVersions();
      } else {
        const errorData = await response.json();
        alert(`Failed to save version: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error saving version:', error);
      alert('Error saving version. Please try again.');
    } finally {
      setIsSavingVersion(false);
    }
  };

  const createNamedVersion = async () => {
    if (!currentUser || !mainDocumentContent) return;

    const versionName = prompt('Enter a name for this version (e.g., "For Family", "For Therapist", "For Friend"):');
    if (!versionName || versionName.trim() === '') return;

    setIsSavingVersion(true);
    try {
      const response = await fetch('/api/versions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: versionName.trim(),
          content: mainDocumentContent,
        }),
      });

      if (response.ok) {
        const newVersion = await response.json();
        setVersions(prev => [newVersion, ...prev]);
        alert('Named version created successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to create named version: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error creating named version:', error);
      alert('Error creating named version. Please try again.');
    } finally {
      setIsSavingVersion(false);
    }
  };

  const deleteVersion = async (versionId: string) => {
    if (!confirm('Are you sure you want to delete this version?')) return;

    try {
      const response = await fetch(`/api/versions/${versionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setVersions(prev => prev.filter(v => v.id !== versionId));
        if (selectedReviewVersion?.id === versionId) {
          handleCloseReview();
        }
        alert('Version deleted successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to delete version: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting version:', error);
      alert('Error deleting version. Please try again.');
    }
  };

  const toggleMergeStatus = async (versionId: string, currentMerged: boolean) => {
    try {
      const response = await fetch(`/api/versions/${versionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merged: !currentMerged,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setVersions(prev => prev.map(v => 
          v.id === versionId 
            ? { ...v, merged: !currentMerged }
            : v
        ));
        // Don't show alert for successful merge toggle - it's a quick action
      } else {
        const errorData = await response.json();
        alert(`Failed to ${currentMerged ? 'reopen' : 'merge'} version: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error toggling merge status:', error);
      alert('Error updating version. Please try again.');
    }
  };

  const handleMainContentChange = React.useCallback((newContent: TiptapDocument) => {
    setMainDocumentContent(newContent);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newContent));
  }, []);

  const handleOpenVersionForReview = (version: Version) => {
    setSelectedReviewVersion(version);
    setIsReviewing(true);
    setShowCommentMargin(true);
    setIsVersionDropdownOpen(false);
    setReferenceViewMode('discussion_notes'); // Reset to discussion notes view when opening a new version
  };

  const handleCloseReview = () => {
    setIsReviewing(false);
    setSelectedReviewVersion(null);
    // Keep comment margin open when closing reference document
  };

  const handleCloseCommentMargin = () => {
    setShowCommentMargin(false);
  };

  // NEW: Handle merging segments from diff view
  const handleMergeSegments = (selectedSegmentIds: string[]) => {
    if (!selectedReviewVersion) return;
    
    const diffEngine = new DocumentDiffEngine();
    const segments = diffEngine.generateSemanticDiff(mainDocumentContent, selectedReviewVersion.content);
    const mergedContent = diffEngine.mergeSegments(mainDocumentContent, segments, selectedSegmentIds);
    
    setMainDocumentContent(mergedContent);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mergedContent));
    
    // Show success message
    alert(`Merged ${selectedSegmentIds.length} segments successfully!`);
  };

  // Add this handler function after your other handler functions
  const handleTextSelection = React.useCallback((text: string) => {
    setSelectedText(text);
    
    // Clear any existing tooltip timeout
    if (tooltipTimeoutId) {
      clearTimeout(tooltipTimeoutId);
      setTooltipTimeoutId(null);
    }
    
    // Show comment tooltip if text is selected
    if (text.trim() && mainEditorRef.current) {
      const editor = mainEditorRef.current;
      const { from, to } = editor.state.selection;
      
      if (from !== to) {
        setCommentSelectedText(text);
        setCommentTextRange({ from, to });
        
        // Calculate position for comment tooltip
        const selection = window.getSelection();
        
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectionRect = range.getBoundingClientRect();
          
          setCommentTooltipPosition({
            x: selectionRect.left + (selectionRect.width / 2),
            y: selectionRect.top
          });
          
          setShowCommentTooltip(true);
          
          // Auto-hide tooltip after 5 seconds if not used
          const timeoutId = setTimeout(() => {
            setShowCommentTooltip(false);
            setCommentTooltipPosition(null);
            setCommentSelectedText('');
            setCommentTextRange(null);
          }, 5000);
          setTooltipTimeoutId(timeoutId);
        }
      }
    } else {
      // Clear tooltip when no text is selected
      setShowCommentTooltip(false);
      setCommentTooltipPosition(null);
    }
  }, [tooltipTimeoutId]);

  // Helper: find range of the first occurrence of text in the document
  const findTextRange = (editor: Editor, searchText: string): { from: number; to: number } | null => {
    const searchNormalized = searchText.toLowerCase().trim();
    let foundFrom: number | null = null;
    let foundTo: number | null = null;
    let currentText = '';
    let currentPos = 0;

    // Build a continuous text string with position mapping
    const textChunks: Array<{ text: string; startPos: number }> = [];
    
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        const text = node.text || '';
        if (text.trim().length > 0) {
          textChunks.push({ text: text.toLowerCase(), startPos: pos });
          currentText += text.toLowerCase();
        }
      }
      return true;
    });

    // Try exact match first
    let searchIndex = currentText.indexOf(searchNormalized);
    
    // If exact match fails, try fuzzy matching with normalized spaces
    if (searchIndex === -1) {
      const normalizedCurrentText = currentText.replace(/\s+/g, ' ');
      const normalizedSearchText = searchNormalized.replace(/\s+/g, ' ');
      searchIndex = normalizedCurrentText.indexOf(normalizedSearchText);
    }
    
    // If still no match, try word-by-word matching
    if (searchIndex === -1) {
      const searchWords = searchNormalized.split(/\s+/).filter(word => word.length > 0);
      if (searchWords.length > 0) {
        const firstWord = searchWords[0];
        const firstWordIndex = currentText.indexOf(firstWord);
        if (firstWordIndex !== -1) {
          searchIndex = firstWordIndex;
          // Use the length of the search text for the range
        }
      }
    }

    if (searchIndex !== -1) {
      // Map back to document positions
      let charCount = 0;
      for (const chunk of textChunks) {
        if (charCount + chunk.text.length > searchIndex) {
          const offsetInChunk = searchIndex - charCount;
          foundFrom = chunk.startPos + offsetInChunk;
          foundTo = foundFrom + searchText.length;
          break;
        }
        charCount += chunk.text.length;
      }
    }

    return foundFrom !== null && foundTo !== null ? { from: foundFrom as number, to: foundTo as number } : null;
  };

  const highlightTextInMainEditor = (text: string) => {
    const editor = mainEditorRef.current;
    if (!editor) return;

    // If text is empty, clear all highlights
    if (!text || text.trim() === '') {
      try {
        const { from, to } = editor.state.selection;
        const docSize = editor.state.doc.content.size;
        
        // Clear all highlights from entire document
        if (docSize > 0) {
          editor.chain()
            .setTextSelection({ from: 0, to: docSize })
            .unsetHighlight()
            .setTextSelection({ from, to })
            .run();
        }
      } catch (error) {
        console.warn('Error clearing highlights:', error);
      }
      return;
    }

    // Find and highlight the text
    const range = findTextRange(editor, text);
    if (range) {
      // @ts-ignore - highlight commands may not be typed in Editor chain helpers
      editor
        .chain()
        .focus()
        .setTextSelection(range)
        .setHighlight({ color: '#DCEEFB' })
        .scrollIntoView()
        .run();
    } else {
      console.warn('Unable to locate the specified text in the document:', text);
    }
  };

  // Comment handling functions
  const handleAddComment = () => {
    if (!currentUser || !commentTextRange) return;
    
    // Clear tooltip timeout since user is using it
    if (tooltipTimeoutId) {
      clearTimeout(tooltipTimeoutId);
      setTooltipTimeoutId(null);
    }
    
    // Create inline comment data and show comment margin
    setInlineCommentData({
      selectedText: commentSelectedText,
      authorName: currentUser.name || 'Unknown User',
      authorEmail: currentUser.email || '',
      position: commentTextRange
    });
    
    // Show comment margin if not already shown
    if (!showCommentMargin) {
      setShowCommentMargin(true);
    }
    
    // Hide tooltip
    setShowCommentTooltip(false);
    setCommentTooltipPosition(null);
  };

  const handleSaveInlineComment = (commentText: string) => {
    if (!inlineCommentData) return;
    
    const newComment: UserComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: commentText,
      selectedText: inlineCommentData.selectedText,
      authorName: inlineCommentData.authorName,
      authorEmail: inlineCommentData.authorEmail,
      createdAt: new Date(),
      resolved: false,
      position: inlineCommentData.position
    };
    
    setUserComments(prev => [...prev, newComment]);
    setInlineCommentData(null);
    setCommentSelectedText('');
    setCommentTextRange(null);
  };

  const handleCancelInlineComment = () => {
    setInlineCommentData(null);
    setCommentSelectedText('');
    setCommentTextRange(null);
  };

  const handleCloseCommentTooltip = () => {
    setShowCommentTooltip(false);
    setCommentTooltipPosition(null);
    setCommentSelectedText('');
    setCommentTextRange(null);
  };

  const handleResolveComment = React.useCallback((commentId: string) => {
    setUserComments(prev => 
      prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, resolved: true }
          : comment
      )
    );
  }, []);

  const handleDeleteComment = React.useCallback((commentId: string) => {
    setUserComments(prev => prev.filter(comment => comment.id !== commentId));
    // Clear active comment if it's being deleted
    setActiveCommentId(prevActive => prevActive === commentId ? null : prevActive);
  }, []);

  const handleEditComment = React.useCallback((commentId: string, newText: string) => {
    setUserComments(prev => 
      prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, text: newText }
          : comment
      )
    );
  }, []);

  const handleCommentClick = React.useCallback((commentId: string) => {
    setActiveCommentId(prevActive => prevActive === commentId ? null : commentId);
  }, []);

  // Clear all comments and highlights
  const handleClearAllComments = React.useCallback(() => {
    // Clear all user comments
    setUserComments([]);
    
    // Clear localStorage
    localStorage.removeItem(COMMENTS_STORAGE_KEY);
    
    // Clear highlights from editor
    if (mainEditorRef.current) {
      try {
        const editor = mainEditorRef.current;
        const { from, to } = editor.state.selection;
        const docSize = editor.state.doc.content.size;
        
        // Force clear all comment highlights and regular highlights from entire document
        if (docSize > 0) {
          editor.chain()
            .setTextSelection({ from: 0, to: docSize })
            .unsetMark('commentHighlight')
            .unsetHighlight()
            .setTextSelection({ from, to })
            .run();
        }
        
        // Also use the extension commands as backup
        editor.commands.unsetCommentHighlight();
        editor.commands.unsetHighlight();
      } catch (error) {
        console.warn('Error clearing highlights:', error);
      }
    }
    
    // Hide comment margin
    setShowCommentMargin(false);
    
    // Clear any active comment state
    setActiveCommentId(null);
    setInlineCommentData(null);
    setCommentSelectedText('');
    setCommentTextRange(null);
    setShowCommentTooltip(false);
    setCommentTooltipPosition(null);
    
    console.log('All comments and highlights cleared');
  }, []);



  const handleTitleSave = async () => {
    setIsEditingTitle(false);
    
    // Save the title to the database
    try {
      const response = await fetch('/api/main-document', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: articleTitle,
        }),
      });

      if (response.ok) {
        console.log('Title updated successfully');
      } else if (response.status === 404) {
        // No main document exists yet, create one
        console.log('No main document found, creating new one with title and current content');
        const createResponse = await fetch('/api/main-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: articleTitle,
            content: mainDocumentContent,
          }),
        });
        
        if (createResponse.ok) {
          console.log('New main document created with title');
        } else {
          const errorData = await createResponse.json();
          console.error('Failed to create main document:', errorData.error);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to update title:', errorData.error);
      }
    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    }
    if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  if (isPending) {
    return <main style={{ textAlign: 'center', padding: '50px' }}><p>Loading Writing Canvas...</p></main>;
  }

  if (error) {
    return (
      <main style={{ textAlign: 'center', padding: '50px' }}>
        <p>Error loading session: {error.message}. Please try signing in again.</p>
        <button onClick={() => router.push('/signin')} className="versions-button">Go to Sign In</button>
      </main>
    );
  }
  
  if (!sessionData?.user || !currentUser) {
    return <main style={{ textAlign: 'center', padding: '50px' }}><p>Access denied. Redirecting to sign-in...</p></main>;
  }

  const mainContentForEditor = mainDocumentContent;

  // Determine layout class based on what's shown
  const getLayoutClass = () => {
    const hasComments = showCommentMargin; // Comments can be shown independently
    const hasReference = isReviewing && selectedReviewVersion;
    
    if (hasComments && hasReference) return 'both-panels';
    if (hasComments && !hasReference) return 'comment-only';
    if (!hasComments && hasReference) return 'reference-only';
    return '';
  };

  return (
    <main style={{ padding: '20px' }} className={`writing-canvas-page ${getLayoutClass() ? 'is-reviewing' : ''}`}>
      <div className="canvas-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div className="title-editor-section" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isEditingTitle ? (
            <input
              type="text"
              value={articleTitle}
              onChange={(e) => setArticleTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyPress}
              autoFocus
              style={{
                fontSize: '1.4rem',
                fontWeight: 'normal',
                fontFamily: 'Arial, sans-serif',
                border: '1px solid #000',
                borderRadius: '0',
                outline: 'none',
                padding: '4px 8px',
                textAlign: 'left',
                minWidth: '200px',
                maxWidth: '400px'
              }}
            />
          ) : (
            <>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 'normal', fontFamily: 'Arial, sans-serif' }}>{articleTitle}</h1>
              <button
                onClick={() => setIsEditingTitle(true)}
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 8px',
                  background: '#ffffff',
                  color: '#000',
                  border: '1px solid #000',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#e9e9e9';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                Edit Title
              </button>
            </>
          )}
          {/* NEW: Auto-save status indicator */}
          <div style={{ fontSize: '0.75rem', color: '#666', marginLeft: '10px' }}>
            {isAutoSaving ? (
              <span style={{ color: '#007bff' }}>● Auto-saving...</span>
            ) : lastAutoSaveTime ? (
              <span>✓ Last saved: {lastAutoSaveTime.toLocaleTimeString()}</span>
            ) : (
              <span>○ Auto-save every 10 seconds</span>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={saveVersion} 
            disabled={isSavingVersion}
            className="versions-button save-version-btn"
            style={{ 
              backgroundColor: isSavingVersion ? '#ccc' : '#e8f5e8',
              color: isSavingVersion ? '#666' : '#000',
              border: '1px solid #000',
              cursor: isSavingVersion ? 'not-allowed' : 'pointer'
            }}
            onMouseOver={(e) => {
              if (!isSavingVersion) {
                e.currentTarget.style.backgroundColor = '#d4e6d4';
              }
            }}
            onMouseOut={(e) => {
              if (!isSavingVersion) {
                e.currentTarget.style.backgroundColor = '#e8f5e8';
              }
            }}
            title="Lock this version and start a new working document"
          >
            {isSavingVersion ? 'Locking Version...' : 'Save Main Document'}
          </button>
          {/* <button onClick={() => setAIToolOpen(!isAIToolOpen)} className="versions-button">
            {isAIToolOpen ? 'Close AI Toolbox' : 'AI Toolbox'}
          </button> */}
          <button onClick={() => setShowCommentMargin(!showCommentMargin)} className="versions-button">
            {showCommentMargin ? 'Hide Comments' : 'Show Comments'}
          </button>
          {/* Version Dropdown */}
          <div style={{ position: 'relative' }} data-dropdown-container>
            <button 
              onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)} 
              className="versions-button"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minWidth: '180px',
                gap: '8px'
              }}
            >
              <span>{selectedReviewVersion ? selectedReviewVersion.name : 'Compare Versions'}</span>
              <span style={{ fontSize: '0.8rem' }}>{isVersionDropdownOpen ? '▲' : '▼'}</span>
            </button>
            
            {isVersionDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #000',
                zIndex: 1000,
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {isLoadingVersions ? (
                  <div style={{ 
                    padding: '12px', 
                    fontSize: '0.9rem',
                    color: '#666' 
                  }}>
                    Loading versions...
                  </div>
                ) : versions.length === 0 ? (
                  <div style={{ 
                    padding: '12px', 
                    fontSize: '0.9rem',
                    color: '#666',
                    fontStyle: 'italic' 
                  }}>
                    No versions saved yet
                  </div>
                ) : (
                  versions.map((version, index) => (
                    <div
                      key={version.id}
                      onClick={() => handleOpenVersionForReview(version)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: index < versions.length - 1 ? '1px solid #666' : 'none',
                        fontSize: '0.9rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        opacity: version.merged ? 0.6 : 1,
                        backgroundColor: selectedReviewVersion?.id === version.id ? '#f0f8ff' : 'white'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedReviewVersion?.id !== version.id) {
                          e.currentTarget.style.backgroundColor = '#f8f8f8';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedReviewVersion?.id !== version.id) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      <span style={{ 
                        color: version.merged ? '#999' : '#000',
                        fontWeight: selectedReviewVersion?.id === version.id ? '600' : 'normal'
                      }}>
                        {version.name}
                        {version.merged && <span style={{ fontSize: '0.7rem', marginLeft: '4px' }}>(merged)</span>}
                      </span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: '#666' 
                      }}>
                        {version.timestamp}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* <p>Welcome, {currentUser.name || currentUser.email}!</p> */}



      <div className={`editor-wrapper ${getLayoutClass() ? 'review-mode' : 'single-mode'} ${getLayoutClass()} ${isAIToolOpen ? 'ai-tool-open' : ''}`}>
        <div className={`main-editor-container ${isAIToolOpen ? 'tiptap-editor-container-tool-open':'tiptap-editor-container'}`}>
          <TiptapEditor 
            initialContent={mainContentForEditor}
            onContentChange={handleMainContentChange}
            onTextSelection={handleTextSelection}
            isEditable={true}
            editorRef={mainEditorRef}
            userComments={userComments}
            onCommentClick={handleCommentClick}
            temporaryHighlight={inlineCommentData?.position || (showCommentTooltip ? commentTextRange : null)}
          />
        </div>
        {/* NEW: Comment Cards Column - can be shown independently */}
        {showCommentMargin && (
          <div className="comment-cards-column">
            <div className="margin-header">
              <h4>{selectedReviewVersion ? 'Comments & Insights' : 'Comments'}</h4>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={handleCloseCommentMargin} 
                  className="close-margin-button"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    opacity: '0.6',
                    padding: '2px'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <CommentCards
              originalContent={mainDocumentContent}
              comparisonContent={selectedReviewVersion?.content || defaultInitialMainDocContent}
              onHighlightText={highlightTextInMainEditor}
              mainDocId={mainDocumentId || undefined}
              refDocId={selectedReviewVersion?.id}
              discussionNotes={selectedReviewVersion?.discussionNotes}
              userComments={userComments}
              onResolveComment={handleResolveComment}
              onDeleteComment={handleDeleteComment}
              onEditComment={handleEditComment}
              inlineCommentData={inlineCommentData}
              onSaveInlineComment={handleSaveInlineComment}
              onCancelInlineComment={handleCancelInlineComment}
              activeCommentId={activeCommentId}
              onCommentClick={handleCommentClick}

            />
          </div>
        )}
        
        {/* Right Column: Reference Document - can be shown independently */}
        {isReviewing && selectedReviewVersion && (
          <div className={`reference-editor-container ${isAIToolOpen ? 'tiptap-editor-container-tool-open':'tiptap-editor-container'}`}>
            <div className="review-header">
              <h4 style={{ margin: 0, marginLeft: '8px', color: '#495057', fontSize: '0.8rem' }}>
                Comparing with: <span style={{ fontWeight: 600, color: '#007bff' }}>{selectedReviewVersion.name}</span>
              </h4>
              <div className="review-buttons">
                <button 
                  onClick={handleCloseReview} 
                  className="close-margin-button"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    opacity: '0.6',
                    padding: '2px 8px'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* NEW: Toggle buttons for content vs discussion notes */}
            <div className="reference-toggle-buttons">
              <button
                onClick={() => setReferenceViewMode('content')}
                className={`reference-toggle-button ${referenceViewMode === 'content' ? 'active' : ''}`}
              >
                Article Content
              </button>
              <button
                onClick={() => setReferenceViewMode('discussion_notes')}
                className={`reference-toggle-button ${referenceViewMode === 'discussion_notes' ? 'active' : ''}`}
                disabled={!selectedReviewVersion.discussionNotes || selectedReviewVersion.discussionNotes.trim() === ''}
                title={!selectedReviewVersion.discussionNotes || selectedReviewVersion.discussionNotes.trim() === '' ? 'No discussion notes for this version' : 'View discussion notes'}
              >
                Discussion Notes
              </button>
            </div>

            {/* Conditional rendering based on view mode */}
            {referenceViewMode === 'content' ? (
              <DiffTiptapEditor 
                originalContent={mainDocumentContent}
                comparisonContent={selectedReviewVersion.content}
                onMergeSegments={handleMergeSegments}
                onHighlightText={highlightTextInMainEditor}
                mainDocId={mainDocumentId || undefined}
                refDocId={selectedReviewVersion.id}
              />
            ) : (
              <div className="discussion-notes-container">
                {selectedReviewVersion.discussionNotes && selectedReviewVersion.discussionNotes.trim() !== '' ? (
                  <div className="discussion-notes-paragraphs">
                    {selectedReviewVersion.discussionNotes
                      .split('\n\n')
                      .filter(paragraph => paragraph.trim() !== '')
                      .map((paragraph, index) => (
                        <div 
                          key={index}
                          className="discussion-note-card"
                          onClick={() => {
                            navigator.clipboard.writeText(paragraph.trim());
                            // Show brief feedback
                            const card = document.querySelectorAll('.discussion-note-card')[index] as HTMLElement;
                            if (card) {
                              const originalBg = card.style.backgroundColor;
                              card.style.backgroundColor = '#e8f5e8';
                              setTimeout(() => {
                                card.style.backgroundColor = originalBg;
                              }, 200);
                            }
                          }}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e0e0e0',
                            padding: '12px',
                            marginBottom: '8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            lineHeight: '1.5',
                            fontWeight: '300',
                            fontFamily: "'Atkinson Hyperlegible', serif",
                            color: '#2d3748',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                          }}
                        >
                          <div className="copy-icon" style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            fontSize: '0.7rem',
                            color: '#6c757d',
                            opacity: '0',
                            transition: 'opacity 0.2s ease'
                          }}>
                            📋
                          </div>
                          {paragraph.trim()}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="discussion-notes-empty">
                    No discussion notes for this version
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* UPDATED: Enhanced AI Tool */}
        {isAIToolOpen && (
          <EnhancedAITool 
            mainContent={mainDocumentContent} 
            comparisonContent={selectedReviewVersion?.content}
            selectedText={selectedText}
            mainDocId={mainDocumentId || undefined}
            refDocId={selectedReviewVersion?.id}
            onRequestTextSelection={() => {
              alert('Please select text in the main editor (left panel) to add to context.');
            }}
          />
        )}
      </div>
      
      {/* Comment Tooltip */}
      {showCommentTooltip && (
        <CommentTooltip
          position={commentTooltipPosition}
          onAddComment={handleAddComment}
          onClose={handleCloseCommentTooltip}
        />
      )}
      
    </main>
  );
} 