
export interface LetterboxdMovie {
  name: string;
  year: number;
  dateWatched: string;
}

export const parseLetterboxdCSV = (csvText: string): LetterboxdMovie[] => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  
  // More flexible header matching (handles 'Date', 'Watched Date', 'Name', 'Title', etc.)
  const findIdx = (terms: string[]) => headers.findIndex(h => 
    terms.some(t => h.toLowerCase().includes(t))
  );

  const nameIdx = findIdx(['name', 'title']);
  const yearIdx = findIdx(['year', 'release']);
  const dateIdx = findIdx(['watched date', 'date']);

  if (nameIdx === -1 || dateIdx === -1) return [];

  const results: LetterboxdMovie[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = parseLine(lines[i]);
    if (parts.length <= Math.max(nameIdx, dateIdx)) continue;

    const name = parts[nameIdx].replace(/^"|"$/g, '').trim();
    // Use 0 if year column is missing or unparseable
    const year = yearIdx !== -1 ? parseInt(parts[yearIdx]) || 0 : 0;
    const dateWatched = parts[dateIdx].trim();

    if (name && dateWatched) {
      results.push({ name, year, dateWatched });
    }
  }

  return results;
};
