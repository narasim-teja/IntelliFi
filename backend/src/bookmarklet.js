javascript: (function (s) {
    function findMessagesContainer() {
      // Try different selectors that might match the messages container
      const selectors = [
        // Original selector
        "x78zum5 xdt5ytf x1iyjqo2 xs83m0k x1xzczws x6ikm8r x1rife3k x1n2onr6 xh8yej3",
        // Common parent elements in Messenger
        "x1cy8zhl x78zum5 x1q0g3np",
        "x78zum5"
      ];
  
      for (const selector of selectors) {
        const elements = document.getElementsByClassName(selector);
        for (let i = 0; i < elements.length; i++) {
          // Check if this element contains message content
          if (elements[i].querySelector('img')) {
            return elements[i];
          }
        }
      }
      return null;
    }
  
    async function convertToDownloadableUrl(imgElement) {
      const src = imgElement.src;
      
      // If it's already an https URL, return as is
      if (src.startsWith('https://')) {
        return src;
      }
  
      // If it's a blob URL
      if (src.startsWith('blob:')) {
        try {
          const response = await fetch(src);
          const blob = await response.blob();
          return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Error converting blob URL:', error);
          return null;
        }
      }
  
      // If it's a data URL, return as is
      if (src.startsWith('data:')) {
        return src;
      }
  
      return null;
    }
  
    function initializeObserver() {
      const container = findMessagesContainer();
      if (!container) {
        console.log("Messages container not found, retrying in 1 second...");
        setTimeout(initializeObserver, 1000);
        return;
      }
  
      console.log("Found messages container, setting up observer...");
  
      // Remove any existing observers
      if (window._messageObserver) {
        window._messageObserver.disconnect();
      }
  
      // Create a new mutation observer to watch for new messages
      window._messageObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(async (node) => {
              if (node.nodeType === 1) { // ELEMENT_NODE
                const images = node.getElementsByTagName('img');
                for (let img of images) {
                  if (img.src && !img.dataset.processed) {
                    img.dataset.processed = 'true';
                    try {
                      const downloadableUrl = await convertToDownloadableUrl(img);
                      if (!downloadableUrl) {
                        console.error('Could not convert image URL:', img.src);
                        continue;
                      }
  
                      const res = await fetch("http://localhost:3103/api/vision", {
                        method: "POST",
                        body: JSON.stringify({ imageUrl: downloadableUrl }),
                        headers: {
                          "Content-Type": "application/json",
                        },
                      });
                      const data = await res.json();
                      console.log("Vision API Response:", data);
                      console.log("Image saved locally at:", data.savedImagePath);
                      console.log("Image description:", data.content);
                    } catch (error) {
                      console.error("Error processing image:", error);
                    }
                  }
                }
              }
            });
          }
        });
      });
  
      // Start observing the container with the configured parameters
      window._messageObserver.observe(container, {
        childList: true,
        subtree: true
      });
  
      alert("Successfully added Messenger Chat Observer!");
    }
  
    // Start the initialization process
    initializeObserver();
  })();
  