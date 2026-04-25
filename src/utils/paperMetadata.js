import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set up PDF.js worker using bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Extract metadata from a PDF file
 */
export async function extractPdfMetadata(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const metadata = await pdf.getMetadata();

    // Get first page text to find DOI or title
    const firstPage = await pdf.getPage(1);
    const textContent = await firstPage.getTextContent();
    const firstPageText = textContent.items.map(item => item.str).join(' ');

    // Extract DOI from text (common patterns)
    const doi = extractDoi(firstPageText) || extractDoi(metadata?.info?.Subject || '');

    // Get basic metadata from PDF properties
    const pdfMeta = {
      title: cleanTitle(metadata?.info?.Title) || extractTitleFromText(firstPageText),
      authors: parseAuthors(metadata?.info?.Author),
      year: extractYear(metadata?.info?.CreationDate) || extractYearFromText(firstPageText),
      doi: doi,
    };

    // If we found a DOI, fetch complete metadata from CrossRef
    if (doi) {
      const crossRefData = await fetchCrossRefMetadata(doi);
      if (crossRefData) {
        return {
          ...pdfMeta,
          ...crossRefData,
          doi: doi,
        };
      }
    }

    // If no DOI, try searching by title
    if (pdfMeta.title && pdfMeta.title.length > 10) {
      const searchData = await searchByTitle(pdfMeta.title);
      if (searchData) {
        return {
          ...pdfMeta,
          ...searchData,
        };
      }
    }

    return pdfMeta;
  } catch (error) {
    console.error('Error extracting PDF metadata:', error);
    return null;
  }
}

/**
 * Extract metadata from an EPUB file
 */
export async function extractEpubMetadata(file) {
  try {
    const JSZip = (await import('jszip')).default;
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Find the OPF file (contains metadata)
    let opfPath = null;

    // First check container.xml for OPF location
    const containerFile = zip.file('META-INF/container.xml');
    if (containerFile) {
      const containerXml = await containerFile.async('string');
      const rootfileMatch = containerXml.match(/full-path="([^"]+\.opf)"/);
      if (rootfileMatch) {
        opfPath = rootfileMatch[1];
      }
    }

    // Fallback: search for .opf file
    if (!opfPath) {
      for (const [path] of Object.entries(zip.files)) {
        if (path.endsWith('.opf')) {
          opfPath = path;
          break;
        }
      }
    }

    if (!opfPath) {
      return null;
    }

    const opfFile = zip.file(opfPath);
    if (!opfFile) {
      return null;
    }

    const opfContent = await opfFile.async('string');

    // Parse metadata from OPF XML
    const title = extractXmlTag(opfContent, 'dc:title') || extractXmlTag(opfContent, 'title');
    const author = extractXmlTag(opfContent, 'dc:creator') || extractXmlTag(opfContent, 'creator');
    const date = extractXmlTag(opfContent, 'dc:date') || extractXmlTag(opfContent, 'date');
    const identifier = extractXmlTag(opfContent, 'dc:identifier') || '';

    // Check if identifier is a DOI
    const doi = extractDoi(identifier);

    const epubMeta = {
      title: cleanTitle(title),
      authors: author || '',
      year: extractYear(date),
      doi: doi,
    };

    // If we found a DOI, fetch complete metadata
    if (doi) {
      const crossRefData = await fetchCrossRefMetadata(doi);
      if (crossRefData) {
        return { ...epubMeta, ...crossRefData, doi };
      }
    }

    return epubMeta;
  } catch (error) {
    console.error('Error extracting EPUB metadata:', error);
    return null;
  }
}

/**
 * Fetch metadata from CrossRef API using DOI
 */
export async function fetchCrossRefMetadata(doi) {
  try {
    const cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const work = data.message;

    return {
      title: work.title?.[0] || '',
      authors: formatCrossRefAuthors(work.author),
      year: work.published?.['date-parts']?.[0]?.[0] ||
            work['published-print']?.['date-parts']?.[0]?.[0] ||
            work['published-online']?.['date-parts']?.[0]?.[0],
      doi: cleanDoi,
      url: work.URL || `https://doi.org/${cleanDoi}`,
      journal: work['container-title']?.[0] || '',
      publisher: work.publisher || '',
      volume: work.volume || '',
      issue: work.issue || '',
      pages: work.page || '',
    };
  } catch (error) {
    console.error('Error fetching CrossRef metadata:', error);
    return null;
  }
}

