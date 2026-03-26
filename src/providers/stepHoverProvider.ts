/**
 * Step Hover Provider
 * 
 * Provides hover information when hovering over Gherkin steps,
 * showing the matching step definition pattern and docstring.
 */

import * as vscode from 'vscode';
import { StepDefinitionCache } from '../cache/stepDefinitionCache';
import { Logger } from '../utils/logger';
import { parseGherkinLine } from '../utils/gherkinParser';
import * as path from 'path';

export class StepHoverProvider implements vscode.HoverProvider {
    private cache: StepDefinitionCache;
    private logger: Logger;

    constructor(cache: StepDefinitionCache, logger: Logger) {
        this.cache = cache;
        this.logger = logger;
    }

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.Hover | null {
        const line = document.lineAt(position.line);
        const stepInfo = parseGherkinLine(line.text);

        if (!stepInfo) {
            return null;
        }

        // Check if cursor is within the step text
        if (position.character < stepInfo.startColumn || position.character > stepInfo.endColumn) {
            return null;
        }

        const definition = this.cache.findMatchingDefinition(stepInfo.stepText);

        if (!definition) {
            // Return a hover indicating no definition was found
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown('⚠️ **No step definition found**\n\n');
            markdown.appendMarkdown(`Looking for: \`${stepInfo.stepText}\``);
            return new vscode.Hover(markdown);
        }

        // Build the hover content
        const markdown = new vscode.MarkdownString();
        
        // Add step type and pattern
        markdown.appendMarkdown(`**@${definition.type}** \`${definition.pattern}\`\n\n`);

        // Add function name and file location
        const relativePath = vscode.workspace.asRelativePath(definition.fileUri);
        const fileName = path.basename(definition.fileUri.fsPath);
        markdown.appendMarkdown(`📍 \`${definition.functionName}\` in [${fileName}](${definition.fileUri.toString()}#L${definition.line + 1})\n\n`);

        // Add docstring if available
        if (definition.docstring) {
            markdown.appendMarkdown('---\n\n');
            markdown.appendMarkdown(definition.docstring);
        }

        // Make the file link clickable
        markdown.isTrusted = true;

        const range = new vscode.Range(
            position.line,
            stepInfo.startColumn,
            position.line,
            stepInfo.endColumn
        );

        return new vscode.Hover(markdown, range);
    }
}
