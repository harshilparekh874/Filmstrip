
export interface LetterboxdMovie {
  name: string;
  year: number;
  dateWatched: string;
}

export const parseLetterboxdCSV = (csvText: string): LetterboxdMovie[] => {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Find header indices (Letterboxd format: Date,Name,Year,Letterboxd URI)
  const headers = lines[0].split(',');
  const nameIdx = headers.indexOf('Name');
  const yearIdx = headers.indexOf('Year');
  const dateIdx = headers.indexOf('Date');

  if (nameIdx === -1 || yearIdx === -1) return [];

  const results: LetterboxdMovie[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle potential commas inside quotes for movie titles
    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!parts || parts.length < Math.max(nameIdx, yearIdx)) continue;

    const name = parts[nameIdx].replace(/^"|"$/g, '');
    const year = parseInt(parts[yearIdx]);
    const dateWatched = dateIdx !== -1 ? parts[dateIdx] : new Date().toISOString().split('T')[0];

    if (name && !isNaN(year)) {
      results.push({ name, year, dateWatched });
    }
  }

  return results;
};
