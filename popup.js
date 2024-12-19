// popup.js

// Get references to the UI elements
const pdfUrlInput = document.getElementById('pdfUrl');
const apiKeyInput = document.getElementById('apiKey');
const goButton = document.getElementById('goButton');
const extractedTextArea = document.getElementById('extractedText');
const copyButton = document.getElementById('copyButton');
const processReferencesButton = document.getElementById('processReferencesButton');
const referenceTextArea = document.getElementById('referenceText');
import { PaperProcessor, isArxivPdfUrl, LinkFinder } from './paperProcessor.js';

// Add event listeners
goButton.addEventListener('click', async () => {
  const pdfUrl = pdfUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!pdfUrl || !apiKey) {
    alert('Please enter both PDF URL and OpenAI API Key.');
    return;
  }

  // Create a new PaperProcessor instance
  const paperProcessor = new PaperProcessor(apiKey);

  try {
    // Process the initial paper without processing references
    const [allText, imagesList] = await paperProcessor.processInitialPaper(pdfUrl);

    // Store the processor instance for later use
    window.paperProcessor = paperProcessor;

    // Display the extracted text
    extractedTextArea.value = allText;
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
  if (!window.paperProcessor) {
    alert('Please process a paper first.');
    return;
  }

  try {
    await window.paperProcessor.processReferences();

    const processedPapers = window.paperProcessor.getProcessedPapers();
    const paperIds = window.paperProcessor.getProcessedPaperIds();

    if (paperIds.length > 1) {
      const firstReferenceId = paperIds[1]; // Index 0 is the initial paper
      const paperData = window.paperProcessor.getPaperData(firstReferenceId);
      const referenceText = paperData['text_content'];
      referenceTextArea.value = referenceText;
    } else {
      alert('No references found.');
    }
  } catch (error) {
    console.error('Error processing references:', error);
    alert('Error processing references: ' + error.message);
  }
});