'use client';

import React, { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import TiptapEditor from '@/components/TiptapEditor';
import './writing-canvas.css';
import { TiptapDocument } from '@/types/tiptap';

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

// Mock versions data - update content to use TiptapDocument
interface Version {
  id: string;
  name: string;
  timestamp: string;
  content: TiptapDocument;
}

const mockVersions: Version[] = [
  { id: 'v1', name: 'Version 1 (Draft)', timestamp: '2023-10-26 10:00', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This is the first saved version content.' }] }] } },
  { id: 'v2', name: 'Version 2 (Revised)', timestamp: '2023-10-26 14:30', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This is a revised version with much more detail and examples.' }] }] } },
  { id: 'v3', name: 'Version 3 (Final Touches)', timestamp: '2023-10-27 09:15', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Final touches have been added to this version for review.' }] }] } },
];

export default function WritingCanvasPage() {
  const { data: sessionData, isPending, error } = authClient.useSession();
  const router = useRouter();
  
  const currentUser = sessionData?.user ? {
    id: sessionData.user.id || 'current-user-temp-id',
    name: sessionData.user.name,
    email: sessionData.user.email
  } : null;
  
  const [mainDocumentContent, setMainDocumentContent] = useState<TiptapDocument>(defaultInitialMainDocContent);
  const [selectedReviewVersion, setSelectedReviewVersion] = useState<Version | null>(null);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState<boolean>(false);

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

  useEffect(() => {
    if (!isPending && !sessionData?.user) {
      router.replace('/signin?message=auth_required');
    }
  }, [isPending, sessionData, router]);

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
        <button onClick={() => setIsSideMenuOpen(!isSideMenuOpen)} className="versions-button">
          {isSideMenuOpen ? 'Close Versions' : 'Compare Versions'}
        </button>
      </div>
      {/* <p>Welcome, {currentUser.name || currentUser.email}!</p> */}

      {isSideMenuOpen && (
        <div className="versions-side-menu">
          <button onClick={() => setIsSideMenuOpen(false)} className="side-menu-close-button">X</button>
          <h2>Versions</h2>
          <ul>
            {mockVersions.map(version => (
              <li key={version.id} onDoubleClick={() => handleOpenVersionForReview(version)}>
                <strong>{version.name}</strong> ({version.timestamp})
                {/* Basic thumbnail/preview could go here */}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`editor-wrapper ${isReviewing ? 'review-mode' : 'single-mode'}`}>
        <div className='tiptap-editor-container main-editor-container'>
          <TiptapEditor 
            initialContent={mainContentForEditor}
            onContentChange={handleMainContentChange}
            isEditable={true}
          />
        </div>
        {isReviewing && selectedReviewVersion && (
          <div className='tiptap-editor-container review-editor-container'>
            <button onClick={handleCloseReview} className="close-review-button">Close Review</button>
            <TiptapEditor 
              key={selectedReviewVersion.id}
              initialContent={selectedReviewVersion.content}
              onContentChange={() => {}}
              isEditable={true}
            />
          </div>
        )}
      </div>
    </main>
  );
} 