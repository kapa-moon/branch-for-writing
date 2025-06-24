import React, { useEffect, useState } from 'react';

const WritingCanvas: React.FC = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [autoSaveIntervalId, setAutoSaveIntervalId] = useState(null);

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

  return (
    // Rest of the component code
  );
};

export default WritingCanvas; 