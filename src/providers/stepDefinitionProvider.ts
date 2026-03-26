/**
 * Step Definition Provider
 * 
 * Implements VS Code's DefinitionProvider interface to enable
 * Go to Definition (F12/Ctrl+Click) from Gherkin steps to Python step definitions.
 */

import * as vscode from 'vscode';
import { StepDefinitionCache } from '../cache/stepDefinitionCache';
import { Logger } from '../utils/logger';
import { parseGherkinLine } from '../utils/gherkinParser';

export class StepDefinitionProvider implements vscode.DefinitionProvider {
    private cache: StepDefinitionCache;
    private logger: Logger;

    constructor(cache: StepDefinitionCache, logger: Logger) {
        this.cache = cache;
        this.logger = logger;
    }

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Definition | vscode.LocationLink[] | null> {
        const line = document.lineAt(position.line);
        const stepInfo = parseGherkinLine(line.text);

        if (!stepInfo) {
            this.logger.debug(`No step found on line ${position.line + 1}`);
            return null;
        }

        this.logger.info(`Looking for definition of: "${stepInfo.stepText}"`);

        // Find matching step definition
        const definition = this.cache.findMatchingDefinition(stepInfo.stepText);

        if (!definition) {
            this.logger.debug(`No definition found for: "${stepInfo.stepText}"`);
            return null;
        }

        this.logger.info(`Found definition in ${definition.fileUri.fsPath}:${definition.line + 1}`);

        // Create a LocationLink for more precise navigation
        const targetRange = new vscode.Range(
            definition.line,
            definition.column,
            definition.line,
            definition.column + definition.decoratorLine.length
        );

        const originSelectionRange = new vscode.Range(
            position.line,
            stepInfo.startColumn,
            position.line,
            stepInfo.endColumn
        );

        const locationLink: vscode.LocationLink = {
            originSelectionRange,
            targetUri: definition.fileUri,
            targetRange,
            targetSelectionRange: targetRange
        };

        return [locationLink];
    }
}
