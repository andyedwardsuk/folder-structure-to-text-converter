#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FolderToText {
  constructor() {
    this.result = [];
    this.visitedPaths = new Set();
    this.fileCount = 0;
    this.folderCount = 0;
    this.totalBytes = 0;
    this.startTime = Date.now();
    this.excludedFolders = ["node_modules"]; // Folders to exclude from conversion
    this.excludedCount = 0;
  }

  // Add metadata to the output
  addMetadata(sourcePath) {
    const date = new Date().toISOString();
    this.result.push("=== FOLDER STRUCTURE EXPORT ===");
    this.result.push(`Source: ${sourcePath}`);
    this.result.push(`Generated: ${date}`);
    this.result.push(
      `Excluded directories: ${this.excludedFolders.join(", ")}`
    );
    this.result.push("");
    this.result.push("=== BEGIN CONTENT ===");
  }

  // Finish the export
  finishExport() {
    this.result.push("=== END CONTENT ===");
  }

  // Log progress statistics
  logProgress() {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    console.log(
      `Progress: ${this.fileCount} files, ${this.folderCount} folders processed`
    );
    console.log(`Total data: ${(this.totalBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Elapsed time: ${elapsedSeconds.toFixed(1)} seconds`);
  }

  // Check if a path should be excluded
  shouldExclude(filePath) {
    const relativePath = path.basename(filePath);

    // Check if the path matches any excluded folder name
    return this.excludedFolders.some((folder) => relativePath === folder);
  }

  // Process a file
  processFile(filePath, relativePath, outputPath) {
    try {
      // Skip if already processed (prevents circular symlinks)
      if (this.visitedPaths.has(filePath)) return;
      this.visitedPaths.add(filePath);

      // Get file stats
      const stats = fs.statSync(filePath);

      // Handle directories
      if (stats.isDirectory()) {
        // Check if this directory should be excluded
        if (this.shouldExclude(filePath)) {
          this.excludedCount++;
          console.log(`Excluding directory: ${filePath}`);
          return;
        }

        // Add folder marker
        this.result.push(`--- FOLDER: ${relativePath} ---`);
        this.folderCount++;

        // Log progress every 10 folders
        if (this.folderCount % 10 === 0) {
          this.logProgress();
        }

        // Process directory contents
        try {
          const items = fs.readdirSync(filePath);
          for (const item of items) {
            const itemPath = path.join(filePath, item);
            const itemRelativePath = path.join(relativePath, item);
            this.processFile(itemPath, itemRelativePath, outputPath);

            // Periodically write results to avoid memory issues with very large folders
            if (this.result.length > 100000) {
              const tempOutput = this.result.join("\n");
              // If outputPath already exists, append to it
              if (fs.existsSync(outputPath)) {
                fs.appendFileSync(outputPath, tempOutput + "\n", "utf8");
              } else {
                fs.writeFileSync(outputPath, tempOutput + "\n", "utf8");
              }
              // Clear the result array to free memory
              this.result = [];
              console.log(
                `Intermediate write: Processed ${this.fileCount} files, ${this.folderCount} folders so far`
              );
            }
          }
        } catch (error) {
          console.warn(
            `Warning: Could not read directory ${filePath}: ${error.message}`
          );
        }
        return;
      }

      // Handle files
      if (stats.isFile()) {
        // Add file marker
        this.result.push(`--- FILE: ${relativePath} ---`);
        this.fileCount++;
        this.totalBytes += stats.size;

        // Log progress every 100 files
        if (this.fileCount % 100 === 0) {
          this.logProgress();
        }

        // Handle zero-byte files specially - they might be binary placeholders
        if (stats.size === 0) {
          const fileExt = path.extname(relativePath).toLowerCase();
          const binaryExtensions = [
            ".ico",
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".svg",
            ".webp",
            ".avif",
            ".bmp",
            ".tiff",
            ".woff",
            ".woff2",
            ".ttf",
            ".eot",
            ".otf",
          ];

          if (binaryExtensions.includes(fileExt)) {
            this.result.push(`[ZERO_BYTE_BINARY:${fileExt}]`);
            this.result.push("--- END FILE ---");
            return;
          }
        }

        // For binary files like favicon.ico and images, add a special marker with file size
        const fileExt = path.extname(relativePath).toLowerCase();
        const binaryExtensions = [
          ".ico",
          ".png",
          ".jpg",
          ".jpeg",
          ".gif",
          ".svg",
          ".webp",
          ".avif",
          ".bmp",
          ".tiff",
          ".woff",
          ".woff2",
          ".ttf",
          ".eot",
          ".otf",
        ];

        if (binaryExtensions.includes(fileExt)) {
          this.result.push(`[BINARY_FILE_PATH:${filePath}]`);
          this.result.push(`[BINARY_FILE_SIZE:${stats.size}]`);
          this.result.push(`[BINARY_FILE_EXT:${fileExt}]`);
          this.result.push("--- END FILE ---");
          return;
        }

        // Skip large files (>10MB)
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (stats.size > MAX_FILE_SIZE) {
          this.result.push(`[LARGE FILE: ${stats.size} bytes]`);
          this.result.push("--- END FILE ---");
          return;
        }

        try {
          // Try to read as text
          const content = fs.readFileSync(filePath, {
            encoding: "utf8",
            flag: "r",
          });

          // Check if content might be binary (contains null bytes or non-UTF8 characters)
          if (this.isBinaryContent(content)) {
            this.result.push("[BINARY FILE]");
          } else {
            // Add content lines
            content.split("\n").forEach((line) => {
              this.result.push(line);
            });
          }
        } catch (error) {
          // If can't read as text, mark as binary
          this.result.push(`[BINARY or ERROR: ${error.message}]`);
        }

        // Add file end marker
        this.result.push("--- END FILE ---");
        return;
      }

      // Skip other file types (symlinks, etc.)
      this.result.push(
        `--- FILE: ${relativePath} [ERROR: Unsupported file type] ---`
      );
      this.result.push("--- END FILE ---");
    } catch (error) {
      // Handle errors
      console.warn(`Warning: Error processing ${filePath}: ${error.message}`);
      this.result.push(
        `--- FILE: ${relativePath} [ERROR: ${error.message}] ---`
      );
      this.result.push("--- END FILE ---");
    }
  }

  // Check if content appears to be binary
  isBinaryContent(content) {
    // Check for null bytes (common in binary files)
    if (content.includes("\0")) return true;

    // Check for a high percentage of non-printable characters
    let nonPrintable = 0;
    const sampleSize = Math.min(content.length, 1000); // Check only first 1000 chars

    for (let i = 0; i < sampleSize; i++) {
      const code = content.charCodeAt(i);
      // Consider control characters (except common whitespace) as non-printable
      if ((code < 32 && ![9, 10, 13].includes(code)) || code === 127) {
        nonPrintable++;
      }
    }

    // If more than 10% are non-printable, consider it binary
    return nonPrintable > sampleSize * 0.1;
  }

  // Convert a folder to text
  convert(inputPath, outputPath) {
    console.log("\x1b[36mStarting conversion process...\x1b[0m");
    this.startTime = Date.now();
    try {
      // Resolve paths
      const resolvedInputPath = path.resolve(inputPath);

      // Check if input exists
      if (!fs.existsSync(resolvedInputPath)) {
        throw new Error(`Input path does not exist: ${resolvedInputPath}`);
      }

      // Check if the input path is actually a directory
      const stats = fs.statSync(resolvedInputPath);
      if (!stats.isDirectory()) {
        throw new Error(`Input path is not a directory: ${resolvedInputPath}`);
      }

      console.log(`Converting folder: ${resolvedInputPath}`);
      console.log(`Output file: ${outputPath}`);
      console.log(`Excluding directories: ${this.excludedFolders.join(", ")}`);

      // Check if output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        console.log(`\x1b[33mCreating output directory: ${outputDir}\x1b[0m`);
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Check if output file already exists
      if (fs.existsSync(outputPath)) {
        console.log(
          `\x1b[33mWarning: Output file already exists and will be overwritten: ${outputPath}\x1b[0m`
        );
      }

      // Add metadata
      this.addMetadata(resolvedInputPath);

      // Process the input path
      if (stats.isDirectory()) {
        // Get base directory name
        const baseName = path.basename(resolvedInputPath);

        // Process directory contents
        let items;
        try {
          items = fs.readdirSync(resolvedInputPath);
        } catch (error) {
          throw new Error(
            `Failed to read directory contents: ${error.message}`
          );
        }

        // Add root folder marker
        this.result.push(`--- FOLDER: ${baseName} ---`);
        this.folderCount++;

        // Process all items
        for (const item of items) {
          const itemPath = path.join(resolvedInputPath, item);
          const itemRelativePath = path.join(baseName, item);

          try {
            this.processFile(itemPath, itemRelativePath, outputPath);
          } catch (error) {
            console.error(
              `\x1b[31mError processing ${itemPath}: ${error.message}\x1b[0m`
            );
            // Continue with other files
          }

          // Periodically write results to avoid memory issues with very large folders
          if (this.result.length > 100000) {
            const tempOutput = this.result.join("\n");
            // If outputPath already exists, append to it
            try {
              if (fs.existsSync(outputPath)) {
                fs.appendFileSync(outputPath, tempOutput + "\n", "utf8");
              } else {
                fs.writeFileSync(outputPath, tempOutput + "\n", "utf8");
              }
              // Clear the result array to free memory
              this.result = [];
              console.log(
                `\x1b[32mIntermediate write: Processed ${this.fileCount} files, ${this.folderCount} folders so far\x1b[0m`
              );
            } catch (writeError) {
              console.error(
                `\x1b[31mError during intermediate write: ${writeError.message}\x1b[0m`
              );
              // Continue despite write error
            }
          }
        }
      } else {
        // Should never reach here due to earlier check
        throw new Error("Input is not a directory");
      }

      // Finish export
      this.finishExport();

      // Check if we have any results left to write
      if (this.result.length > 0) {
        const finalOutput = this.result.join("\n");
        try {
          // If outputPath already exists, append to it
          if (fs.existsSync(outputPath)) {
            fs.appendFileSync(outputPath, finalOutput, "utf8");
          } else {
            fs.writeFileSync(outputPath, finalOutput, "utf8");
          }
        } catch (writeError) {
          throw new Error(`Failed to write output file: ${writeError.message}`);
        }
      }

      const elapsedSeconds = (Date.now() - this.startTime) / 1000;
      console.log(`\n\x1b[32mConversion completed successfully!\x1b[0m`);
      console.log(`Total files processed: ${this.fileCount}`);
      console.log(`Total folders processed: ${this.folderCount}`);
      console.log(`Total directories excluded: ${this.excludedCount}`);
      console.log(
        `Total data size: ${(this.totalBytes / (1024 * 1024)).toFixed(2)} MB`
      );
      console.log(`Time taken: ${elapsedSeconds.toFixed(1)} seconds`);
      console.log(`Successfully exported folder structure to: ${outputPath}`);
    } catch (error) {
      console.error(`\x1b[31mError during conversion: ${error.message}\x1b[0m`);
      if (error.stack) {
        console.error("\nDetailed error information (for debugging):");
        console.error(error.stack);
      }
      // Re-throw the error so the main function can handle it
      throw error;
    }
  }
}

