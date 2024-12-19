// popup.js

// Get references to the UI elements
const pdfUrlInput = document.getElementById('pdfUrl');
const apiKeyInput = document.getElementById('apiKey');
const goButton = document.getElementById('goButton');
const extractedTextArea = document.getElementById('extractedText');
const copyButton = document.getElementById('copyButton');
const processReferencesButton = document.getElementById('processReferencesButton');
const referenceTextArea = document.getElementById('referenceText');
const imagesContainer = document.getElementById('imagesContainer');
const referencesSelect = document.getElementById('referencesSelect');

// Storage for processorId
let processorId = null;

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
      // Store the processorId
      processorId = result.processorId;

      // Display the extracted text
      extractedTextArea.value = result.extractedText;

      // Display the images
      displayImages(result.images);

    } else {
      alert('Error processing paper: ' + result.error);
    }
  } catch (error) {
    console.error('Error processing paper:', error);
    alert('Error processing paper: ' + error.message);
  }
});

function displayImages(imagesList) {
  imagesContainer.innerHTML = ''; // Clear any existing images

  imagesList.forEach((imagePath) => {
    const img = document.createElement('img');
    img.src = `http://localhost:3000/getImage?processorId=${processorId}&imagePath=${encodeURIComponent(imagePath)}`;
    img.classList.add('draggable-image');

    // Enable dragging
    img.draggable = true;
    img.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/uri-list', img.src);
    });

    imagesContainer.appendChild(img);
  });
}

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

      if (!processorId) {
        alert('No paper has been processed yet.');
        return;
      }

      // Send a request to the server to process references
      const response = await fetch('http://localhost:3000/processReferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey: apiKey, processorId: processorId })
      });

      const processResult = await response.json();

      if (processResult.status === 'success') {
        // Populate the referencesSelect with the references
        populateReferencesSelect(processResult.references);
      } else {
        alert('Error processing references: ' + processResult.error);
      }
    });
  } catch (error) {
    console.error('Error processing references:', error);
    alert('Error processing references: ' + error.message);
  }
});

function populateReferencesSelect(references) {
  referencesSelect.innerHTML = ''; // Clear existing options

  // Add a default option
  const defaultOption = document.createElement('option');
  defaultOption.text = 'Select a reference';
  defaultOption.value = '';
  referencesSelect.add(defaultOption);

  references.forEach((ref) => {
    const option = document.createElement('option');
    option.text = ref.referenceTitle.substring(0, 50); // Show first 50 characters
    option.value = ref.arxivId || ref.referenceTitle; // Use arxivId if available
    referencesSelect.add(option);
  });

  referencesSelect.addEventListener('change', onReferenceSelect);
}

async function onReferenceSelect() {
  const selectedValue = referencesSelect.value;

  if (!selectedValue) {
    referenceTextArea.value = '';
    imagesContainer.innerHTML = ''; // Clear images
    return;
  }

  try {
    // Retrieve the API key from storage
    chrome.storage.local.get('openaiApiKey', async (storageResult) => {
      const apiKey = storageResult.openaiApiKey;
      if (!apiKey) {
        alert('Please enter your OpenAI API Key.');
        return;
      }

      const arxivId = selectedValue;

      // Send a request to get the paper data for the selected reference
      const response = await fetch(`http://localhost:3000/getPaperData?apiKey=${encodeURIComponent(apiKey)}&processorId=${encodeURIComponent(processorId)}&arxivId=${encodeURIComponent(arxivId)}`, {
        method: 'GET',
      });

      const result = await response.json();

      if (result.status === 'success') {
        // Display the reference text
        referenceTextArea.value = result.paperData.text_content;

        // Display images for the reference paper
        displayImages(result.paperData.images);

      } else {
        // If no paper data found, display the reference text
        referenceTextArea.value = referencesSelect.options[referencesSelect.selectedIndex].text;
        imagesContainer.innerHTML = ''; // Clear images
      }
    });
  } catch (error) {
    console.error('Error retrieving reference data:', error);
    alert('Error retrieving reference data: ' + error.message);
  }
}