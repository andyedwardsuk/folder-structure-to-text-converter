# 📁 Folder-Structure-to-Text Converter

A powerful Node.js utility to convert folder structures to text files and vice versa! 🔄 This tool helps you:

- 📦 Archive folder structures in a human-readable text format
- 🔄 Restore folder structures from these text files
- 🚀 Transfer project structures between systems or environments

## 🛠️ Setup

1. ✅ Ensure you have Node.js installed (v14.0.0 or higher recommended)
2. 📥 Clone or download this repository
3. 📂 Create two directories next to the script:
   - `Project_Folder`: Place folders to convert here
   - `Text_Conversion`: This is where text files will be stored

## 🚀 Usage

### 🤖 Automatic Mode (Recommended)

Simply run the script without any arguments:

```bash
node convert.js
```

This will:

1. **🔄 First**: Convert any text files found in the `Text_Conversion` directory back to folders in the `Project_Folder` directory
2. **📝 Then**: Convert any folders in the `Project_Folder` directory to text files in the `Text_Conversion` directory

### ⚙️ Manual Mode (For Custom Paths)

#### Converting a Text File Back to a Folder Structure

```bash
node convert.js --to-folder ./Text_Conversion/my-project.txt ./restored-project
```

## ⚡ How It Works

### 📁➡️📄 Folder-to-Text Conversion

1. 🔍 The script traverses the folder structure recursively
2. 🏷️ For each folder and file, it adds appropriate markers to the output text file
3. 🔧 Binary files are detected and appropriately marked
4. 💾 Large files are handled using streaming to prevent memory issues

### 📄➡️📁 Text-to-Folder Reconstruction

1. 🔍 The script parses the text file to extract folder and file information
2. 🏗️ It recreates the folder structure and files with their contents
3. ⚡ Large files are processed efficiently using streaming

## 💡 Tips

- 🚫 The script automatically excludes `node_modules` directories to avoid processing large dependency trees
- 📊 Files over 10MB are processed using streaming to prevent memory issues
- 🔧 Binary files are properly handled during both conversion and reconstruction

## 📋 Example Structure

Your directory structure should look like:

```
Folder-to-Text-Converter/
├── convert.js
├── Project_Folder/
│   └── [your folders to convert] 📂
└── Text_Conversion/
    └── [converted text files] 📄
```

## 📝 Notes

- ✅ Ensure you have proper permissions to read/write in the directories
- ⏱️ For large projects, the conversion process may take some time

## ✨ Features

- 🎯 Simple drag-and-drop workflow - just put folders in "Project_Folder" and run the script
- 🔄 Converts all folders in the Project_Folder automatically
- 🏗️ Preserves all file contents and folder hierarchy
- 🔧 Handles binary files appropriately (marked but not converted)
- 📊 Detailed progress reporting
- 🚫 Automatically excludes `node_modules` directories

## 📋 Requirements

- 🟢 Node.js 14+

## 📦 Installation

1. 📥 Clone this repository or download the script
2. ⚙️ Make sure the script is executable: `chmod +x convert.js`
3. 📂 Ensure "Project_Folder" and "Text_Conversion" directories exist next to the script

## 📄 Output Format

The text file has a simple, structured format:

```
=== FOLDER STRUCTURE EXPORT ===
Source: /path/to/original/folder
Generated: 2023-06-05T19:38:17.090Z
Excluded directories: node_modules

=== BEGIN CONTENT ===
--- FOLDER: folder-name ---
--- FILE: folder-name/file.txt ---
Content of file.txt
goes here with
all lines preserved
--- END FILE ---
--- FOLDER: folder-name/subfolder ---
--- FILE: folder-name/subfolder/another-file.js ---
console.log('Hello World');
--- END FILE ---
=== END CONTENT ===
```

## 📊 Progress Reporting

The script shows detailed progress information during conversion:

- 📈 Number of files and folders processed
- 💾 Total data size
- ⏱️ Time taken
- 🚫 Number of directories excluded

For large folder structures, the script will show periodic updates and handle memory efficiently.

## 🚫 Exclusions

By default, the script excludes the following directories from conversion:

- `node_modules` (to avoid processing potentially large dependency trees)

## ⚠️ Limitations

- 🔧 Binary files are detected but not converted (marked as `[BINARY]`)
- 📊 Large files (>10MB) are skipped and marked as `[LARGE FILE]`)
- 🔒 Permissions and file metadata are not preserved

## 📜 License

MIT

---

_Made with ❤️ for developers who need to archive and transfer project structures efficiently!_ 🚀
