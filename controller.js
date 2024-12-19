// controller.js

const { PaperProcessor, isArxivPdfUrl } = require('./paperProcessor');
const path = require('path');

// Hardcoded inputs
const paperUrl = 'https://arxiv.org/pdf/2106.14835.pdf';  // Example arXiv PDF URL
const openaiApiKey = process.env.OPENAI_API_KEY || 'openaikey';  // Replace with your API key

async function main() {
    // Validate the provided URL
    if (isArxivPdfUrl(paperUrl)) {
        console.log('Valid arXiv PDF URL.');
    } else {
        // Attempt to correct the URL by adding '.pdf' if missing
        let pdfUrlWithPdf = paperUrl;
        if (!paperUrl.endsWith('.pdf')) {
            pdfUrlWithPdf = paperUrl + '.pdf';
        }
        if (isArxivPdfUrl(pdfUrlWithPdf)) {
            console.log(`URL corrected to include .pdf extension: ${pdfUrlWithPdf}`);
            paperUrl = pdfUrlWithPdf;
        } else {
            console.error('Invalid arXiv PDF URL provided after correction.');
            throw new Error('Invalid arXiv PDF URL provided.');
        }
    }

    // Initialize PaperProcessor
    const processor = new PaperProcessor(openaiApiKey);

    // Process the initial paper without processing references
    const [allText, imagesList] = await processor.processInitialPaper(paperUrl);

    // Print extracted text and images
    console.log('\nExtracted Text from Initial Paper:');
    console.log(allText);

    console.log('\nExtracted Images from Initial Paper:');
    for (const img of imagesList) {
        console.log(img);
    }

    // Now, request to process references
    console.log('\nProcessing references...');
    await processor.processReferences();
    console.log('References processing completed.');

    // Get the list of processed papers
    const processedPapers = processor.getProcessedPapers();
    const paperIds = processor.getProcessedPaperIds();

    // Sequentially request and print the text and images for each processed paper
    for (const arxivId of paperIds) {
        const paperData = processor.getPaperData(arxivId);
        console.log(`\nPaper arXiv ID: ${arxivId}`);
        console.log(`Text Content:\n${paperData['text_content']}`);
        console.log('Images:');
        for (const img of paperData['images']) {
            console.log(`  ${img}`);
        }
    }

    // Save the data to JSON files
    processor.saveData();
    console.log('\nProcess completed successfully!');
    console.log(`- All data saved in the folder: ${processor.folderName}`);
}

main().catch(err => {
    console.error('An error occurred:', err);
});