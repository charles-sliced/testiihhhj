// background.js

import { PaperProcessor, isArxivPdfUrl } from './paperProcessor.js';

chrome.runtime.onInstalled.addListener(() => {
  // Initialize any necessary storage or data
  console.log('Paper Processor Extension installed.');
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'processPaper') {
    const pdfUrl = message.pdfUrl;
    try {
      const apiKey = await getApiKey();
      const paperProcessor = new PaperProcessor(apiKey);
      // Process the initial paper without processing references
      const [allText, imagesList] = await paperProcessor.processInitialPaper(pdfUrl);
      // Store the processor instance for later use
      window.paperProcessor = paperProcessor;
      sendResponse({ status: 'success', extractedText: allText });
    } catch (error) {
      sendResponse({ status: 'error', error: error.message });
    }
    return true; // Indicate that we will send response asynchronously
  } else if (message.action === 'processReferences') {
    try {
      if (!window.paperProcessor) {
        throw new Error('PaperProcessor instance not found.');
      }
      await window.paperProcessor.processReferences();
      const processedPapers = window.paperProcessor.getProcessedPapers();
      const paperIds = window.paperProcessor.getProcessedPaperIds();

      if (paperIds.length > 1) {
        const firstReferenceId = paperIds[1]; // Index 0 is the initial paper
        const paperData = window.paperProcessor.getPaperData(firstReferenceId);
        const referenceText = paperData['text_content'];
        sendResponse({ status: 'success', referenceText: referenceText });
      } else {
        sendResponse({ status: 'error', error: 'No references found.' });
      }
    } catch (error) {
      sendResponse({ status: 'error', error: error.message });
    }
    return true;
  }
});

// Function to get the OpenAI API key from storage
async function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('openaiApiKey', (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result.openaiApiKey);
      }
    });
  });
}