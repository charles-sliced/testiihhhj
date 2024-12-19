// paperProcessor.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pdfParse = require('pdf-parse'); // For PDF text extraction
const { PDFImage } = require('pdf-image'); // For image extraction

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

// DataExtractor class for modular data extraction
class DataExtractor {
  constructor(folderName) {
    this.folderName = folderName;
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
        // Save PDF to folder
        const pdfFilePath = path.join(this.folderName, `${arxivId}.pdf`);
        fs.writeFileSync(pdfFilePath, pdfData);
        return pdfFilePath;
      } else {
        console.error(
          `Failed to download paper from ${pdfUrl}. Status Code: ${response.status}`
        );
        return null;
      }
    } catch (err) {
      console.error(`Error downloading paper from ${pdfUrl}: ${err}`);
      return null;
    }
  }

  async extractTextAndImages(pdfFilePath, arxivId) {
    // Read PDF data from file
    let pdfData;
    try {
      pdfData = fs.readFileSync(pdfFilePath);
    } catch (err) {
      console.error(`Error reading PDF file ${pdfFilePath}: ${err}`);
      return [null, null];
    }
    // Extract text using pdf-parse
    let allText = '';
    try {
      const data = await pdfParse(pdfData);
      allText = data.text;
    } catch (err) {
      console.error(`Error extracting text from PDF data: ${err}`);
      return [null, null];
    }

    // Extract images using pdf-image
    const imagesList = [];
    try {
      const pdfImage = new PDFImage(pdfFilePath, {
        convertOptions: {
          '-density': '300',
          '-quality': '100',
        },
        outputDirectory: this.folderName,
      });

      const numPages = await pdfImage.numberOfPages();

      for (let pageNumber = 0; pageNumber < numPages; pageNumber++) {
        const imagePath = await pdfImage.convertPage(pageNumber);
        imagesList.push(imagePath);
        console.log(`Extracted image: ${imagePath}`);
      }
    } catch (err) {
      console.error(`Error extracting images from PDF data: ${err}`);
      // Continue without images
    }

    console.log(
      `Text and images extraction completed for arXiv ID ${arxivId}.`
    );
    return [allText, imagesList];
  }
}

// PaperProcessor class
class PaperProcessor {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.processedPapers = {};
    this.allPapersData = {};
    this.folderName = path.join(__dirname, 'papers', Date.now().toString());
    if (!fs.existsSync(this.folderName)) {
      fs.mkdirSync(this.folderName, { recursive: true });
    }
  }

  async processPaper(paperUrl) {
    const arxivId = getArxivIdFromUrl(paperUrl);
    if (arxivId === null) {
      console.error(`Could not extract arXiv ID from URL: ${paperUrl}`);
      return [null, null];
    }
    // Check if paper has already been processed
    if (this.processedPapers[arxivId]) {
      console.log(
        `Paper with arXiv ID ${arxivId} has already been processed. Skipping to avoid duplicates.`
      );
      return [null, null];
    }

    // Mark as processed
    this.processedPapers[arxivId] = true;

    const dataExtractor = new DataExtractor(this.folderName);

    // Download PDF
    const pdfFilePath = await dataExtractor.downloadPdf(paperUrl, arxivId);
    if (pdfFilePath === null) {
      return [null, null];
    }

    // Extract text and images
    const [allText, imagesList] = await dataExtractor.extractTextAndImages(
      pdfFilePath,
      arxivId
    );
    if (allText === null) {
      return [null, null];
    }

    // Clean up: delete the temporary PDF file
    fs.unlinkSync(pdfFilePath);

    // Update instance papers data
    this.allPapersData[arxivId] = {
      arxiv_id: arxivId,
      pdf_url: paperUrl,
      images: imagesList,
      text_content: allText,
    };

    return [allText, imagesList];
  }

  async processInitialPaper(paperUrl) {
    return await this.processPaper(paperUrl);
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

module.exports = {
  PaperProcessor,
  isArxivPdfUrl, // Export the function here
};