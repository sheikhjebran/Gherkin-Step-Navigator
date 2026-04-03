/**
 * Step Definition Cache
 * 
 * Maintains an in-memory cache of all step definitions found in the workspace.
 * Parses Python files for Behave step decorators and stores their patterns and locations.
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { StepDefinition, parseStepDefinitions } from '../parser/stepParser';

export class StepDefinitionCache {
    private cache: Map<string, StepDefinition[]> = new Map();
    private allDefinitions: StepDefinition[] = [];
    private logger: Logger;
    private buildQueue: Promise<void> = Promise.resolve();

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Build the complete cache by scanning all Python step definition files
     * Ensures only one build runs at a time (queued).
     * Shows progress and errors to the user.
     */
    async buildCache(): Promise<void> {
        // Queue builds to avoid race conditions
        this.buildQueue = this.buildQueue.then(() => this._buildCacheWithProgress());
        return this.buildQueue;
    }

    private async _buildCacheWithProgress(): Promise<void> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Building Gherkin step definition cache...',
            cancellable: false
        }, async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
            this.cache.clear();
            this.allDefinitions = [];
            try {
                const config = vscode.workspace.getConfiguration('gherkinStepNavigator');
                const patterns = config.get<string[]>('stepDefinitionPaths', [
                    '**/steps/**/*.py',
                    '**/step_definitions/**/*.py',
                    '**/features/steps/**/*.py'
                ]);
                this.logger.info(`Scanning for step definitions using patterns: ${patterns.join(', ')}`);
                let totalFiles = 0;
                let processedFiles = 0;
                // Count total files for progress
                for (const pattern of patterns) {
                    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
                    totalFiles += files.length;
                }
                if (totalFiles === 0) {
                    progress.report({ message: 'No step definition files found.' });
                }
                for (const pattern of patterns) {
                    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
                    this.logger.info(`Found ${files.length} files matching pattern: ${pattern}`);
                    // Batch file processing for performance
                    const batchSize = 10;
                    for (let i = 0; i < files.length; i += batchSize) {
                        const batch = files.slice(i, i + batchSize);
                        await Promise.all(batch.map((fileUri: vscode.Uri) => this.parseAndCacheFile(fileUri)));
                        processedFiles += batch.length;
                        progress.report({
                            message: `Processed ${processedFiles} of ${totalFiles} files...`,
                            increment: (batch.length / totalFiles) * 100
                        });
                    }
                }
                this.logger.info(`Cache built with ${this.allDefinitions.length} step definitions`);
            } catch (error) {
                this.logger.error(`Error building cache: ${error}`);
                vscode.window.showErrorMessage('Failed to build Gherkin step definition cache. See output for details.');
            }
        });
    }

    /**
     * Parse a single file and add its step definitions to the cache
     */
    private async parseAndCacheFile(fileUri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();
            const definitions = parseStepDefinitions(content, fileUri);

            if (definitions.length > 0) {
                this.cache.set(fileUri.fsPath, definitions);
                this.allDefinitions.push(...definitions);
                this.logger.debug(`Parsed ${definitions.length} steps from ${fileUri.fsPath}`);
            }
        } catch (error) {
            this.logger.error(`Error parsing file ${fileUri.fsPath}: ${error}`);
        }
    }

    /**
     * Update cache for a single file (when file changes)
     */
    async updateFile(fileUri: vscode.Uri): Promise<void> {
        // Remove old definitions for this file
        this.removeFile(fileUri);

        // Re-parse the file
        await this.parseAndCacheFile(fileUri);

        // Rebuild allDefinitions array
        this.allDefinitions = [];
        for (const definitions of this.cache.values()) {
            this.allDefinitions.push(...definitions);
        }

        this.logger.debug(`Updated cache for ${fileUri.fsPath}`);
    }

    /**
     * Remove a file from the cache
     */
    removeFile(fileUri: vscode.Uri): void {
        const removed = this.cache.delete(fileUri.fsPath);
        if (removed) {
            this.allDefinitions = [];
            for (const definitions of this.cache.values()) {
                this.allDefinitions.push(...definitions);
            }
            this.logger.debug(`Removed ${fileUri.fsPath} from cache`);
        }
    }

    /**
     * Get all cached step definitions
     */
    getAllDefinitions(): StepDefinition[] {
        return this.allDefinitions;
    }

    /**
     * Find a step definition that matches the given step text
     */
    findMatchingDefinition(stepText: string): StepDefinition | undefined {
        const normalizedStep = this.normalizeStepText(stepText);
        
        for (const definition of this.allDefinitions) {
            if (this.matchesStep(normalizedStep, definition)) {
                return definition;
            }
        }

        return undefined;
    }

    /**
     * Find all step definitions that match the given step text
     */
    findAllMatchingDefinitions(stepText: string): StepDefinition[] {
        const normalizedStep = this.normalizeStepText(stepText);
        const matches: StepDefinition[] = [];

        for (const definition of this.allDefinitions) {
            if (this.matchesStep(normalizedStep, definition)) {
                matches.push(definition);
            }
        }

        return matches;
    }

    /**
     * Normalize step text by removing the keyword (Given/When/Then/And/But)
     */
    private normalizeStepText(stepText: string): string {
        return stepText
            .replace(/^\s*(Given|When|Then|And|But)\s+/i, '')
            .trim();
    }

    /**
     * Check if a step text matches a step definition pattern
     */
    private matchesStep(stepText: string, definition: StepDefinition): boolean {
        try {
            const regex = definition.regex;
            return regex.test(stepText);
        } catch {
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): { fileCount: number; definitionCount: number } {
        return {
            fileCount: this.cache.size,
            definitionCount: this.allDefinitions.length
        };
    }
}
