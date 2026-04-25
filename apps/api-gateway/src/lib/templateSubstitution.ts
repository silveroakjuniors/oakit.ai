/**
 * Template Variable Substitution
 *
 * Utilities for substituting `{{variable}}` placeholders in offer letter
 * template bodies, detecting missing variables, and validating that
 * employment terms are non-blank before submission.
 */

/**
 * Replace every `{{key}}` occurrence in `body` with the corresponding value
 * from `values`. All occurrences of each variable are replaced (global).
 *
 * @param body   - Template string containing zero or more `{{key}}` placeholders.
 * @param values - Map of variable names to their replacement strings.
 * @returns The body with all matched placeholders substituted.
 */
export function substituteVariables(body: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    // Escape any regex special chars in the key before building the pattern
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return result.replace(new RegExp(`\\{\\{${escaped}\\}\\}`, 'g'), value);
  }, body);
}

/**
 * Find all `{{variable_name}}` placeholders in `body` that have no
 * corresponding entry in `values` (or whose entry is an empty string).
 *
 * @param body   - Template string to scan for placeholders.
 * @param values - Map of variable names to their replacement strings.
 * @returns Array of variable names that are missing or empty in `values`.
 */
export function findMissingVariables(body: string, values: Record<string, string>): string[] {
  const pattern = /\{\{([^}]+)\}\}/g;
  const found = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    found.add(match[1]);
  }

  return Array.from(found).filter((name) => !values[name]);
}

/**
 * Validate that `terms` contains at least one non-whitespace character.
 *
 * @param terms - Employment terms string to validate.
 * @returns `true` if the string has meaningful content, `false` if blank or whitespace-only.
 */
export function validateTerms(terms: string): boolean {
  return terms.trim().length > 0;
}