/**
 * Search for paper by title using OpenAlex API (free, no auth)
 */
export async function searchByTitle(title) {
  try {
    const response = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(title)}&per_page=1`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const work = data.results?.[0];

    if (!work) {
      return null;
    }

    // Check if title is a reasonable match (avoid false positives)
    const similarity = calculateSimilarity(title.toLowerCase(), work.title?.toLowerCase() || '');
    if (similarity < 0.6) {
      return null;
    }

    return {
      title: work.title || '',
      authors: work.authorships?.map(a => a.author?.display_name).filter(Boolean).join(', ') || '',
      year: work.publication_year,
      doi: work.doi?.replace('https://doi.org/', '') || '',
      url: work.doi || work.id || '',
    };
  } catch (error) {
    console.error('Error searching OpenAlex:', error);
    return null;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractDoi(text) {
  if (!text) return null;
  // Match DOI patterns
  const doiPatterns = [
    /10\.\d{4,}\/[^\s]+/i,
    /doi[:\s]+([^\s]+)/i,
    /https?:\/\/(?:dx\.)?doi\.org\/([^\s]+)/i,
  ];

  for (const pattern of doiPatterns) {
    const match = text.match(pattern);
    if (match) {
      // Clean up the DOI
      let doi = match[1] || match[0];
      doi = doi.replace(/[.,;)\]}>]+$/, ''); // Remove trailing punctuation
      if (doi.startsWith('10.')) {
        return doi;
      }
    }
  }
  return null;
}

function extractYear(dateStr) {
  if (!dateStr) return null;
  // Match 4-digit year
  const match = dateStr.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

function extractYearFromText(text) {
  if (!text) return null;
  // Look for year in common patterns like "Published 2023" or "(2023)"
  const patterns = [
    /\((\d{4})\)/,
    /published[:\s]+(\d{4})/i,
    /©\s*(\d{4})/,
    /\b(20[0-2]\d)\b/, // 2000-2029
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }
  return null;
}

function cleanTitle(title) {
  if (!title) return '';
  // Remove common prefixes and clean up
  return title
    .replace(/^(Microsoft Word - |untitled|Document)/i, '')
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitleFromText(text) {
  if (!text) return '';
  // Get first substantial line (likely the title)
  const lines = text.split(/\n/).filter(l => l.trim().length > 10);
  if (lines.length > 0) {
    // Take first line, but cap length
    return lines[0].substring(0, 200).trim();
  }
  return '';
}

function parseAuthors(authorStr) {
  if (!authorStr) return '';
  // Clean up common separators
  return authorStr
    .replace(/;/g, ',')
    .replace(/\s+and\s+/gi, ', ')
    .replace(/\s+&\s+/g, ', ')
    .trim();
}

function formatCrossRefAuthors(authors) {
  if (!authors || !Array.isArray(authors)) return '';
  return authors
    .map(a => {
      if (a.family && a.given) {
        return `${a.given} ${a.family}`;
      }
      return a.name || a.family || '';
    })
    .filter(Boolean)
    .join(', ');
}

function extractXmlTag(xml, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, 'i');
  const match = xml.match(pattern);
  return match ? match[1].trim() : null;
}

function calculateSimilarity(str1, str2) {
  // Simple Jaccard similarity on words
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Main function to extract metadata from any supported file
 */
export async function extractMetadataFromFile(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.pdf')) {
    return extractPdfMetadata(file);
  } else if (fileName.endsWith('.epub')) {
    return extractEpubMetadata(file);
  }

  return null;
}

// ============================================
// HARVARD REFERENCE GENERATOR
// ============================================

/**
 * Generate Harvard-style reference from paper metadata
 */
export function generateHarvardReference(paper) {
  const { title, authors, year, journal, doi, url, publisher, volume, issue, pages } = paper;

  // Format authors for Harvard style
  const formattedAuthors = formatAuthorsHarvard(authors);

  // Build the reference
  let reference = '';

  if (formattedAuthors) {
    reference += formattedAuthors;
  } else {
    reference += 'Anon.';
  }

  // Year
  reference += ` (${year || 'n.d.'})`;

  // Title (in single quotes for articles, italics for books)
  if (journal) {
    // Journal article
    reference += ` '${title}',`;
    reference += ` ${journal}`;

    if (volume) {
      reference += `, ${volume}`;
      if (issue) {
        reference += `(${issue})`;
      }
    }

    if (pages) {
      reference += `, pp. ${pages}`;
    }

    reference += '.';
  } else if (publisher) {
    // Book
    reference += ` ${title}.`;
    reference += ` ${publisher}.`;
  } else {
    // Generic/online source
    reference += ` ${title}.`;
  }

  // DOI or URL
  if (doi) {
    reference += ` doi: ${doi}.`;
  } else if (url) {
    reference += ` Available at: ${url}`;
    reference += ` (Accessed: ${formatAccessDate()}).`;
  }

  return reference;
}

/**
 * Format authors for Harvard style
 * Harvard uses: Surname, Initial. and Surname, Initial.
 * For 3+ authors: First Author et al.
 */
function formatAuthorsHarvard(authorsString) {
  if (!authorsString) return '';

  // Split authors by comma or 'and'
  const authors = authorsString
    .split(/,\s*|\s+and\s+|\s*&\s*/)
    .map(a => a.trim())
    .filter(Boolean);

  if (authors.length === 0) return '';

  // Format each author as "Surname, Initial."
  const formatted = authors.map(author => {
    const parts = author.split(/\s+/);
    if (parts.length === 1) {
      return parts[0];
    }

    // Assume last word is surname
    const surname = parts[parts.length - 1];
    const initials = parts
      .slice(0, -1)
      .map(p => p[0]?.toUpperCase() + '.')
      .join('');

    return `${surname}, ${initials}`;
  });

  // Harvard style for multiple authors
  if (formatted.length === 1) {
    return formatted[0];
  } else if (formatted.length === 2) {
    return `${formatted[0]} and ${formatted[1]}`;
  } else if (formatted.length === 3) {
    return `${formatted[0]}, ${formatted[1]} and ${formatted[2]}`;
  } else {
    // 4+ authors: use et al.
    return `${formatted[0]} et al.`;
  }
}

function formatAccessDate() {
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleString('en-GB', { month: 'long' });
  const year = now.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Generate in-text citation
 */
export function generateInTextCitation(paper, includePageNumber = false, pageNumber = '') {
  const { authors, year } = paper;

  // Get first author surname
  let authorPart = 'Anon.';
  if (authors) {
    const authorList = authors.split(/,\s*|\s+and\s+|\s*&\s*/);
    if (authorList.length > 0) {
      const firstAuthor = authorList[0].trim();
      const parts = firstAuthor.split(/\s+/);
      authorPart = parts[parts.length - 1]; // Surname

      if (authorList.length === 2) {
        const secondAuthor = authorList[1].trim();
        const parts2 = secondAuthor.split(/\s+/);
        authorPart += ` and ${parts2[parts2.length - 1]}`;
      } else if (authorList.length > 2) {
        authorPart += ' et al.';
      }
    }
  }

  let citation = `(${authorPart}, ${year || 'n.d.'}`;

  if (includePageNumber && pageNumber) {
    citation += `, p. ${pageNumber}`;
  }

  citation += ')';

  return citation;
}

// ============================================
// SHARED AUTHOR PARSING
// ============================================

// Splits a free-form authors string into [{ surname, given }] entries.
// Handles common separators (comma, " and ", "&", semicolon).
function splitAuthors(authorsString) {
  if (!authorsString) return [];
  const raw = authorsString
    .split(/;\s*|\s+and\s+|\s*&\s*|,\s*(?=[A-Z])/)
    .map((a) => a.trim())
    .filter(Boolean);
  return raw.map((a) => {
    const parts = a.split(/\s+/);
    if (parts.length === 1) return { surname: parts[0], given: '' };
    return {
      surname: parts[parts.length - 1],
      given: parts.slice(0, -1).join(' '),
    };
  });
}

function initials(given) {
  if (!given) return '';
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() + '.')
    .join(' ');
}

// ============================================
// APA 7th edition
// ============================================

export function generateAPAReference(paper) {
  const { title = '', year = 'n.d.', journal, volume, issue, pages, doi, url, publisher } = paper;
  const authors = splitAuthors(paper.authors);

  // Author list: Last, F. M., & Last, F. M. (up to 20)
  let authorPart = '';
  if (authors.length === 0) {
    authorPart = '';
  } else if (authors.length === 1) {
    authorPart = `${authors[0].surname}, ${initials(authors[0].given)}`;
  } else if (authors.length <= 20) {
    const formatted = authors.map((a) => `${a.surname}, ${initials(a.given)}`);
    const last = formatted.pop();
    authorPart = `${formatted.join(', ')}, & ${last}`;
  } else {
    // 21+ authors: list first 19, then ..., then last
    const formatted = authors.slice(0, 19).map((a) => `${a.surname}, ${initials(a.given)}`);
    const last = `${authors[authors.length - 1].surname}, ${initials(authors[authors.length - 1].given)}`;
    authorPart = `${formatted.join(', ')}, ... ${last}`;
  }

  let ref = authorPart ? `${authorPart} ` : '';
  ref += `(${year}). `;
  ref += `${title}. `;

  if (journal) {
    ref += `${journal}`;
    if (volume) {
      ref += `, ${volume}`;
      if (issue) ref += `(${issue})`;
    }
    if (pages) ref += `, ${pages}`;
    ref += '.';
  } else if (publisher) {
    ref += `${publisher}.`;
  }

  if (doi) ref += ` https://doi.org/${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}`;
  else if (url) ref += ` ${url}`;

  return ref.trim();
}

// ============================================
// MLA 9th edition
// ============================================

export function generateMLAReference(paper) {
  const { title = '', year, journal, volume, issue, pages, doi, url, publisher } = paper;
  const authors = splitAuthors(paper.authors);

  let authorPart = '';
  if (authors.length === 1) {
    authorPart = `${authors[0].surname}, ${authors[0].given}`;
  } else if (authors.length === 2) {
    authorPart = `${authors[0].surname}, ${authors[0].given}, and ${authors[1].given} ${authors[1].surname}`;
  } else if (authors.length >= 3) {
    authorPart = `${authors[0].surname}, ${authors[0].given}, et al.`;
  }

  let ref = authorPart ? `${authorPart}. ` : '';
  ref += `"${title}." `;

  if (journal) {
    ref += `${journal}`;
    if (volume) ref += `, vol. ${volume}`;
    if (issue) ref += `, no. ${issue}`;
    if (year) ref += `, ${year}`;
    if (pages) ref += `, pp. ${pages}`;
    ref += '.';
  } else if (publisher) {
    ref += `${publisher}, ${year || ''}.`;
  } else if (year) {
    ref += `${year}.`;
  }

  if (doi) ref += ` doi:${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}.`;
  else if (url) ref += ` ${url}.`;

  return ref.trim();
}

// ============================================
// Chicago author-date
// ============================================

export function generateChicagoReference(paper) {
  const { title = '', year = 'n.d.', journal, volume, issue, pages, doi, url, publisher } = paper;
  const authors = splitAuthors(paper.authors);

  let authorPart = '';
  if (authors.length === 1) {
    authorPart = `${authors[0].surname}, ${authors[0].given}`;
  } else if (authors.length === 2) {
    authorPart = `${authors[0].surname}, ${authors[0].given}, and ${authors[1].given} ${authors[1].surname}`;
  } else if (authors.length === 3) {
    authorPart = `${authors[0].surname}, ${authors[0].given}, ${authors[1].given} ${authors[1].surname}, and ${authors[2].given} ${authors[2].surname}`;
  } else if (authors.length >= 4) {
    authorPart = `${authors[0].surname}, ${authors[0].given}, et al.`;
  }

  let ref = authorPart ? `${authorPart}. ` : '';
  ref += `${year}. `;
  ref += `"${title}." `;

  if (journal) {
    ref += `${journal} `;
    if (volume) ref += `${volume}`;
    if (issue) ref += ` (${issue})`;
    if (pages) ref += `: ${pages}`;
    ref += '.';
  } else if (publisher) {
    ref += `${publisher}.`;
  }

  if (doi) ref += ` https://doi.org/${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}.`;
  else if (url) ref += ` ${url}.`;

  return ref.trim();
}

// ============================================
// IEEE
// ============================================

export function generateIEEEReference(paper) {
  const { title = '', year, journal, volume, issue, pages, doi, publisher } = paper;
  const authors = splitAuthors(paper.authors);

  // IEEE: F. Last, F. Last and F. Last
  const formatted = authors.map((a) => {
    const ini = a.given
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase() + '.')
      .join(' ');
    return `${ini} ${a.surname}`.trim();
  });

  let authorPart = '';
  if (formatted.length === 1) authorPart = formatted[0];
  else if (formatted.length === 2) authorPart = `${formatted[0]} and ${formatted[1]}`;
  else if (formatted.length >= 3) {
    const last = formatted.pop();
    authorPart = `${formatted.join(', ')}, and ${last}`;
  }

  let ref = authorPart ? `${authorPart}, ` : '';
  ref += `"${title},"`;
  if (journal) {
    ref += ` ${journal}`;
    if (volume) ref += `, vol. ${volume}`;
    if (issue) ref += `, no. ${issue}`;
    if (pages) ref += `, pp. ${pages}`;
    if (year) ref += `, ${year}`;
    ref += '.';
  } else if (publisher) {
    ref += ` ${publisher}, ${year || ''}.`;
  } else if (year) {
    ref += ` ${year}.`;
  }
  if (doi) ref += ` doi: ${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}.`;

  return ref.trim();
}

