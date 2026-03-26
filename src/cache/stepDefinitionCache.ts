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
    private isBuilding: boolean = false;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Build the complete cache by scanning all Python step definition files
     */
    async buildCache(): Promise<void> {
        if (this.isBuilding) {
            return;
        }

        this.isBuilding = true;
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

            for (const pattern of patterns) {
                const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
                this.logger.info(`Found ${files.length} files matching pattern: ${pattern}`);

                for (const fileUri of files) {
                    await this.parseAndCacheFile(fileUri);
                }
            }

            this.logger.info(`Cache built with ${this.allDefinitions.length} step definitions`);
        } catch (error) {
            this.logger.error(`Error building cache: ${error}`);
        } finally {
            this.isBuilding = false;
        }
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
