/**
 * Utility functions for learner name parsing and credential generation.
 */

/**
 * Extracts a normalized, lowercase surname password from a learner's full name.
 * 
 * Supports:
 * - DepEd SF1 format ("Lastname, Firstname Middlename" e.g. "Dela Cruz, Juan M." -> "delacruz")
 * - Standard format ("Firstname Middlename Lastname" e.g. "Juan Dela Cruz" -> "delacruz", "Juan Santos" -> "santos")
 * - Common Filipino compound surname prefixes: Dela, Delos, De, Del, San, Santa
 * - Fallbacks to trimmed lowercase LRN if name cannot be extracted or parsed.
 */
export function extractSurnamePassword(fullName: string, fallbackLrn: string): string {
  const safeLrn = (fallbackLrn || '').toString().trim().toLowerCase();
  const trimmed = (fullName || '').trim();
  if (!trimmed) return safeLrn;

  let surname = '';
  if (trimmed.includes(',')) {
    // DepEd SF1 format: Surname is before the comma
    surname = trimmed.split(',')[0].trim();
  } else {
    // Standard format: Firstname [Middlename] Lastname
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      surname = parts[0];
    } else {
      const compoundPrefixes = ['dela', 'delos', 'de', 'del', 'san', 'santa'];
      const penultimate = parts[parts.length - 2].toLowerCase();
      if (compoundPrefixes.includes(penultimate)) {
        surname = parts.slice(-2).join('');
      } else {
        surname = parts[parts.length - 1];
      }
    }
  }

  const clean = surname.toLowerCase().replace(/[^a-z0-9]/gi, '');
  return clean || safeLrn;
}
