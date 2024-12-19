// paperProcessor.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pdfParse = require('pdf-parse'); // For PDF text extraction
const { PDFImage } = require('pdf-image'); // For image extraction
const fetch = require('node-fetch'); // For OpenAI API calls

// Function to check if a URL is an arXiv PDF URL
function isArxivPdfUrl(url) {
  const pattern = /^https?:\/\/arxiv\.org\/pdf\/\d{4}\.\d+(v\d+)?(\.pdf)?$/;
  return pattern.test(url);
}

// Function to extract arXiv ID from a URL
function getArxivIdFromUrl(url) {
  const pattern = /^https?:\/\/arxiv\.org\/pdf\/(\d{4}\.\d+)(v\d+)?(\.pdf)?$/;
  const match = url.match(pattern);
  if (match) {
    let arxivId = match[1];
    if (match[2]) {
      arxivId += match[2];
    }
    return arxivId;
  } else {
    return null;
  }
}

// Check if a string is a valid arXiv ID
function isValidArxivId(arxiv_id) {
  const pattern = /^\d{4}\.\d+(v\d+)?$/;
  return pattern.test(arxiv_id);
}

// DataExtractor class for modular data extraction
class DataExtractor {
  constructor() {
    // You can initialize any variables or settings here if needed
  }

  async downloadPdf(pdfUrl, arxivId) {
    // Ensure the URL ends with .pdf
    if (!pdfUrl.endsWith('.pdf')) {
      pdfUrl += '.pdf';
    }
    try {
      const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      if (response.status === 200) {
        const pdfData = response.data;
        console.log(`Downloaded paper from ${pdfUrl}`);
        return pdfData;
      } else {
        console.error(`Failed to download paper from ${pdfUrl}. Status Code: ${response.status}`);
        return null;
      }
    } catch (err) {
      console.error(`Error downloading paper from ${pdfUrl}: ${err}`);
      return null;
    }
  }

  async extractTextAndImages(pdfData, arxivId) {
    // Extract text using pdf-parse
    let allText = '';
    try {
      const data = await pdfParse(pdfData);
      allText = data.text;
    } catch (err) {
      console.error(`Error extracting text from PDF data: ${err}`);
      return [null, null];
    }

    // Extract images using pdf-image (requires saving the PDF to disk first)
    const imagesList = [];
    try {
      // Save PDF to a temporary file
      const pdfFilePath = path.join(__dirname, `${arxivId}.pdf`);
      fs.writeFileSync(pdfFilePath, pdfData);

      const pdfImage = new PDFImage(pdfFilePath, {
        convertOptions: {
          '-density': '300',
          '-quality': '100'
        }
      });

      const numPages = await pdfImage.numberOfPages();

      for (let pageNumber = 0; pageNumber < numPages; pageNumber++) {
        const imagePath = await pdfImage.convertPage(pageNumber);
        imagesList.push(imagePath);
        console.log(`Extracted image: ${imagePath}`);
      }

      // Clean up: delete the temporary PDF file
      fs.unlinkSync(pdfFilePath);
    } catch (err) {
      console.error(`Error extracting images from PDF data: ${err}`);
      // Continue without images
    }

    console.log(`Text and images extraction completed for arXiv ID ${arxivId}.`);
    return [allText, imagesList];
  }
}

// LinkFinder class for modular link finding
class LinkFinder {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async extractReferences(allText) {
    // Extract the 'References' section from the text
    function extractReferencesSection(text) {
      let match = text.match(/References\s*\n([\s\S]*)/i);
      if (match) {
        return match[1];
      } else {
        // Attempt to find 'Bibliography' if 'References' is not found
        match = text.match(/Bibliography\s*\n([\s\S]*)/i);
        if (match) {
          return match[1];
        }
      }
      return '';
    }

    const referencesText = extractReferencesSection(allText);

    // Use OpenAI API to extract the list of references
    const referencesPrompt = `Extract all the references from the following text and provide them in a numbered list:\n${referencesText}`;

    let referencesListText;
    try {
      referencesListText = await this.callOpenAI(referencesPrompt);
      console.log('References extracted using OpenAI API.');
    } catch (err) {
      console.error(`Error during OpenAI API call: ${err}`);
      return [];
    }

    // Parse the references into a list
    function parseNumberedList(text) {
      const lines = text.trim().split('\n');
      const references = [];
      for (const line of lines) {
        const match = line.match(/^\d+\.\s*(.+)/);
        if (match) {
          references.push(match[1].trim());
        } else {
          references.push(line.trim());
        }
      }
      return references;
    }

    const referencesList = parseNumberedList(referencesListText);
    return referencesList;
  }

  async callOpenAI(promptText, systemPrompt = null) {
    const url = 'https://api.openai.com/v1/chat/completions';

    const data = {
      model: 'gpt-3.5-turbo',
      messages: []
    };

    if (systemPrompt) {
      data.messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    data.messages.push({
      role: 'user',
      content: promptText
    });

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.apiKey
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('OpenAI API request failed: ' + response.statusText);
    }

    const result = await response.json();

    const content = result.choices[0].message.content.trim();
    return content;
  }

