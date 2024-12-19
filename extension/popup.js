// Get references to the UI elements
const pdfUrlInput = document.getElementById('pdfUrl');
const apiKeyInput = document.getElementById('apiKey');
const goButton = document.getElementById('goButton');
const extractedTextArea = document.getElementById('extractedText');
const copyButton = document.getElementById('copyButton');
const processReferencesButton = document.getElementById('processReferencesButton');
const referenceTextArea = document.getElementById('referenceText');

// Add event listeners
goButton.addEventListener('click', async () => {
  const pdfUrl = pdfUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!pdfUrl || !apiKey) {
    alert('Please enter both PDF URL and OpenAI API Key.');
    return;
  }

  // Store the API key in chrome.storage for later use
  chrome.storage.local.set({ openaiApiKey: apiKey });

  try {
    // Send a request to the server to process the paper
    const response = await fetch('http://localhost:3000/processPaper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pdfUrl: pdfUrl, apiKey: apiKey })
    });

    const result = await response.json();

    if (result.status === 'success') {
      // Display the extracted text
      extractedTextArea.value = result.extractedText;
    } else {
      alert('Error processing paper: ' + result.error);
    }
  } catch (error) {
    console.error('Error processing paper:', error);
    alert('Error processing paper: ' + error.message);
  }
});

copyButton.addEventListener('click', () => {
  extractedTextArea.select();
  document.execCommand('copy');
  alert('Text copied to clipboard.');
});

processReferencesButton.addEventListener('click', async () => {
  try {
    // Retrieve the API key from storage
    chrome.storage.local.get('openaiApiKey', async (storageResult) => {
      const apiKey = storageResult.openaiApiKey;
      if (!apiKey) {
        alert('Please enter your OpenAI API Key.');
        return;
      }

      // Send a request to the server to process references
      const response = await fetch('http://localhost:3000/processReferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey: apiKey })
      });

      const processResult = await response.json();

      if (processResult.status === 'success') {
        const referenceText = processResult.referenceText;
        referenceTextArea.value = referenceText;
      } else {
        alert('Error processing references: ' + processResult.error);
      }
    });
  } catch (error) {
    console.error('Error processing references:', error);
    alert('Error processing references: ' + error.message);
  }
});
