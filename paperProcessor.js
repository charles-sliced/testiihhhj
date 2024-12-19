// paperProcessor.js

import * as pdfjsLib from './lib/pdf.js';
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
    this.imagesData = {};
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
    
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.js');
    // Use pdf.js to extract text and images from the PDF data
    let allText = '';
    let imagesList = [];

    try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);

            // Extract text
            const textContent = await page.getTextContent();
            const strings = textContent.items.map(item => item.str);
            allText += strings.join(' ') + '\n';

            // Extract images (basic implementation, may need enhancement)
            const ops = await page.getOperatorList();
            for (let i = 0; i < ops.fnArray.length; i++) {
                if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
                    const imgName = ops.argsArray[i][0];
                    const img = await page.objs.get(imgName);
                    imagesList.push(img);
                }
            }
        } // Close the `for` loop here

    } catch (err) {
        console.error(`Error extracting text and images from PDF: ${err}`);
        return [null, null];
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
    this.allReferencesData = [];

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
      pdf_data: pdfData,
      images: imagesList,
      references_processed: false,
      text_content: allText
    };

    if (processReferences) {
      // Process references
      const referencesList = await this.linkFinder.extractReferences(allText);
      const referencesData = await this.linkFinder.findReferencePdfs(referencesList);

      // Append references data to global list
      this.allReferencesData.push(...referencesData);

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

      // Append references data to global list
      this.allReferencesData.push(...referencesData);

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

  // Since we're not using the file system, we don't need saveData, so it's omitted
}

export { PaperProcessor, isArxivPdfUrl, LinkFinder };