// popup.js

// Get references to the UI elements
const pdfUrlInput = document.getElementById('pdfUrl');
const goButton = document.getElementById('goButton');
const extractedTextArea = document.getElementById('extractedText');
const copyButton = document.getElementById('copyButton');
const imagesContainer = document.getElementById('imagesContainer');

// Storage for processorId
let processorId = null;

// Add event listener for the "Process Paper" button
goButton.addEventListener('click', async () => {
  const pdfUrl = pdfUrlInput.value.trim();

  if (!pdfUrl) {
    alert('Please enter the PDF URL.');
    return;
  }

  try {
    // Send a request to the server to process the paper
    const response = await fetch('http://localhost:3000/processPaper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pdfUrl: pdfUrl })
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

// Function to display images
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

// Event listener for the "Copy Text" button
copyButton.addEventListener('click', () => {
  extractedTextArea.select();
  document.execCommand('copy');
  alert('Text copied to clipboard.');
});