class TextToFolder {
  constructor() {
    this.currentFile = null;
    this.currentContent = [];
    this.inContent = false;
    this.fileCount = 0;
    this.folderCount = 0;
    this.startTime = Date.now();
    this.lineCount = 0;
    this.processedLines = 0;
    this.baseFolder = null;
  }

  // Log progress statistics
  logProgress() {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const percentComplete =
      this.lineCount > 0
        ? ((this.processedLines / this.lineCount) * 100).toFixed(1)
        : 0;

    console.log(`Progress: ${percentComplete}% complete`);
    console.log(
      `Files created: ${this.fileCount}, Folders created: ${this.folderCount}`
    );
    console.log(`Elapsed time: ${elapsedSeconds.toFixed(1)} seconds`);
  }

  // Create directory if it doesn't exist
  ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Write current file content to disk
  writeCurrentFile(basePath) {
    if (!this.currentFile) return;

    const fullPath = path.join(basePath, this.currentFile);
    const dirPath = path.dirname(fullPath);

    // Create directory structure
    this.ensureDirectory(dirPath);

    // Check for zero-byte binary files
    if (this.currentContent.length >= 1) {
      const firstLine = this.currentContent[0];

      if (firstLine.startsWith("[ZERO_BYTE_BINARY:")) {
        const ext = firstLine.substring(17, firstLine.length - 1);
        console.log(
          `Detected zero-byte binary file: ${this.currentFile} with extension ${ext}`
        );

        try {
          // For favicon.ico files, try to get one from the web
          if (ext === ".ico" && this.currentFile.includes("favicon.ico")) {
            console.log(`Attempting to download favicon for: ${fullPath}`);
            // We can't directly download in synchronous code, so create an empty file for now
            fs.writeFileSync(fullPath, Buffer.alloc(0));
            this.fileCount++;

            // Mark that we need to populate this file later
            this._faviconFilesToPopulate = this._faviconFilesToPopulate || [];
            this._faviconFilesToPopulate.push(fullPath);
          } else {
            // Create empty file for other binary formats
            fs.writeFileSync(fullPath, Buffer.alloc(0));
            console.log(`Created empty binary file: ${fullPath}`);
            this.fileCount++;
          }
        } catch (error) {
          console.error(`Failed to create binary file: ${error.message}`);
        }
        return;
      }
    }

    // Handle binary files that were marked specially during conversion
    if (this.currentContent.length >= 1) {
      const firstLine = this.currentContent[0];

      // Check if this is a binary file with original path
      if (firstLine.startsWith("[BINARY_FILE_PATH:")) {
        const originalPath = firstLine.substring(18, firstLine.length - 1);
        console.log(
          `Detected binary file: ${this.currentFile} (original: ${originalPath})`
        );

        // Check if original file exists
        if (fs.existsSync(originalPath)) {
          try {
            // Copy the binary file directly
            fs.copyFileSync(originalPath, fullPath);
            console.log(
              `Copied binary file from ${originalPath} to ${fullPath}`
            );
            this.fileCount++;
            return;
          } catch (error) {
            console.error(
              `Failed to copy binary file from ${originalPath}: ${error.message}`
            );
          }
        } else {
          console.warn(`Original binary file not found: ${originalPath}`);
          // If original not found, create an empty placeholder
          try {
            fs.writeFileSync(fullPath, Buffer.alloc(0));
            console.log(
              `Created empty placeholder for binary file: ${fullPath}`
            );
            this.fileCount++;
          } catch (error) {
            console.error(`Failed to create placeholder: ${error.message}`);
          }
          return;
        }
      }
    }

    // Skip binary, large, or error files that weren't specially marked
    if (
      this.currentContent.length === 1 &&
      (this.currentContent[0].includes("[BINARY") ||
        this.currentContent[0].includes("[ERROR:") ||
        this.currentContent[0].includes("[LARGE FILE:"))
    ) {
      console.log(`Skipping non-text file: ${this.currentFile}`);
      // Create an empty file as a placeholder
      try {
        fs.writeFileSync(fullPath, "", "utf8");
        console.log(`Created placeholder for: ${fullPath}`);
      } catch (error) {
        console.error(
          `Failed to create placeholder for: ${fullPath}`,
          error.message
        );
      }
      return;
    }

    // Write file content
    try {
      const content = this.currentContent.join("\n");
      fs.writeFileSync(fullPath, content, "utf8");
      this.fileCount++;

      // Log progress every 50 files
      if (this.fileCount % 50 === 0) {
        this.logProgress();
      }

      console.log(`Created file: ${fullPath}`);
    } catch (error) {
      console.error(`Error writing file ${fullPath}: ${error.message}`);
    }
  }