// ============================================
// BibTeX
// ============================================

// Generate a stable cite key like "smith2023attention" from the first author's
// surname, year, and the first significant word of the title.
export function generateBibTeXKey(paper) {
  const authors = splitAuthors(paper.authors);
  const surname = authors[0]?.surname?.toLowerCase().replace(/[^a-z]/g, '') || 'unknown';
  const yr = paper.year ? String(paper.year).replace(/[^0-9]/g, '') : 'nd';
  const titleWord = (paper.title || '')
    .toLowerCase()
    .split(/\s+/)
    .find((w) => w.length > 3 && !['the', 'and', 'with', 'from', 'this', 'that'].includes(w)) || '';
  return `${surname}${yr}${titleWord.replace(/[^a-z0-9]/g, '')}`;
}

// Escape BibTeX special characters in field values.
function escapeBibTeX(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[{}]/g, (c) => `\\${c}`)
    .replace(/[&%$#_^~]/g, (c) => `\\${c}`);
}

export function generateBibTeX(paper) {
  const key = generateBibTeXKey(paper);
  const authors = splitAuthors(paper.authors);
  const authorField = authors
    .map((a) => `${a.surname}, ${a.given}`.trim().replace(/,\s*$/, ''))
    .join(' and ');

  const isJournal = !!paper.journal;
  const entryType = isJournal ? 'article' : (paper.publisher ? 'book' : 'misc');

  const fields = [];
  if (paper.title) fields.push(`  title = {${escapeBibTeX(paper.title)}}`);
  if (authorField) fields.push(`  author = {${escapeBibTeX(authorField)}}`);
  if (paper.year) fields.push(`  year = {${paper.year}}`);
  if (paper.journal) fields.push(`  journal = {${escapeBibTeX(paper.journal)}}`);
  if (paper.publisher) fields.push(`  publisher = {${escapeBibTeX(paper.publisher)}}`);
  if (paper.volume) fields.push(`  volume = {${paper.volume}}`);
  if (paper.issue) fields.push(`  number = {${paper.issue}}`);
  if (paper.pages) fields.push(`  pages = {${paper.pages}}`);
  if (paper.doi) fields.push(`  doi = {${paper.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}}`);
  if (paper.url) fields.push(`  url = {${paper.url}}`);

  return `@${entryType}{${key},\n${fields.join(',\n')}\n}`;
}

export const CITATION_STYLES = [
  { id: 'harvard', label: 'Harvard', generate: generateHarvardReference },
  { id: 'apa', label: 'APA', generate: generateAPAReference },
  { id: 'mla', label: 'MLA', generate: generateMLAReference },
  { id: 'chicago', label: 'Chicago', generate: generateChicagoReference },
  { id: 'ieee', label: 'IEEE', generate: generateIEEEReference },
  { id: 'bibtex', label: 'BibTeX', generate: generateBibTeX },
];
