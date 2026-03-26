/**
 * Extension Tests
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('jebran.gherkin-step-navigator'));
    });

    test('Extension should activate on feature file', async () => {
        const ext = vscode.extensions.getExtension('jebran.gherkin-step-navigator');
        if (ext) {
            await ext.activate();
            assert.ok(ext.isActive);
        }
    });
});
