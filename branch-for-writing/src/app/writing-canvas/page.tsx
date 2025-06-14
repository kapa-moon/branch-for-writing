'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import TiptapEditor from '@/components/TiptapEditor';
import './writing-canvas.css';
import { TiptapDocument } from '@/types/tiptap';
import AITool from '@/components/AITool';

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
  const [selectedReviewVersion, setSelectedReviewVersion] = useState<Version | null>(null);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState<boolean>(false);
  const [isAIToolOpen, setAIToolOpen] = useState<boolean>(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState<boolean>(false);
  const [isSavingVersion, setIsSavingVersion] = useState<boolean>(false);

  // Load main document from local storage on mount
  useEffect(() => {
    const savedContentString = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedContentString) {
      try {
        const savedContent: TiptapDocument = JSON.parse(savedContentString);
        setMainDocumentContent(savedContent);
      } catch (e) {
        console.error("Failed to parse content from local storage", e);
        setMainDocumentContent(defaultInitialMainDocContent);
      }
    } else {
      setMainDocumentContent(defaultInitialMainDocContent);
    }
  }, []);

  // Load versions when user is authenticated (only run once when user ID is available)
  useEffect(() => {
    if (currentUser?.id) {
      fetchVersions();
    }
  }, [currentUser?.id]); // Only depend on user ID to prevent infinite loops

  useEffect(() => {
    if (!isPending && !sessionData?.user) {
      router.replace('/signin?message=auth_required');
    }
  }, [isPending, sessionData, router]);

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

  const saveVersion = async () => {
    if (!currentUser || !mainDocumentContent) return;

    const versionName = prompt('Enter a name for this version:');
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
        alert('Version saved successfully!');
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

  const handleMainContentChange = (newContent: TiptapDocument) => {
    setMainDocumentContent(newContent);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newContent));
  };

  const handleOpenVersionForReview = (version: Version) => {
    setSelectedReviewVersion(version);
    setIsReviewing(true);
    setIsSideMenuOpen(false);
  };

  const handleCloseReview = () => {
    setIsReviewing(false);
    setSelectedReviewVersion(null);
  };

  if (isPending) {
    return <main style={{ textAlign: 'center', padding: '50px' }}><p>Loading Writing Canvas...</p></main>;
  }

  if (error) {
    return (
      <main style={{ textAlign: 'center', padding: '50px' }}>
        <p>Error loading session: {error.message}. Please try signing in again.</p>
        <button onClick={() => router.push('/signin')} style={{ marginTop: '20px', padding: '10px 15px' }}>Go to Sign In</button>
      </main>
    );
  }
  
  if (!sessionData?.user || !currentUser) {
    return <main style={{ textAlign: 'center', padding: '50px' }}><p>Access denied. Redirecting to sign-in...</p></main>;
  }

  const mainContentForEditor = mainDocumentContent;

  return (
    <main style={{ padding: '20px' }} className={`writing-canvas-page ${isReviewing ? 'is-reviewing' : ''} ${isSideMenuOpen ? 'side-menu-open' : ''}`}>
      <div className="canvas-header">
        <h1 className='writing-canvas-title'>Writing Canvas</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={saveVersion} 
            disabled={isSavingVersion}
            className="versions-button"
            style={{ 
              backgroundColor: isSavingVersion ? '#ccc' : '#4CAF50',
              color: 'white',
              cursor: isSavingVersion ? 'not-allowed' : 'pointer'
            }}
          >
            {isSavingVersion ? 'Saving...' : 'Save Version'}
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
          <button onClick={() => setIsSideMenuOpen(false)} className="side-menu-close-button">X</button>
          <h2>Versions</h2>
          {isLoadingVersions ? (
            <p>Loading versions...</p>
          ) : (
            <ul>
              {versions.length === 0 ? (
                <li style={{ padding: '10px', fontStyle: 'italic' }}>No versions saved yet</li>
              ) : (
                versions.map(version => (
                  <li key={version.id}>
                    <div onDoubleClick={() => handleOpenVersionForReview(version)} style={{ cursor: 'pointer' }}>
                      <strong>{version.name}</strong> ({version.timestamp})
                    </div>
                    <button 
                      onClick={() => deleteVersion(version.id)}
                      style={{
                        marginTop: '5px',
                        padding: '2px 8px',
                        fontSize: '12px',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
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
            isEditable={true}
          />
        </div>
        {isReviewing && selectedReviewVersion && (
          <div className={`review-editor-container ${isAIToolOpen ? 'tiptap-editor-container-tool-open':'tiptap-editor-container'}`}>
            <button onClick={handleCloseReview} className="close-review-button">Close Review</button>
            <TiptapEditor 
              key={selectedReviewVersion.id}
              initialContent={selectedReviewVersion.content}
              onContentChange={() => {}}
              isEditable={false}
            />
          </div>
        )}
        {isAIToolOpen && <AITool />}
      </div>
      
    </main>
  );
} 