  // Create folder
  createFolder(basePath, folderPath) {
    const fullPath = path.join(basePath, folderPath);
    this.ensureDirectory(fullPath);
    this.folderCount++;

    // Log progress every 10 folders
    if (this.folderCount % 10 === 0) {
      this.logProgress();
    }

    console.log(`Created folder: ${fullPath}`);
  }

  // Parse the text document and reconstruct folder structure
  async reconstruct(inputPath, outputPath) {
    try {
      // Read input file
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file does not exist: ${inputPath}`);
      }

      this.startTime = Date.now();
      console.log(`\x1b[36mReading from: ${inputPath}\x1b[0m`);
      console.log(`Reconstructing to: ${outputPath}`);

      // Check if output path already exists
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        if (stats.isDirectory() && fs.readdirSync(outputPath).length > 0) {
          console.log(
            `\x1b[33mWarning: Output folder already exists and contains files: ${outputPath}\x1b[0m`
          );
          console.log("These files may be overwritten during reconstruction.");
        }
      }

      // Get file stats
      let stats;
      try {
        stats = fs.statSync(inputPath);
      } catch (error) {
        throw new Error(`Failed to get file information: ${error.message}`);
      }

      const fileSize = stats.size;
      if (fileSize === 0) {
        throw new Error("Input file is empty");
      }

      // Count total lines for progress reporting
      console.log("\x1b[36mCounting lines for progress tracking...\x1b[0m");
      try {
        this.lineCount = await this.countFileLines(inputPath);
        console.log(
          `Total lines to process: ${this.lineCount.toLocaleString()}`
        );
      } catch (error) {
        console.error(
          `\x1b[33mWarning: Failed to count lines: ${error.message}\x1b[0m`
        );
        console.log("Progress reporting will be limited.");
        this.lineCount = -1;
      }

      // If the file is too large to read into memory at once
      const MAX_MEMORY_SIZE = 100 * 1024 * 1024; // 100MB

      // Create output directory
      try {
        this.ensureDirectory(outputPath);
      } catch (error) {
        throw new Error(`Failed to create output directory: ${error.message}`);
      }

      if (fileSize > MAX_MEMORY_SIZE) {
        console.log(
          `\x1b[36mLarge file detected (${(fileSize / (1024 * 1024)).toFixed(
            2
          )} MB), processing in streaming mode\x1b[0m`
        );
        await this.reconstructStreaming(inputPath, outputPath);
      } else {
        // Process file in memory
        console.log(
          `\x1b[36mProcessing file in memory mode (${(fileSize / 1024).toFixed(
            2
          )} KB)\x1b[0m`
        );
        await this.reconstructInMemory(inputPath, outputPath);
      }

      const elapsedSeconds = (Date.now() - this.startTime) / 1000;
      console.log(`\n\x1b[32mReconstruction completed successfully!\x1b[0m`);
      console.log(`Total files created: ${this.fileCount}`);
      console.log(`Total folders created: ${this.folderCount}`);
      console.log(`Time taken: ${elapsedSeconds.toFixed(1)} seconds`);
      console.log(
        `Successfully reconstructed folder structure in: ${outputPath}`
      );
    } catch (error) {
      console.error(
        `\x1b[31mError during reconstruction: ${error.message}\x1b[0m`
      );
      if (error.stack) {
        console.error("\nDetailed error information (for debugging):");
        console.error(error.stack);
      }
      throw error;
    }
  }

  // Count lines in a file
  async countFileLines(filePath) {
    return new Promise((resolve, reject) => {
      let lineCount = 0;
      fs.createReadStream(filePath)
        .on("data", (buffer) => {
          let idx = -1;
          lineCount--; // Because the loop will run once for idx=-1
          do {
            idx = buffer.indexOf(10, idx + 1);
            lineCount++;
          } while (idx !== -1);
        })
        .on("end", () => {
          resolve(lineCount);
        })
        .on("error", reject);
    });
  }

  // Process a file in memory
  async reconstructInMemory(inputPath, outputPath) {
    const content = fs.readFileSync(inputPath, "utf8");
    const lines = content.split("\n");

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      this.processLine(lines[i], i, lines, outputPath);
      this.processedLines++;

      // Log progress every 5000 lines
      if (i > 0 && i % 5000 === 0) {
        this.logProgress();
      }
    }

    // Write any remaining file
    this.writeCurrentFile(outputPath);
  }

  // Process a file using streaming (for large files)
  async reconstructStreaming(inputPath, outputPath) {
    // Use import.meta.resolve to get the path to the readline module
    const readline = await import("readline");
    const stream = await import("fs");

    const fileStream = stream.createReadStream(inputPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lineNumber = 0;
    let lastProgressUpdate = 0;

    // Create a promise to wait for the stream to complete
    return new Promise((resolve, reject) => {
      rl.on("line", (line) => {
        try {
          this.processLine(line, lineNumber++, null, outputPath);
          this.processedLines++;

          // Log progress every 5000 lines or 5 seconds
          const now = Date.now();
          if (
            this.processedLines % 5000 === 0 ||
            (now - lastProgressUpdate > 5000 &&
              this.processedLines > lastProgressUpdate)
          ) {
            this.logProgress();
            lastProgressUpdate = this.processedLines;
          }
        } catch (error) {
          reject(error);
        }
      });

      rl.on("close", () => {
        // Write any remaining file
        this.writeCurrentFile(outputPath);
        console.log("Finished streaming file reconstruction");
        resolve();
      });

      rl.on("error", (error) => {
        reject(error);
      });
    });
  }

  // Process a single line
  processLine(line, lineNumber, lines, outputPath) {
    const trimmedLine = line.trim();

    // Skip metadata lines
    if (
      trimmedLine.startsWith("=== FOLDER STRUCTURE EXPORT ===") ||
      trimmedLine.startsWith("Source:") ||
      trimmedLine.startsWith("Generated:")
    ) {
      return;
    }

    // Start of content
    if (trimmedLine === "=== BEGIN CONTENT ===") {
      this.inContent = true;
      return;
    }

    // End of content
    if (trimmedLine === "=== END CONTENT ===") {
      // Write any remaining file
      this.writeCurrentFile(outputPath);
      return;
    }

    // Skip lines before content starts
    if (!this.inContent) {
      return;
    }

    // Handle folder markers
    if (trimmedLine.startsWith("--- FOLDER:") && trimmedLine.endsWith("---")) {
      // Write any previous file
      this.writeCurrentFile(outputPath);
      this.resetCurrentFile();

      // Extract folder path
      let folderPath = trimmedLine
        .replace("--- FOLDER:", "")
        .replace("---", "")
        .trim();

      // Determine base folder name (if this is the root folder marker)
      if (
        !this.baseFolder &&
        folderPath.indexOf("/") === -1 &&
        folderPath.indexOf("\\") === -1
      ) {
        // This is the root folder marker, store it as the base folder
        this.baseFolder = folderPath;
        // Don't create a folder for the base directory, it's already the output path
        console.log(
          `\x1b[36mDetected base folder: ${folderPath} (will be mapped to output root)\x1b[0m`
        );
        return;
      }

      // If we have a base folder, remove it from the path to avoid nesting
      if (this.baseFolder) {
        if (folderPath === this.baseFolder) {
          // Skip the base folder since it's already the output directory
          return;
        } else if (
          folderPath.startsWith(this.baseFolder + "/") ||
          folderPath.startsWith(this.baseFolder + "\\")
        ) {
          // Remove the base folder prefix from the path
          folderPath = folderPath.substring(this.baseFolder.length + 1);
        }
      }

      // Only create the folder if there's a path left after stripping the base folder
      if (folderPath) {
        this.createFolder(outputPath, folderPath);
      }
      return;
    }

    // Handle file start markers
    if (trimmedLine.startsWith("--- FILE:") && trimmedLine.endsWith("---")) {
      // Write any previous file
      this.writeCurrentFile(outputPath);
      this.resetCurrentFile();

      // Extract file path
      let filePath = trimmedLine
        .replace("--- FILE:", "")
        .replace("---", "")
        .trim();

      // Remove base folder prefix from file path to avoid nesting
      if (this.baseFolder) {
        if (
          filePath.startsWith(this.baseFolder + "/") ||
          filePath.startsWith(this.baseFolder + "\\")
        ) {
          filePath = filePath.substring(this.baseFolder.length + 1);
        }
      }

      this.currentFile = filePath;
      return;
    }

    // Handle file end markers
    if (trimmedLine === "--- END FILE ---") {
      this.writeCurrentFile(outputPath);
      this.resetCurrentFile();
      return;
    }

    // Collect file content
    if (this.currentFile) {
      // Use original line with whitespace
      this.currentContent.push(lines ? lines[lineNumber] : line);
    }
  }

  // Reset current file state
  resetCurrentFile() {
    this.currentFile = null;
    this.currentContent = [];
  }
}

// CLI usage
async function main() {
  try {
    const projectFolderPath = path.join(__dirname, "Project_Folder");
    const textConversionPath = path.join(__dirname, "Text_Conversion");

    // Check if Project_Folder exists
    if (!fs.existsSync(projectFolderPath)) {
      console.error(
        '\x1b[31mERROR: "Project_Folder" directory not found!\x1b[0m'
      );
      console.log(
        '\nPlease create a "Project_Folder" directory next to the script and place folders to convert inside it.'
      );
      console.log(
        "Example: mkdir -p Project_Folder && cp -r your-project Project_Folder/"
      );
      process.exit(1);
    }

    // Ensure Text_Conversion directory exists
    if (!fs.existsSync(textConversionPath)) {
      console.log(
        '\x1b[33mNotice: "Text_Conversion" directory not found. Creating it...\x1b[0m'
      );
      try {
        fs.mkdirSync(textConversionPath, { recursive: true });
        console.log(`Created directory: ${textConversionPath}`);
      } catch (error) {
        console.error(
          `\x1b[31mERROR: Failed to create "Text_Conversion" directory: ${error.message}\x1b[0m`
        );
        process.exit(1);
      }
    }

    // Check if we're handling a text-to-folder conversion
    const args = process.argv.slice(2);
    if (args.length >= 1 && args[0] === "--to-folder") {
      if (args.length !== 3) {
        console.error(
          "\x1b[31mERROR: Incorrect usage for folder reconstruction.\x1b[0m"
        );
        console.log(
          "\nTo convert a text file back to a folder structure, use:"
        );
        console.log(
          "  node folder-to-text.js --to-folder <input-file> <output-folder>"
        );
        console.log("\nExample:");
        console.log(
          "  node folder-to-text.js --to-folder ./Text_Conversion/my-project.txt ./restored-project"
        );
        process.exit(1);
      }

      const [_, inputPath, outputPath] = args;

      // Validate input file exists
      if (!fs.existsSync(inputPath)) {
        console.error(
          `\x1b[31mERROR: Input file not found: ${inputPath}\x1b[0m`
        );
        process.exit(1);
      }

      console.log(`\x1b[36mReconstructing folder from: ${inputPath}\x1b[0m`);
      const reconstructor = new TextToFolder();
      await reconstructor.reconstruct(inputPath, outputPath);
      console.log(
        `\x1b[32mSuccessfully reconstructed folder at: ${outputPath}\x1b[0m`
      );
      return;
    }

    // No arguments provided - run in automatic mode
    let processedFolderCount = 0;
    let errorFolderCount = 0;
    let processedTextCount = 0;
    let errorTextCount = 0;

    // First, convert text files in Text_Conversion back to folders in Project_Folder
    console.log(
      "\n\x1b[36m=== PHASE 1: Converting Text Files to Folders ===\x1b[0m"
    );

    let textItems;
    try {
      textItems = fs.readdirSync(textConversionPath);
    } catch (error) {
      console.error(
        `\x1b[31mERROR: Failed to read contents of "Text_Conversion": ${error.message}\x1b[0m`
      );
      textItems = [];
    }

    const textFiles = textItems.filter(
      (item) =>
        item.endsWith(".txt") &&
        fs.statSync(path.join(textConversionPath, item)).isFile()
    );

    if (textFiles.length === 0) {
      console.log(
        "\x1b[33mNo text files found for conversion to folders.\x1b[0m"
      );
    } else {
      for (const textFile of textFiles) {
        const inputPath = path.join(textConversionPath, textFile);
        const outputFolderName = textFile.replace(/\.txt$/, "");
        const outputPath = path.join(projectFolderPath, outputFolderName);

        console.log(`\n\x1b[36mProcessing text file: ${textFile}\x1b[0m`);
        console.log(`Will reconstruct to: ${outputPath}`);

        try {
          const reconstructor = new TextToFolder();
          await reconstructor.reconstruct(inputPath, outputPath);
          console.log(
            `\x1b[32mSuccessfully reconstructed folder at: ${outputPath}\x1b[0m`
          );
          processedTextCount++;
        } catch (error) {
          console.error(
            `\x1b[31mERROR: Failed to convert "${textFile}" to folder: ${error.message}\x1b[0m`
          );
          errorTextCount++;
        }
      }
    }

    // Then, convert folders in Project_Folder to text files
    console.log("\n\x1b[36m=== PHASE 2: Converting Folders to Text ===\x1b[0m");

    // Get all items in the Project_Folder
    let folderItems;
    try {
      folderItems = fs.readdirSync(projectFolderPath);
    } catch (error) {
      console.error(
        `\x1b[31mERROR: Failed to read contents of "Project_Folder": ${error.message}\x1b[0m`
      );
      process.exit(1);
    }

    if (folderItems.length === 0) {
      console.log('\x1b[33mNotice: "Project_Folder" is empty.\x1b[0m');
      console.log(
        '\nPlease add folders to convert to the "Project_Folder" directory.'
      );
      console.log("Example: cp -r your-project Project_Folder/");
    } else {
      // Process each folder in Project_Folder
      for (const item of folderItems) {
        const itemPath = path.join(projectFolderPath, item);

        // Skip if path doesn't exist (could have been deleted during processing)
        if (!fs.existsSync(itemPath)) continue;

        let stats;
        try {
          stats = fs.statSync(itemPath);
        } catch (error) {
          console.error(
            `\x1b[31mERROR: Cannot access "${item}": ${error.message}\x1b[0m`
          );
          errorFolderCount++;
          continue;
        }

        // Skip if not a directory
        if (!stats.isDirectory()) {
          console.log(`\x1b[33mSkipping non-directory item: ${item}\x1b[0m`);
          continue;
        }

        // Set output path to Text_Conversion/[folder-name].txt
        const outputPath = path.join(textConversionPath, `${item}.txt`);

        console.log(`\n\x1b[36mProcessing folder: ${item}\x1b[0m`);
        console.log(`Output will be saved to: ${outputPath}`);

        // Convert the folder to text
        try {
          const converter = new FolderToText();
          converter.convert(itemPath, outputPath);
          processedFolderCount++;
        } catch (error) {
          console.error(
            `\x1b[31mERROR: Failed to convert "${item}": ${error.message}\x1b[0m`
          );
          errorFolderCount++;
        }
      }
    }

    console.log("\n\x1b[36m========== Conversion Summary ==========\x1b[0m");

    // Text to Folder Summary
    console.log("\n\x1b[36m--- Text to Folder Conversion ---\x1b[0m");
    if (processedTextCount === 0 && errorTextCount === 0) {
      console.log(
        "\x1b[33mNo text files processed for folder conversion.\x1b[0m"
      );
    } else {
      if (processedTextCount > 0) {
        console.log(
          `\x1b[32mSuccessfully converted ${processedTextCount} text file(s) to folders\x1b[0m`
        );
        console.log(`Results saved to Project_Folder directory.`);
      }
      if (errorTextCount > 0) {
        console.log(
          `\x1b[31mFailed to convert: ${errorTextCount} text file(s)\x1b[0m`
        );
      }
    }

    // Folder to Text Summary
    console.log("\n\x1b[36m--- Folder to Text Conversion ---\x1b[0m");
    if (processedFolderCount === 0 && errorFolderCount === 0) {
      console.log("\x1b[33mNo folders processed for text conversion.\x1b[0m");
    } else {
      if (processedFolderCount > 0) {
        console.log(
          `\x1b[32mSuccessfully converted ${processedFolderCount} folder(s) to text\x1b[0m`
        );
        console.log(`Results saved to Text_Conversion directory.`);
      }
      if (errorFolderCount > 0) {
        console.log(
          `\x1b[31mFailed to convert: ${errorFolderCount} folder(s)\x1b[0m`
        );
      }
    }
  } catch (error) {
    console.error("\x1b[31mERROR: Unexpected error occurred:\x1b[0m");
    console.error(`- ${error.message}`);
    if (error.stack) {
      console.error("\nDetailed error information (for debugging):");
      console.error(error.stack);
    }
    console.error(
      "\nIf this issue persists, please report it with the error details above."
    );
    process.exit(1);
  }
}

// Check if this script is being run directly
const scriptPath = fileURLToPath(import.meta.url);
const runningScript = process.argv[1];

if (scriptPath === runningScript) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}

export { FolderToText, TextToFolder };
