function debugTextChanges() {
    console.log('=== DEBUGGING SPECIFIC TEXT CHANGES ===');
    
    let lastKnownText = '';
    let changeCount = 0;
    
    if (window.extractGoogleDocsText) {
      lastKnownText = window.extractGoogleDocsText();
      console.log('Starting text length:', lastKnownText.length);
      console.log('Starting text preview:', lastKnownText.substring(0, 100));
    }
    
    // Check for changes every 500ms
    const checkInterval = setInterval(() => {
      const currentText = window.extractGoogleDocsText();
      
      if (currentText !== lastKnownText) {
        changeCount++;
        console.log(`\nCHANGE #${changeCount} DETECTED!`);
        console.log('Old length:', lastKnownText.length);
        console.log('New length:', currentText.length);
        console.log('Difference:', currentText.length - lastKnownText.length, 'chars');
        
        // Find where the change occurred
        let diffStart = 0;
        while (diffStart < Math.min(lastKnownText.length, currentText.length) && 
               lastKnownText[diffStart] === currentText[diffStart]) {
          diffStart++;
        }
        
        console.log('Change starts at position:', diffStart);
        console.log('Old text around change:', lastKnownText.substring(Math.max(0, diffStart-20), diffStart+20));
        console.log('New text around change:', currentText.substring(Math.max(0, diffStart-20), diffStart+20));
        
        // Show the end of both texts (in case changes are at the end)
        console.log('Old text ending:', lastKnownText.substring(Math.max(0, lastKnownText.length-50)));
        console.log('New text ending:', currentText.substring(Math.max(0, currentText.length-50)));
        
        lastKnownText = currentText;
      }
    }, 500);
    
    // Stop after 2 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('Stopped monitoring text changes');
    }, 12000);
    
    console.log('Monitoring text changes. Start typing...');
}
  
debugTextChanges();
