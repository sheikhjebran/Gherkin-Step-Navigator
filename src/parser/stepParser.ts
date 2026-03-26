/**
 * Step Definition Parser
 * 
 * Parses Python files to extract Behave step definitions.
 * Handles various decorator formats and parameter patterns.
 */

import * as vscode from 'vscode';

export interface StepDefinition {
    /** The original pattern string from the decorator */
    pattern: string;
    /** Compiled regex for matching steps */
    regex: RegExp;
    /** The type of step (step, given, when, then, etc.) */
    type: string;
    /** The function name */
    functionName: string;
    /** The file URI where this step is defined */
    fileUri: vscode.Uri;
    /** The line number where the decorator is located */
    line: number;
    /** The column where the decorator starts */
    column: number;
    /** The full decorator line */
    decoratorLine: string;
    /** Docstring if available */
    docstring?: string;
}

/**
 * Parse a Python file and extract all step definitions
 */
export function parseStepDefinitions(content: string, fileUri: vscode.Uri): StepDefinition[] {
    const definitions: StepDefinition[] = [];
    const lines = content.split('\n');

    // Regex patterns for step decorators
    // Matches: @step('pattern'), @given("pattern"), @when(u'pattern'), etc.
    const decoratorPatterns = [
        // Single-line decorator with single quotes
        /^(\s*)@(step|given|when|then|and|but)\s*\(\s*(?:u)?['"](.+?)['"]\s*\)/i,
        // Single-line decorator with double quotes
        /^(\s*)@(step|given|when|then|and|but)\s*\(\s*(?:u)?["'](.+?)["']\s*\)/i,
        // Multi-line decorator (pattern on same line)
        /^(\s*)@(step|given|when|then|and|but)\s*\(\s*$/i,
    ];

    // Regex for function definition
    const funcDefPattern = /^(\s*)def\s+(\w+)\s*\(/;
    
    // Regex for docstring
    const docstringPattern = /^\s*(?:"""(.+?)"""|'''(.+?)''')/s;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        
        // Try each decorator pattern
        for (const pattern of decoratorPatterns) {
            const match = line.match(pattern);
            
            if (match) {
                const indent = match[1];
                const stepType = match[2].toLowerCase();
                let stepPattern: string | undefined;
                
                // Check if this is a multi-line decorator
                if (match.length === 3 && !match[3]) {
                    // Multi-line: look for pattern on next line
                    if (i + 1 < lines.length) {
                        const nextLine = lines[i + 1];
                        const patternMatch = nextLine.match(/^\s*(?:u)?['"](.+?)['"]\s*\)?$/);
                        if (patternMatch) {
                            stepPattern = patternMatch[1];
                        }
                    }
                } else if (match[3]) {
                    stepPattern = match[3];
                }

                if (stepPattern) {
                    // Find the function definition after the decorator
                    let funcLine = i + 1;
                    let functionName = '';
                    let docstring: string | undefined;

                    // Skip any additional decorators
                    while (funcLine < lines.length && lines[funcLine].match(/^\s*@/)) {
                        funcLine++;
                    }

                    // Find the function definition
                    if (funcLine < lines.length) {
                        const funcMatch = lines[funcLine].match(funcDefPattern);
                        if (funcMatch) {
                            functionName = funcMatch[2];

                            // Look for docstring in the next few lines
                            for (let docLine = funcLine + 1; docLine < Math.min(funcLine + 5, lines.length); docLine++) {
                                const combinedLines = lines.slice(funcLine + 1, docLine + 1).join('\n');
                                const docMatch = combinedLines.match(docstringPattern);
                                if (docMatch) {
                                    docstring = (docMatch[1] || docMatch[2]).trim();
                                    break;
                                }
                                // Stop if we hit non-whitespace that's not a docstring
                                if (lines[docLine].trim() && !lines[docLine].trim().startsWith('"""') && !lines[docLine].trim().startsWith("'''")) {
                                    break;
                                }
                            }
                        }
                    }

                    // Convert the pattern to a regex
                    const regex = patternToRegex(stepPattern);

                    definitions.push({
                        pattern: stepPattern,
                        regex,
                        type: stepType,
                        functionName,
                        fileUri,
                        line: i,
                        column: indent.length,
                        decoratorLine: line.trim(),
                        docstring
                    });
                }
                break;
            }
        }
        i++;
    }

    return definitions;
}

/**
 * Convert a Behave step pattern to a regex
 * 
 * Handles:
 * - {param} - Named parameters
 * - {param:d} - Integer parameters
 * - {param:w} - Word parameters
 * - {param:S} - Non-whitespace parameters
 * - Regular expressions in the pattern
 */
export function patternToRegex(pattern: string): RegExp {
    // Check if the pattern is already a regex (starts with ^ or contains unescaped regex chars)
    if (pattern.startsWith('^') || pattern.endsWith('$')) {
        try {
            return new RegExp(pattern, 'i');
        } catch {
            // Fall through to normal processing
        }
    }

    // Escape regex special characters except for our placeholders
    let regexStr = pattern
        // First, temporarily replace placeholders
        .replace(/\{([^}:]+)(?::([^}]+))?\}/g, '___PLACEHOLDER_$1_$2___')
        // Escape regex special characters
        .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
        // Restore and convert placeholders
        .replace(/___PLACEHOLDER_([^_]+)_([^_]*)___/g, (_, name, type) => {
            switch (type) {
                case 'd':
                    return '(-?\\d+)';
                case 'w':
                    return '(\\w+)';
                case 'S':
                    return '(\\S+)';
                case 'f':
                    return '(-?\\d+\\.?\\d*)';
                default:
                    // Default: match quoted strings or any non-whitespace
                    return '(?:"([^"]*)"|\'([^\']*)\'|([^\\s]+))';
            }
        });

    // Handle optional trailing content
    regexStr = `^${regexStr}$`;

    try {
        return new RegExp(regexStr, 'i');
    } catch {
        // If regex compilation fails, create a simple pattern
        return new RegExp(`^${escapeRegex(pattern)}$`, 'i');
    }
}

/**
 * Escape all regex special characters in a string
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract parameters from a step pattern
 */
export function extractParameters(pattern: string): string[] {
    const paramRegex = /\{([^}:]+)(?::[^}]+)?\}/g;
    const params: string[] = [];
    let match;

    while ((match = paramRegex.exec(pattern)) !== null) {
        params.push(match[1]);
    }

    return params;
}
