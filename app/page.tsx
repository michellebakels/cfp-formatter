"use client";

import { useState, useCallback, useRef } from "react";

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fieldTitles, setFieldTitles] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [csvData, setCsvData] = useState<string[][]>([]);
  const currentFileRef = useRef<File | null>(null);

  const parseCSV = useCallback((file: File) => {
    // Track the current file being processed
    currentFileRef.current = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      // Only update state if this file is still the current file
      if (currentFileRef.current === file) {
        const text = e.target?.result as string;
        const parsedData = parseCSVData(text);
        setFieldTitles(parsedData.headers);
        setSelectedFields(new Set(parsedData.headers));
        setCsvData(parsedData.dataRows);
      }
    };
    reader.readAsText(file);
  }, []);

  const parseCSVData = (text: string) => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
        } else {
          // Toggle quotes
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === "," && !inQuotes) {
        // End of field
        currentRow.push(currentField.trim());
        currentField = "";
        i++;
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        // End of row
        currentRow.push(currentField.trim());
        if (currentRow.some((field) => field !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
        // Skip \r\n
        if (char === "\r" && nextChar === "\n") {
          i += 2;
        } else {
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    }

    // Add the last field and row if there's remaining content
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((field) => field !== "")) {
        rows.push(currentRow);
      }
    }

    const headers = rows[0] || [];
    const dataRows = rows
      .slice(1)
      .filter(
        (row) => row.length > 0 && row.some((cell) => cell.trim() !== "")
      );

    return { headers, dataRows };
  };

  const escapeHtml = (text: string): string => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const generatePrintSet = () => {
    const selectedFieldIndices = fieldTitles
      .map((title, index) => (selectedFields.has(title) ? index : -1))
      .filter((index) => index !== -1);

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Set</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .application { 
            page-break-after: always; 
            margin-bottom: 40px;
            border: 1px solid #ccc;
            padding: 20px;
            min-height: calc(100vh - 80px);
          }
          .application:last-child { page-break-after: auto; }
          .field { margin-bottom: 15px; }
          .field-label { 
            font-weight: bold; 
            color: #333;
            margin-bottom: 5px;
          }
          .field-value { 
            color: #666;
            line-height: 1.4;
          }
          h1 { color: #333; margin-bottom: 20px; }
          @media print {
            body { margin: 0; }
            .application { 
              border: none;
              padding: 15px;
            }
          }
        </style>
      </head>
      <body>
    `;

    csvData.forEach((row, rowIndex) => {
      // Find name and company fields (case-insensitive)
      const nameField = fieldTitles.findIndex(
        (title) =>
          title.toLowerCase().includes("name") ||
          title.toLowerCase().includes("applicant")
      );
      const companyField = fieldTitles.findIndex(
        (title) =>
          title.toLowerCase().includes("company") ||
          title.toLowerCase().includes("organization")
      );

      // Safely get values, checking if index exists in row array
      const name =
        nameField !== -1 && nameField < row.length && row[nameField]
          ? row[nameField]
          : `Application ${rowIndex + 1}`;
      const company =
        companyField !== -1 && companyField < row.length && row[companyField]
          ? row[companyField]
          : "";

      const title = company ? `${name} - ${company}` : name;

      html += `<div class="application">`;
      html += `<h1>${escapeHtml(title)}</h1>`;

      selectedFieldIndices.forEach((fieldIndex) => {
        const fieldName = fieldTitles[fieldIndex];
        const fieldValue =
          fieldIndex < row.length && row[fieldIndex] ? row[fieldIndex] : "";
        html += `
          <div class="field">
            <div class="field-label">${escapeHtml(fieldName)}:</div>
            <div class="field-value">${escapeHtml(fieldValue)}</div>
          </div>
        `;
      });

      html += `</div>`;
    });

    html += `
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Set isDragging to false if:
    // 1. relatedTarget is null (dragged outside browser window)
    // 2. relatedTarget exists but is not within the drop zone container
    if (
      !e.relatedTarget ||
      (e.relatedTarget instanceof Node &&
        !e.currentTarget.contains(e.relatedTarget))
    ) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && droppedFile.type === "text/csv") {
        setFile(droppedFile);
        parseCSV(droppedFile);
      }
    },
    [parseCSV]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile && selectedFile.type === "text/csv") {
        setFile(selectedFile);
        parseCSV(selectedFile);
      }
    },
    [parseCSV]
  );

  const toggleField = useCallback((field: string) => {
    setSelectedFields((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(field)) {
        newSet.delete(field);
      } else {
        newSet.add(field);
      }
      return newSet;
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black p-8">
      <div className="w-full max-w-2xl">
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-zinc-500 dark:text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>

            <div>
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {file ? file.name : "Drop your CSV file here"}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                or click to browse
              </p>
            </div>

            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
            >
              Choose File
            </label>
          </div>
        </div>

        {file && fieldTitles.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4 text-black dark:text-zinc-100">
              Select fields to include:
            </h2>
            <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {fieldTitles.map((field) => (
                  <label
                    key={field}
                    className="flex items-center gap-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.has(field)}
                      onChange={() => toggleField(field)}
                      className="w-4 h-4 text-blue-600 bg-zinc-100 border-zinc-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-zinc-800 focus:ring-2 dark:bg-zinc-700 dark:border-zinc-600"
                    />
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {field}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              {selectedFields.size} of {fieldTitles.length} fields selected
            </div>

            {selectedFields.size > 0 && csvData.length > 0 && (
              <button
                onClick={generatePrintSet}
                className="mt-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Generate Formatted Set ({csvData.length} applications)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
