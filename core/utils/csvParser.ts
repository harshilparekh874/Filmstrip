
export interface LetterboxdMovie {
  name: string;
  year: number;
  dateWatched: string;
}

export const parseLetterboxdCSV = (csvText: string): LetterboxdMovie[] => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  /**
   * Manual state-machine CSV parser to handle fields with commas inside quotes.
   */
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
  const nameIdx = headers.findIndex(h => h.toLowerCase() === 'name');
  const yearIdx = headers.findIndex(h => h.toLowerCase() === 'year');
  const dateIdx = headers.findIndex(h => h.toLowerCase() === 'date');

  // Name, Year, and Date are now all used for high-accuracy migration
  if (nameIdx === -1 || dateIdx === -1 || yearIdx === -1) return [];

  const results: LetterboxdMovie[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = parseLine(lines[i]);
    if (parts.length <= Math.max(nameIdx, dateIdx, yearIdx)) continue;

    const rawName = parts[nameIdx];
    const name = rawName.replace(/^"|"$/g, '').trim();
    const year = parseInt(parts[yearIdx]) || 0;
    const dateWatched = parts[dateIdx].trim();

    if (name && dateWatched) {
      results.push({ name, year, dateWatched });
    }
  }

  return results;
};
