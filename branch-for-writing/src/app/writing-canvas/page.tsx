'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import TiptapEditor from '@/components/TiptapEditor';
import DiffTiptapEditor from '@/components/DiffTiptapEditor';
import EnhancedAITool from '@/components/EnhancedAITool';
import './writing-canvas.css';
import { TiptapDocument } from '@/types/tiptap';
import AITool from '@/components/AITool';
import { DocumentDiffEngine } from '@/lib/diffEngine';
// @ts-ignore - type provided by @tiptap/core at runtime, suppress if linter cannot resolve
import { Editor } from '@tiptap/core';

const LOCAL_STORAGE_KEY = 'tiptap-main-document';

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
  const [isSideMenuOpen, setIsSideMenuOpen] = useState<boolean>(false);
  const [isAIToolOpen, setAIToolOpen] = useState<boolean>(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState<boolean>(false);
  const [isSavingVersion, setIsSavingVersion] = useState<boolean>(false);
  
  // NEW: Add diff mode state
  const [diffMode, setDiffMode] = useState<boolean>(false);

  // Add this state variable with your other useState declarations (around line 48)
  const [selectedText, setSelectedText] = useState<string>('');

  // NEW: Add state for toggleable info card
  const [showVersionsInfo, setShowVersionsInfo] = useState<boolean>(false);

  // Article title state
  const [articleTitle, setArticleTitle] = useState<string>('Untitled Article');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);

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

  const handleMainContentChange = (newContent: TiptapDocument) => {
    setMainDocumentContent(newContent);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newContent));
  };

  const handleOpenVersionForReview = (version: Version) => {
    setSelectedReviewVersion(version);
    setIsReviewing(true);
    setIsSideMenuOpen(false);
    // Reset diff mode when opening a new version
    setDiffMode(false);
  };

  const handleCloseReview = () => {
    setIsReviewing(false);
    setSelectedReviewVersion(null);
    setDiffMode(false);
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
    
    // Optionally close diff mode after merge
    setDiffMode(false);
  };

  // Add this handler function after your other handler functions
  const handleTextSelection = (text: string) => {
    setSelectedText(text);
  };

  // Helper: find range of the first occurrence of text in the document
  const findTextRange = (editor: Editor, searchText: string): { from: number; to: number } | null => {
    const lowerSearch = searchText.toLowerCase();
    let foundFrom: number | null = null;
    let foundTo: number | null = null;

    // Using `any` for node to avoid deep ProseMirror typings here
    editor.state.doc.descendants((node: any, pos: number) => {
      if (foundFrom !== null) return false; // stop
      if (node.isText) {
        const text = (node.text || '').toLowerCase();
        const index = text.indexOf(lowerSearch);
        if (index !== -1) {
          foundFrom = pos + index;
          foundTo = (foundFrom as number) + searchText.length;
          return false;
        }
      }
      return true;
    });

    return foundFrom !== null && foundTo !== null ? { from: foundFrom as number, to: foundTo as number } : null;
  };

  const highlightTextInMainEditor = (text: string) => {
    const editor = mainEditorRef.current;
    if (!editor) return;

    // Remove existing highlight (optional):
    // editor.commands.selectAll();
    // editor.commands.unsetHighlight();

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
      alert('Unable to locate the specified text in the document.');
    }
  };

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

  return (
    <main style={{ padding: '20px' }} className={`writing-canvas-page ${isReviewing ? 'is-reviewing' : ''} ${isSideMenuOpen ? 'side-menu-open' : ''}`}>
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
          <button onClick={() => setAIToolOpen(!isAIToolOpen)} className="versions-button">
            {isAIToolOpen ? 'Close AI Toolbox' : 'AI Toolbox'}
          </button>
          <button onClick={() => setIsSideMenuOpen(!isSideMenuOpen)} className="versions-button">
            {isSideMenuOpen ? 'Close Versions' : 'Compare Versions'}
          </button>
        </div>
      </div>
      {/* <p>Welcome, {currentUser.name || currentUser.email}!</p> */}

      {isSideMenuOpen && (
        <div className="versions-side-menu">
          <div className="versions-header">
            <h2 style={{ fontSize: '1rem', fontWeight: 'normal', margin: '0 0 10px 0' }}>Previous Versions</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setShowVersionsInfo(!showVersionsInfo)}
                className="info-toggle-button"
                title="Show help"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  opacity: '0.6',
                  padding: '2px'
                }}
              >
                ℹ️
              </button>
              <button 
                onClick={() => setIsSideMenuOpen(false)} 
                className="side-menu-close-button"
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
          
          {/* NEW: Toggleable UX Hint Card */}
          {showVersionsInfo && (
            <div className="versions-info-card">
              <h4>How to Compare & Diff:</h4>
              <p>
                <strong>Double-click</strong> on any version below to open it for comparison with your current writing.
              </p>
              <p>
                Then click <strong>"Review & Merge"</strong> to see changes and selectively merge content.
              </p>
              <p>
                <strong>🔒 Saved Versions:</strong> Locked snapshots of your work.<br/>
                <strong>📝 Named Versions:</strong> Custom versions for specific audiences.
              </p>
            </div>
          )}

          {isLoadingVersions ? (
            <p>Loading versions...</p>
          ) : (
            <ul>
              {versions.length === 0 ? (
                <li style={{ padding: '10px', fontStyle: 'italic' }}>No versions saved yet</li>
              ) : (
                versions.map(version => (
                  <li key={version.id} style={{ marginBottom: '8px' }}>
                    <div 
                      onDoubleClick={() => handleOpenVersionForReview(version)} 
                      style={{ 
                        cursor: 'pointer', 
                        padding: '8px', 
                        border: '1px solid #ddd', 
                        borderRadius: '4px',
                        opacity: version.merged ? 0.6 : 1,
                        backgroundColor: version.merged ? '#f5f5f5' : 'white',
                        filter: version.merged ? 'grayscale(60%)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                      className="version-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.8rem', marginRight: '6px' }}>
                          {version.type === 'saved_version' ? '🔒' : '📝'}
                        </span>
                        <strong style={{ 
                          fontSize: '0.9rem',
                          color: version.merged ? '#666' : 'inherit'
                        }}>
                          {version.name}
                          {version.merged && <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#999' }}>(merged)</span>}
                        </strong>
                        {version.type === 'saved_version' && (
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '0.65rem',
                            padding: '2px 6px',
                            backgroundColor: '#f8f9fa',
                            color: '#000',
                            border: '1px solid #000',
                            borderRadius: '3px',
                            fontWeight: 'normal'
                          }}>
                            Main
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: version.merged ? '#999' : '#666' }}>
                        {version.timestamp}
                      </div>
                    </div>
                    <div className="version-buttons" style={{ 
                      marginTop: '4px', 
                      display: 'flex', 
                      gap: '4px',
                      opacity: 0,
                      transition: 'opacity 0.2s ease'
                    }}>
                      {/* Only show merge button for named versions, not saved versions */}
                      {version.type === 'named_version' && (
                        <button 
                          onClick={() => toggleMergeStatus(version.id, version.merged || false)}
                          className="merge-version-button"
                          style={{ 
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            backgroundColor: '#ffffff',
                            color: '#000',
                            border: '1px solid #000',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#f0f8f0';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                          }}
                          title={version.merged ? 'Reopen this version' : 'Mark as merged'}
                        >
                          {version.merged ? 'Reopen' : 'Merge'}
                        </button>
                      )}
                      <button 
                        onClick={() => deleteVersion(version.id)}
                        className="delete-version-button"
                        style={{ fontSize: '0.7rem' }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      <div className={`editor-wrapper ${isReviewing ? 'review-mode' : 'single-mode'} ${isAIToolOpen ? 'ai-tool-open' : ''}`}>
        <div className={`main-editor-container ${isAIToolOpen ? 'tiptap-editor-container-tool-open':'tiptap-editor-container'}`}>
          <TiptapEditor 
            initialContent={mainContentForEditor}
            onContentChange={handleMainContentChange}
            onTextSelection={handleTextSelection}
            isEditable={true}
            editorRef={mainEditorRef}
          />
        </div>
        {/* UPDATED: Enhanced review editor with diff functionality */}
        {isReviewing && selectedReviewVersion && (
          <div className={`review-editor-container ${isAIToolOpen ? 'tiptap-editor-container-tool-open':'tiptap-editor-container'}`}>
            <div className="review-header">
              <h4 style={{ margin: 0, color: '#495057', fontSize: '1rem' }}>
                Comparing with: <span style={{ fontWeight: 600, color: '#007bff' }}>{selectedReviewVersion.name}</span>
              </h4>
              <div className="review-buttons">
                <button 
                  onClick={() => setDiffMode(!diffMode)} 
                  className={`diff-mode-button ${diffMode ? 'diff-view' : 'normal-view'}`}
                >
                  {diffMode ? 'View Document' : 'Review & Merge'}
                </button>
                <button onClick={handleCloseReview} className="close-review-button">
                  Close Review
                </button>
              </div>
            </div>
            {diffMode ? (
              <DiffTiptapEditor 
                originalContent={mainDocumentContent}
                comparisonContent={selectedReviewVersion.content}
                onMergeSegments={handleMergeSegments}
                onHighlightText={highlightTextInMainEditor}
                mainDocId={mainDocumentId || undefined}
                refDocId={selectedReviewVersion.id}
              />
            ) : (
              <TiptapEditor 
                key={selectedReviewVersion.id}
                initialContent={selectedReviewVersion.content}
                onContentChange={() => {}}
                isEditable={false}
              />
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
      
    </main>
  );
} 