  async findArxivPdfLinkForReference(reference) {
    // Use OpenAI to find arXiv ID
    const prompt = `Find the arXiv ID for the following reference. Provide only the arXiv ID, in the format 'XXXX.XXXXX' or 'XXXX.XXXXXvY'. If not available, say 'Not found'.\nReference: ${reference}`;

    let response;
    try {
      response = await this.callOpenAI(prompt);
      if (response.includes('Not found') || response.includes('No arXiv ID found')) {
        return null;
      } else {
        const arxivId = response.replace(/[^0-9v\.]/g, '');
        if (isValidArxivId(arxivId)) {
          // Construct PDF URL
          const pdfLink = `https://arxiv.org/pdf/${arxivId}.pdf`;
          return pdfLink;
        } else {
          console.log(`Invalid arXiv ID format received: ${arxivId}`);
          return null;
        }
      }
    } catch (err) {
      console.error(`Error finding arXiv PDF link for reference: ${err}`);
      return null;
    }
  }

  async findReferencePdfs(referencesList) {
    const referencesData = [];

    for (let idx = 0; idx < referencesList.length; idx++) {
      const reference = referencesList[idx];
      console.log(`Processing reference ${idx + 1}: ${reference}`);
      const arxivPdfLink = await this.findArxivPdfLinkForReference(reference);

      const cleanedPdfLink = arxivPdfLink || 'Not found';

      // Store the data
      referencesData.push({
        reference: reference,
        arxiv_pdf_link: cleanedPdfLink
      });

      // Log the search results
      console.log(`arXiv PDF link found: ${cleanedPdfLink}`);
    }

    return referencesData;
  }
}

// PaperProcessor class
class PaperProcessor {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.processedPapers = {};
    this.allPapersData = {};
    this.allReferencesData = {};

    // Initialize LinkFinder with the OpenAI API key
    this.linkFinder = new LinkFinder(this.apiKey);
  }

  async processPaper(paperUrl, processReferences = false) {
    const arxivId = getArxivIdFromUrl(paperUrl);
    if (arxivId === null) {
      console.error(`Could not extract arXiv ID from URL: ${paperUrl}`);
      return [null, null];
    }
    // Check if paper has already been processed
    if (this.processedPapers[arxivId]) {
      console.log(`Paper with arXiv ID ${arxivId} has already been processed. Skipping to avoid duplicates.`);
      return [null, null];
    }

    // Mark as processed
    this.processedPapers[arxivId] = true;

    const dataExtractor = new DataExtractor();

    // Download PDF
    const pdfData = await dataExtractor.downloadPdf(paperUrl, arxivId);
    if (pdfData === null) {
      return [null, null];
    }

    // Extract text and images
    const [allText, imagesList] = await dataExtractor.extractTextAndImages(pdfData, arxivId);
    if (allText === null) {
      return [null, null];
    }

    // Update instance papers data
    this.allPapersData[arxivId] = {
      arxiv_id: arxivId,
      pdf_url: paperUrl,
      images: imagesList,
      references_processed: false,
      text_content: allText
    };

    if (processReferences) {
      // Process references
      const referencesList = await this.linkFinder.extractReferences(allText);
      const referencesData = await this.linkFinder.findReferencePdfs(referencesList);

      // Save references data
      this.allReferencesData[arxivId] = referencesData;

      // Process each reference paper without processing their references
      for (const refData of referencesData) {
        const arxivPdfLink = refData.arxiv_pdf_link;
        if (arxivPdfLink !== 'Not found') {
          console.log(`Processing reference paper at ${arxivPdfLink}`);
          await this.processPaper(arxivPdfLink, false);
        } else {
          console.log(`No valid arXiv PDF link found for reference: ${refData.reference}`);
        }
      }

      // Mark references as processed for this paper
      this.allPapersData[arxivId].references_processed = true;
    }

    return [allText, imagesList];
  }

  async processInitialPaper(paperUrl) {
    return await this.processPaper(paperUrl, false);
  }

  async processReferences() {
    // Process references of the initial paper(s)
    // For each processed paper, if references have not been processed yet, process them
    const processedPapersSnapshot = Object.keys(this.allPapersData);
    for (const arxivId of processedPapersSnapshot) {
      const paperData = this.allPapersData[arxivId];
      if (paperData.references_processed) {
        continue;
      }
      const allText = paperData.text_content;

      const referencesList = await this.linkFinder.extractReferences(allText);
      const referencesData = await this.linkFinder.findReferencePdfs(referencesList);

      // Save references data
      this.allReferencesData[arxivId] = referencesData;

      // Mark references as processed for this paper
      this.allPapersData[arxivId].references_processed = true;

      // Process each reference paper without processing their references further
      for (const refData of referencesData) {
        const arxivPdfLink = refData.arxiv_pdf_link;
        if (arxivPdfLink !== 'Not found') {
          console.log(`Processing reference paper at ${arxivPdfLink}`);
          await this.processPaper(arxivPdfLink, false);
        } else {
          console.log(`No valid arXiv PDF link found for reference: ${refData.reference}`);
        }
      }
    }
  }

  getProcessedPapers() {
    return this.allPapersData;
  }

  getPaperData(arxivId) {
    return this.allPapersData[arxivId];
  }

  getProcessedPaperIds() {
    return Object.keys(this.allPapersData);
  }
}

module.exports = PaperProcessor;