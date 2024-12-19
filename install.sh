#!/bin/bash

# Define the target directory
TARGET_DIR="$HOME/Desktop/paper_processor/lib"

# Create the target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

# Define URLs for the libraries
AXIOS_URL="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"
PDFJS_URL="https://unpkg.com/pdfjs-dist@2.10.377/es5/build/pdf.js"
PDF_WORKER_URL="https://unpkg.com/pdfjs-dist@2.10.377/es5/build/pdf.worker.js"

# Download axios.min.js
echo "Downloading axios.min.js..."
curl -o "$TARGET_DIR/axios.min.js" "$AXIOS_URL"

# Download pdf.js (UMD version)
echo "Downloading pdf.js (UMD version)..."
curl -o "$TARGET_DIR/pdf.js" "$PDFJS_URL"

# Download pdf.worker.js (UMD version)
echo "Downloading pdf.worker.js (UMD version)..."
curl -o "$TARGET_DIR/pdf.worker.js" "$PDF_WORKER_URL"

# Verify the files were downloaded
if [[ -f "$TARGET_DIR/axios.min.js" && -f "$TARGET_DIR/pdf.js" && -f "$TARGET_DIR/pdf.worker.js" ]]; then
  echo "All libraries downloaded successfully to $TARGET_DIR"
else
  echo "Failed to download one or more libraries. Please check your internet connection and try again."
fi
