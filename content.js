// content.js

// Create a container div
const container = document.createElement('div');
container.id = 'paper-processor-extension-container';

// Style the container
container.style.position = 'fixed';
container.style.top = '0';
container.style.right = '0';
container.style.width = '300px';
container.style.height = '100%';
container.style.backgroundColor = '#f0f0f0';
container.style.zIndex = '9999';
container.style.borderLeft = '1px solid #ccc';
container.style.boxShadow = '-3px 0 5px rgba(0,0,0,0.1)';
container.style.overflowY = 'auto';
container.style.padding = '10px';

// Create a close button
const closeButton = document.createElement('button');
closeButton.textContent = 'Close';
closeButton.style.position = 'absolute';
closeButton.style.top = '10px';
closeButton.style.right = '10px';
closeButton.onclick = () => {
  container.style.display = 'none';
};

container.appendChild(closeButton);

// Create the form
const form = document.createElement('form');

// PDF URL input
const pdfUrlLabel = document.createElement('label');
pdfUrlLabel.textContent = 'PDF URL:';
form.appendChild(pdfUrlLabel);

const pdfUrlInput = document.createElement('input');
pdfUrlInput.type = 'text';
pdfUrlInput.name = 'pdfUrl';
pdfUrlInput.style.width = '100%';
pdfUrlInput.required = true;
form.appendChild(pdfUrlInput);

// Line break
form.appendChild(document.createElement('br'));
form.appendChild(document.createElement('br'));

// OpenAI API Key input
const apiKeyLabel = document.createElement('label');
apiKeyLabel.textContent = 'OpenAI API Key:';
form.appendChild(apiKeyLabel);

const apiKeyInput = document.createElement('input');
apiKeyInput.type = 'text';
apiKeyInput.name = 'apiKey';
apiKeyInput.style.width = '100%';
apiKeyInput.required = true;
form.appendChild(apiKeyInput);

// Line break
form.appendChild(document.createElement('br'));
form.appendChild(document.createElement('br'));

// Go button
const goButton = document.createElement('button');
goButton.type = 'submit';
goButton.textContent = 'Go';
form.appendChild(goButton);

container.appendChild(form);

// Append the container to the body
document.body.appendChild(container);

// Handle form submission
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const pdfUrl = pdfUrlInput.value;
  const apiKey = apiKeyInput.value;
  
  if (!pdfUrl || !apiKey) {
    alert('Please enter both PDF URL and OpenAI API Key.');
    return;
  }
  
  // Store the API key in chrome.storage for later use
  chrome.storage.local.set({ openaiApiKey: apiKey });
  
  // Send a message to the background script to process the paper
  chrome.runtime.sendMessage({
    action: 'processPaper',
    pdfUrl: pdfUrl
  }, (response) => {
    if (response && response.status === 'success') {
      // Display the extracted text
      displayExtractedText(response.extractedText);
    } else {
      alert('Error processing paper: ' + response.error);
    }
  });
});

// Function to display the extracted text
function displayExtractedText(text) {
  // Create a textarea to show the extracted text
  const textArea = document.createElement('textarea');
  textArea.style.width = '100%';
  textArea.style.height = '200px';
  textArea.value = text;
  
  // Create a copy to clipboard button
  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy Text';
  copyButton.onclick = () => {
    textArea.select();
    document.execCommand('copy');
    alert('Text copied to clipboard.');
  };
  
  container.appendChild(textArea);
  container.appendChild(copyButton);
  
  // Create a button to process the references
  const processReferencesButton = document.createElement('button');
  processReferencesButton.textContent = 'Process References';
  processReferencesButton.onclick = () => {
    processReferences();
  };
  
  container.appendChild(document.createElement('br'));
  container.appendChild(document.createElement('br'));
  container.appendChild(processReferencesButton);
}

// Function to process references
function processReferences() {
  // Send a message to the background script to process references
  chrome.runtime.sendMessage({
    action: 'processReferences'
  }, (response) => {
    if (response && response.status === 'success') {
      // Display the first reference extracted text
      displayFirstReferenceText(response.referenceText);
    } else {
      alert('Error processing references: ' + response.error);
    }
  });
}

// Function to display the first reference text
function displayFirstReferenceText(text) {
  // Create a textarea to show the reference text
  const textArea = document.createElement('textarea');
  textArea.style.width = '100%';
  textArea.style.height = '200px';
  textArea.value = text;
  
  container.appendChild(document.createElement('br'));
  container.appendChild(textArea);
}