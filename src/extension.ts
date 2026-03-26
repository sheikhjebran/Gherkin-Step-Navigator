/**
 * Gherkin Step Navigator - VS Code Extension
 * 
 * Provides navigation from Gherkin feature file steps to Python Behave step definitions.
 * Supports Go to Definition (F12/Ctrl+Click), Hover information, and CodeLens.
 * 
 * @author Sheikh Jebran
 */

import * as vscode from 'vscode';
import { StepDefinitionProvider } from './providers/stepDefinitionProvider';
import { StepHoverProvider } from './providers/stepHoverProvider';
import { StepCodeLensProvider } from './providers/stepCodeLensProvider';
import { StepDefinitionCache } from './cache/stepDefinitionCache';
import { Logger } from './utils/logger';

let stepCache: StepDefinitionCache;
let logger: Logger;
let codeLensProviderDisposable: vscode.Disposable | undefined;
let codeLensProvider: StepCodeLensProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
    logger = new Logger('Gherkin Step Navigator');
    logger.info('Extension activating...');

    // Initialize the step definition cache
    stepCache = new StepDefinitionCache(logger);

    // Build initial cache
    stepCache.buildCache().then(() => {
        logger.info('Initial step definition cache built');
    });

    // Register the definition provider for .feature files
    const definitionProvider = new StepDefinitionProvider(stepCache, logger);
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { language: 'feature', scheme: 'file' },
            definitionProvider
        )
    );

    // Register hover provider
    const config = vscode.workspace.getConfiguration('gherkinStepNavigator');
    if (config.get<boolean>('enableHover', true)) {
        const hoverProvider = new StepHoverProvider(stepCache, logger);
        context.subscriptions.push(
            vscode.languages.registerHoverProvider(
                { language: 'feature', scheme: 'file' },
                hoverProvider
            )
        );
    }

    // Create CodeLens provider instance
    codeLensProvider = new StepCodeLensProvider(stepCache, logger);

    // Register CodeLens provider if enabled
    if (config.get<boolean>('enableCodeLens', true)) {
        registerCodeLensProvider(context);
    }

    // Listen for configuration changes to dynamically enable/disable CodeLens
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('gherkinStepNavigator.enableCodeLens')) {
                const newConfig = vscode.workspace.getConfiguration('gherkinStepNavigator');
                const enableCodeLens = newConfig.get<boolean>('enableCodeLens', true);
                
                if (enableCodeLens && !codeLensProviderDisposable) {
                    registerCodeLensProvider(context);
                    logger.info('CodeLens provider enabled');
                } else if (!enableCodeLens && codeLensProviderDisposable) {
                    unregisterCodeLensProvider();
                    logger.info('CodeLens provider disabled');
                }
            }
        })
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinStepNavigator.goToStepDefinition', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'feature') {
                const position = editor.selection.active;
                const definitions = await definitionProvider.provideDefinition(
                    editor.document,
                    position,
                    new vscode.CancellationTokenSource().token
                );
                
                if (definitions && Array.isArray(definitions) && definitions.length > 0) {
                    const location = definitions[0] as vscode.Location;
                    await vscode.window.showTextDocument(location.uri, {
                        selection: location.range
                    });
                } else if (definitions && !Array.isArray(definitions)) {
                    const location = definitions as vscode.Location;
                    await vscode.window.showTextDocument(location.uri, {
                        selection: location.range
                    });
                } else {
                    vscode.window.showWarningMessage('No step definition found for this step');
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinStepNavigator.refreshStepCache', async () => {
            await stepCache.buildCache();
            vscode.window.showInformationMessage('Step definition cache refreshed');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinStepNavigator.findAllStepUsages', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.fileName.endsWith('.py')) {
                const position = editor.selection.active;
                const line = editor.document.lineAt(position.line).text;
                
                // Check if this line contains a step decorator
                const stepMatch = line.match(/@(?:step|given|when|then|and|but)\s*\(\s*['"`](.+?)['"`]\s*\)/i);
                if (stepMatch) {
                    const pattern = stepMatch[1];
                    const usages = await findStepUsages(pattern);
                    
                    if (usages.length > 0) {
                        const quickPickItems = usages.map(usage => ({
                            label: `${vscode.workspace.asRelativePath(usage.uri)}:${usage.range.start.line + 1}`,
                            description: usage.stepText,
                            location: usage
                        }));
                        
                        const selected = await vscode.window.showQuickPick(quickPickItems, {
                            placeHolder: `Found ${usages.length} usage(s) of this step`
                        });
                        
                        if (selected) {
                            await vscode.window.showTextDocument(selected.location.uri, {
                                selection: selected.location.range
                            });
                        }
                    } else {
                        vscode.window.showInformationMessage('No usages found for this step definition');
                    }
                }
            }
        })
    );

    // Watch for file changes to update cache
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.py');
    fileWatcher.onDidChange(async (uri) => {
        if (isStepDefinitionFile(uri)) {
            await stepCache.updateFile(uri);
        }
    });
    fileWatcher.onDidCreate(async (uri) => {
        if (isStepDefinitionFile(uri)) {
            await stepCache.updateFile(uri);
        }
    });
    fileWatcher.onDidDelete((uri) => {
        stepCache.removeFile(uri);
    });
    context.subscriptions.push(fileWatcher);

    logger.info('Extension activated successfully');
}

function isStepDefinitionFile(uri: vscode.Uri): boolean {
    const config = vscode.workspace.getConfiguration('gherkinStepNavigator');
    const patterns = config.get<string[]>('stepDefinitionPaths', []);
    const relativePath = vscode.workspace.asRelativePath(uri);
    
    return patterns.some(pattern => {
        const regex = globToRegex(pattern);
        return regex.test(relativePath);
    });
}

function globToRegex(glob: string): RegExp {
    const escaped = glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
}

interface StepUsage {
    uri: vscode.Uri;
    range: vscode.Range;
    stepText: string;
}

async function findStepUsages(pattern: string): Promise<StepUsage[]> {
    const usages: StepUsage[] = [];
    const featureFiles = await vscode.workspace.findFiles('**/*.feature');
    
    for (const file of featureFiles) {
        const document = await vscode.workspace.openTextDocument(file);
        const text = document.getText();
        const lines = text.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const stepMatch = line.match(/^(Given|When|Then|And|But)\s+(.+)$/i);
            
            if (stepMatch) {
                const stepText = stepMatch[2];
                if (matchesPattern(stepText, pattern)) {
                    usages.push({
                        uri: file,
                        range: new vscode.Range(i, 0, i, lines[i].length),
                        stepText: line
                    });
                }
            }
        }
    }
    
    return usages;
}

function matchesPattern(stepText: string, pattern: string): boolean {
    // Convert Behave pattern to regex
    let regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\{[^}]+\}/g, '.+');
    
    try {
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(stepText);
    } catch {
        return false;
    }
}

function registerCodeLensProvider(context: vscode.ExtensionContext): void {
    if (codeLensProvider && !codeLensProviderDisposable) {
        codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
            { language: 'feature', scheme: 'file' },
            codeLensProvider
        );
        context.subscriptions.push(codeLensProviderDisposable);
    }
}

function unregisterCodeLensProvider(): void {
    if (codeLensProviderDisposable) {
        codeLensProviderDisposable.dispose();
        codeLensProviderDisposable = undefined;
    }
}

export function deactivate(): void {
    unregisterCodeLensProvider();
    if (logger) {
        logger.info('Extension deactivating...');
    }
}
