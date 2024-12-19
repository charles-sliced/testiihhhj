// server.js

const express = require('express');
const bodyParser = require('body-parser');
const { PaperProcessor, isArxivPdfUrl } = require('./paperProcessor');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000; // You can change the port if needed

app.use(bodyParser.json());

// Store the paper processors (could be in memory or in a more persistent storage)
const paperProcessors = {};

// Endpoint to process the initial paper
app.post('/processPaper', async (req, res) => {
  let { pdfUrl, apiKey } = req.body;

  if (!pdfUrl || !apiKey) {
    return res.status(400).json({
      status: 'error',
      error: 'Please provide both pdfUrl and apiKey',
    });
  }

  // Validate the provided URL
  if (!isArxivPdfUrl(pdfUrl)) {
    // Attempt to correct the URL by adding '.pdf' if missing
    let correctedUrl = pdfUrl;
    if (!pdfUrl.endsWith('.pdf')) {
      correctedUrl = pdfUrl + '.pdf';
      if (!isArxivPdfUrl(correctedUrl)) {
        return res
          .status(400)
          .json({ status: 'error', error: 'Invalid arXiv PDF URL provided.' });
      }
    } else {
      return res
        .status(400)
        .json({ status: 'error', error: 'Invalid arXiv PDF URL provided.' });
    }
    pdfUrl = correctedUrl;
  }

  try {
    // Initialize PaperProcessor
    const processor = new PaperProcessor(apiKey);

    // Process the initial paper
    const [allText, imagesList] = await processor.processInitialPaper(pdfUrl);

    if (!allText) {
      throw new Error('Failed to process paper.');
    }

    // Store the processor instance (use a unique ID or session management)
    const processorId = processor.folderName;
    paperProcessors[processorId] = processor;

    res.json({
      status: 'success',
      processorId: processorId,
      extractedText: allText,
      images: imagesList,
    });
  } catch (error) {
    console.error('Error processing paper:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Endpoint to serve images
app.get('/getImage', (req, res) => {
  const { processorId, imagePath } = req.query;

  if (!processorId || !imagePath) {
    return res.status(400).json({
      status: 'error',
      error: 'Please provide processorId and imagePath',
    });
  }

  try {
    const processor = paperProcessors[processorId];
    if (!processor) {
      throw new Error('No processor found for the given processorId.');
    }

    // Validate and resolve the image path
    const fullImagePath = path.resolve(imagePath);

    if (!fullImagePath.startsWith(processor.folderName)) {
      throw new Error('Invalid image path.');
    }

    if (!fs.existsSync(fullImagePath)) {
      throw new Error('Image file not found.');
    }

    res.sendFile(fullImagePath);
  } catch (error) {
    console.error('Error getting image:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Paper Processor server running at http://localhost:${port}`);
});