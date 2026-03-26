/**
 * Step CodeLens Provider
 * 
 * Provides CodeLens annotations above Gherkin steps showing
 * the file where the step definition is located.
 */

import * as vscode from 'vscode';
import { StepDefinitionCache } from '../cache/stepDefinitionCache';
import { Logger } from '../utils/logger';
import { parseGherkinLine } from '../utils/gherkinParser';
import * as path from 'path';

export class StepCodeLensProvider implements vscode.CodeLensProvider {
    private cache: StepDefinitionCache;
    private logger: Logger;
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(cache: StepDefinitionCache, logger: Logger) {
        this.cache = cache;
        this.logger = logger;
    }

    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const stepInfo = parseGherkinLine(line.text);

            if (stepInfo) {
                const definition = this.cache.findMatchingDefinition(stepInfo.stepText);

                if (definition) {
                    const range = new vscode.Range(i, 0, i, 0);
                    const fileName = path.basename(definition.fileUri.fsPath);
                    
                    const codeLens = new vscode.CodeLens(range, {
                        title: `→ ${fileName}:${definition.line + 1}`,
                        command: 'vscode.open',
                        arguments: [
                            definition.fileUri,
                            {
                                selection: new vscode.Range(
                                    definition.line,
                                    definition.column,
                                    definition.line,
                                    definition.column
                                )
                            }
                        ]
                    });

                    codeLenses.push(codeLens);
                } else {
                    // Optionally show CodeLens for missing definitions
                    const range = new vscode.Range(i, 0, i, 0);
                    const codeLens = new vscode.CodeLens(range, {
                        title: '⚠️ No definition found',
                        command: ''
                    });
                    codeLenses.push(codeLens);
                }
            }
        }

        return codeLenses;
    }

    resolveCodeLens(
        codeLens: vscode.CodeLens,
        _token: vscode.CancellationToken
    ): vscode.CodeLens {
        return codeLens;
    }
}
