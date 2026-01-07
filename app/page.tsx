"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fieldTitles, setFieldTitles] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [filterNumbers, setFilterNumbers] = useState<string>("");
  const [isFileUploaded, setIsFileUploaded] = useState(false);
  const currentFileRef = useRef<File | null>(null);

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
        setIsFileUploaded(true);
      }
    };
    reader.readAsText(file);
  }, []);

  const escapeHtml = (text: string): string => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const getFilteredCount = (): number => {
    if (!filterNumbers.trim()) {
      return csvData.length;
    }

    const filterSet = new Set<number>();
    const numbers = filterNumbers
      .split(/[,\n\r]+/)
      .map((n) => parseInt(n.trim()))
      .filter((n) => !isNaN(n) && n > 0 && n <= csvData.length);

    numbers.forEach((n) => filterSet.add(n));
    return filterSet.size;
  };

  const generatePrintSet = () => {
    const selectedFieldIndices = fieldTitles
      .map((title, index) => (selectedFields.has(title) ? index : -1))
      .filter((index) => index !== -1);

    // Parse filter numbers with consistent validation
    const filterSet = new Set<number>();
    if (filterNumbers.trim()) {
      const numbers = filterNumbers
        .split(/[,\n\r]+/)
        .map((n) => parseInt(n.trim()))
        .filter((n) => !isNaN(n) && n > 0 && n <= csvData.length);
      numbers.forEach((n) => filterSet.add(n));
    }

    // Filter data based on numbers, preserving original indices
    // Create array of [originalIndex, row] tuples to track original positions
    let filteredDataWithIndices: Array<[number, string[]]> = [];
    if (filterSet.size > 0) {
      filteredDataWithIndices = csvData
        .map((row, index) => [index + 1, row] as [number, string[]])
        .filter(([originalIndex]) => filterSet.has(originalIndex));
    } else {
      filteredDataWithIndices = csvData.map(
        (row, index) => [index + 1, row] as [number, string[]]
      );
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>PRINT SET</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
          
          body { 
            font-family: 'JetBrains Mono', monospace; 
            margin: 20px; 
            background: #0f172a;
            color: #22d3ee;
          }
          .application { 
            page-break-after: always; 
            margin-bottom: 40px;
            border: 4px solid #475569;
            padding: 30px;
            min-height: calc(100vh - 80px);
            background: #1e293b;
          }
          .application:last-child { page-break-after: auto; }
          .field { margin-bottom: 20px; }
          .field-label { 
            font-weight: bold; 
            color: #4ade80;
            margin-bottom: 8px;
            font-size: 14px;
            letter-spacing: 0.1em;
          }
          .field-value { 
            color: #22d3ee;
            line-height: 1.6;
            font-size: 13px;
            white-space: pre-wrap;
          }
          h1 { 
            color: #4ade80; 
            margin-bottom: 30px;
            font-size: 20px;
            letter-spacing: 0.15em;
            text-align: center;
            border-bottom: 2px solid #475569;
            padding-bottom: 15px;
          }
          @media print {
            body { 
              margin: 0; 
              background: white;
              color: black;
            }
            .application { 
              border: 2px solid #333;
              padding: 20px;
              background: white;
            }
            .field-label { color: #333; }
            .field-value { color: #666; }
            h1 { color: #333; }
          }
        </style>
      </head>
      <body>
    `;

    filteredDataWithIndices.forEach(([rowIndex, row]) => {
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
      const nameValue = nameField !== -1 && nameField < row.length && row[nameField] 
        ? row[nameField].trim() 
        : '';
      const companyValue = companyField !== -1 && companyField < row.length && row[companyField]
        ? row[companyField].trim()
        : '';

      // Build title based on available information
      let title = '';
      if (nameValue && companyValue) {
        title = `${nameValue} - ${companyValue}`;
      } else if (nameValue) {
        title = nameValue;
      } else {
        title = `Application ${rowIndex}`;
      }

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Press 'a' or 'A' to trigger file upload (case-insensitive)
      if (
        e.key.toLowerCase() === "a" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        // Make sure we're not typing in an input
        const activeElement = document.activeElement;
        if (
          activeElement?.tagName !== "INPUT" &&
          activeElement?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          document.getElementById("file-upload")?.click();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 font-mono p-4">
      <div className="w-full max-w-7xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-cyan-400 mb-2 tracking-wider">
            FORM FORMATTER
          </h1>
          <div className="text-xs text-green-400 tracking-widest">
            &gt; CSV PROCESSING UTILITY
          </div>
        </div>

        {/* Initial State - Centered Uploader */}
        {!isFileUploaded && (
          <div className="flex justify-center">
            <div
              className={`border-4 bg-slate-800 p-12 text-center transition-all max-w-md w-full ${
                isDragging
                  ? "border-cyan-400 shadow-cyan-400/50 shadow-lg scale-105"
                  : "border-slate-600"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-6">
                <div className="w-24 h-24 border-4 border-cyan-400 flex items-center justify-center bg-slate-900">
                  <div className="text-cyan-400 text-4xl font-bold">
                    {file ? "✓" : "⬇"}
                  </div>
                </div>

                <div>
                  <p className="text-green-400 font-bold text-sm tracking-wider mb-2">
                    {file
                      ? `FILE: ${
                          file.name.length > 30
                            ? file.name.substring(0, 30) + "..."
                            : file.name
                        }`
                      : "DROP CSV FILE"}
                  </p>
                  <p className="text-cyan-400 text-sm tracking-widest">
                    OR PRESS A TO BROWSE
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
                  className="px-6 py-3 bg-green-400 text-slate-900 font-bold text-sm border-2 border-green-400 cursor-pointer hover:bg-green-300 transition-colors tracking-wider"
                >
                  [ BROWSE ]
                </label>
              </div>
            </div>
          </div>
        )}

        {/* File Uploaded State - Grid Layout */}
        {isFileUploaded && (
          <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - File Upload & Status */}
              <div className="lg:col-span-1">
                <div className="mb-3 text-center">
                  <h2 className="text-green-400 font-bold text-xs tracking-widest">
                    DROP CSV FILE:
                  </h2>
                </div>
                <div
                  className={`border-4 bg-slate-800 p-4 text-center transition-all mb-4 ${
                    isDragging
                      ? "border-cyan-400 shadow-cyan-400/50 shadow-lg"
                      : "border-slate-600"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-4 border-cyan-400 flex items-center justify-center bg-slate-900">
                      <div className="text-cyan-400 text-xl font-bold">
                        {file ? "✓" : "⬇"}
                      </div>
                    </div>

                    <div>
                      <p className="text-green-400 font-bold text-xs tracking-wider mb-1">
                        {file
                          ? `FILE: ${
                              file.name.length > 15
                                ? file.name.substring(0, 15) + "..."
                                : file.name
                            }`
                          : "DROP CSV FILE"}
                      </p>
                      <p className="text-cyan-400 text-xs tracking-widest">
                        OR PRESS A TO BROWSE
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
                      className="px-3 py-2 bg-green-400 text-slate-900 font-bold text-xs border-2 border-green-400 cursor-pointer hover:bg-green-300 transition-colors tracking-wider"
                    >
                      [ BROWSE ]
                    </label>
                  </div>
                </div>

                {/* System Status */}
                {file && fieldTitles.length > 0 && (
                  <div className="bg-slate-800 border-4 border-slate-600 p-4">
                    <div className="text-center">
                      <h3 className="text-green-400 font-bold text-xs tracking-widest mb-2">
                        RECORDS STATUS
                      </h3>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-cyan-400">TOTAL:</span>
                          <span className="text-green-400">
                            {csvData.length}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-cyan-400">FILTERED:</span>
                          <span className="text-green-400">
                            {getFilteredCount()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Middle Column - Field Selection */}
              <div className="lg:col-span-1">
                {file && fieldTitles.length > 0 && (
                  <div className="flex flex-col h-full">
                    <div className="mb-3 text-center">
                      <h2 className="text-green-400 font-bold text-xs tracking-widest">
                        SELECT FIELDS:
                      </h2>
                    </div>
                    <div
                      className="bg-slate-800 border-4 border-slate-600 p-4 flex-1 overflow-hidden flex flex-col"
                      style={{ maxHeight: "400px" }}
                    >
                      <div className="overflow-y-auto flex-1 space-y-1">
                        {fieldTitles.map((field) => (
                          <label
                            key={field}
                            className="flex items-center gap-2 cursor-pointer hover:bg-slate-700 p-2 border-2 border-transparent hover:border-cyan-400 transition-all text-xs"
                          >
                            <div className="relative flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={selectedFields.has(field)}
                                onChange={() => toggleField(field)}
                                className="w-4 h-4 opacity-0 absolute"
                              />
                              <div
                                className={`w-4 h-4 border-2 flex items-center justify-center transition-all ${
                                  selectedFields.has(field)
                                    ? "bg-green-400 border-green-400"
                                    : "bg-slate-700 border-slate-500"
                                }`}
                              >
                                {selectedFields.has(field) && (
                                  <span className="text-slate-900 text-xs font-bold">
                                    ✓
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-cyan-400 tracking-wide truncate">
                              {field}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t-2 border-slate-600 text-center">
                        <div className="text-green-400 text-xs tracking-widest">
                          [{selectedFields.size}/{fieldTitles.length}] SELECTED
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Filter & Generate */}
              <div className="lg:col-span-1">
                {file && fieldTitles.length > 0 && (
                  <div className="flex flex-col h-full">
                    <h3 className="text-green-400 font-bold text-xs tracking-widest mb-3 text-center">
                      FILTER & GENERATE:
                    </h3>

                    {/* Filter */}
                    <div
                      className="bg-slate-800 border-4 border-slate-600 p-4 flex-1"
                      style={{ maxHeight: "300px" }}
                    >
                      <div className="flex flex-col h-full">
                        <h4 className="text-green-400 font-bold text-xs tracking-widest mb-2">
                          FILTER APPS:
                        </h4>
                        <textarea
                          value={filterNumbers}
                          onChange={(e) => setFilterNumbers(e.target.value)}
                          placeholder="ENTER NUMBERS&#10;2,3,4,5,6"
                          className="w-full h-48 px-3 py-2 bg-slate-700 border-2 border-slate-600 text-cyan-400 placeholder-slate-500 focus:border-cyan-400 focus:outline-none transition-colors text-xs tracking-wide resize-none"
                        />
                        <div className="mt-2 text-center">
                          <div className="text-xs text-cyan-400 tracking-widest opacity-75">
                            LEAVE EMPTY FOR ALL
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Generate Button */}
                    {selectedFields.size > 0 && csvData.length > 0 && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={generatePrintSet}
                          className="w-full px-4 py-3 bg-green-400 text-slate-900 font-bold text-xs border-4 border-green-400 hover:bg-green-300 transition-all tracking-widest"
                        >
                          [ GENERATE PRINT SET ]
                          <div className="text-xs mt-1 opacity-75">
                            ({getFilteredCount()} APPS)
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
