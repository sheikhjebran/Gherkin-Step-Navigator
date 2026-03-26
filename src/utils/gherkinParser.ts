/**
 * Gherkin Line Parser
 * 
 * Utility functions for parsing Gherkin step lines from feature files.
 */

export interface GherkinStepInfo {
    /** The keyword (Given, When, Then, And, But) */
    keyword: string;
    /** The step text after the keyword */
    stepText: string;
    /** The full line text */
    fullText: string;
    /** Column where the keyword starts */
    keywordColumn: number;
    /** Column where the step text starts */
    startColumn: number;
    /** Column where the step text ends */
    endColumn: number;
}

/**
 * Parse a line from a Gherkin feature file
 * Returns step information if the line contains a step, null otherwise
 */
export function parseGherkinLine(line: string): GherkinStepInfo | null {
    // Regex to match Gherkin step lines
    // Handles: Given/When/Then/And/But with various indentation
    const stepRegex = /^(\s*)(Given|When|Then|And|But|\*)\s+(.+)$/i;
    
    const match = line.match(stepRegex);
    
    if (!match) {
        return null;
    }

    const indent = match[1];
    const keyword = match[2];
    const stepText = match[3].trim();

    // Handle comments - step text should not start with #
    if (stepText.startsWith('#')) {
        return null;
    }

    // Remove trailing comments if any
    const cleanStepText = stepText.replace(/\s*#.*$/, '').trim();

    if (!cleanStepText) {
        return null;
    }

    const keywordColumn = indent.length;
    const startColumn = indent.length + keyword.length + 1; // +1 for the space after keyword
    const endColumn = startColumn + cleanStepText.length;

    return {
        keyword,
        stepText: cleanStepText,
        fullText: line,
        keywordColumn,
        startColumn,
        endColumn
    };
}

/**
 * Check if a line is a Gherkin keyword line (Feature, Scenario, Background, etc.)
 */
export function isGherkinKeywordLine(line: string): boolean {
    const keywordRegex = /^\s*(Feature|Background|Scenario|Scenario Outline|Examples|Rule):/i;
    return keywordRegex.test(line);
}

/**
 * Check if a line is a data table row
 */
export function isDataTableRow(line: string): boolean {
    return /^\s*\|.*\|/.test(line);
}

/**
 * Check if a line is a tag line
 */
export function isTagLine(line: string): boolean {
    return /^\s*@/.test(line);
}

/**
 * Check if a line is a comment
 */
export function isCommentLine(line: string): boolean {
    return /^\s*#/.test(line);
}

/**
 * Check if a line is a doc string delimiter
 */
export function isDocStringDelimiter(line: string): boolean {
    return /^\s*("""|''')/.test(line);
}

/**
 * Extract tags from a tag line
 */
export function extractTags(line: string): string[] {
    const tagRegex = /@[\w-]+/g;
    const matches = line.match(tagRegex);
    return matches || [];
}

/**
 * Check if a line is empty or contains only whitespace
 */
export function isEmptyLine(line: string): boolean {
    return /^\s*$/.test(line);
}
