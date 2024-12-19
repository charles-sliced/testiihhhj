// server.js

const express = require('express');
const bodyParser = require('body-parser');
const PaperProcessor = require('./paperProcessor');

const app = express();
const port = 3000; // You can change the port if needed

app.use(bodyParser.json());

// Endpoint to process the initial paper
app.post('/processPaper', async (req, res) => {
  const { pdfUrl, apiKey } = req.body;

  if (!pdfUrl || !apiKey) {
    return res.status(400).json({ status: 'error', error: 'Please provide both pdfUrl and apiKey' });
  }

  try {
    // Create a new instance of PaperProcessor
    const paperProcessor = new PaperProcessor(apiKey);
    // Process the initial paper without processing references
    const [allText, imagesList] = await paperProcessor.processInitialPaper(pdfUrl);

    if (!allText) {
      throw new Error('Failed to process paper.');
    }

    // Store the processor instance for later use (in memory for demonstration purposes)
    // In production, consider using a proper session management or database
    global.paperProcessor = paperProcessor;

    res.json({ status: 'success', extractedText: allText });
  } catch (error) {
    console.error('Error processing paper:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Endpoint to process references
app.post('/processReferences', async (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ status: 'error', error: 'Please provide apiKey' });
  }

  try {
    if (!global.paperProcessor) {
      throw new Error('No initial paper processed yet.');
    }

    // Use the stored processor instance
    const paperProcessor = global.paperProcessor;

    await paperProcessor.processReferences();

    const processedPapers = paperProcessor.getProcessedPapers();
    const paperIds = paperProcessor.getProcessedPaperIds();

    if (paperIds.length > 1) {
      const firstReferenceId = paperIds[1]; // Index 0 is the initial paper
      const paperData = paperProcessor.getPaperData(firstReferenceId);
      const referenceText = paperData['text_content'];
      res.json({ status: 'success', referenceText: referenceText });
    } else {
      res.status(404).json({ status: 'error', error: 'No references found.' });
    }
  } catch (error) {
    console.error('Error processing references:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Paper Processor server running at http://localhost:${port}`);
});