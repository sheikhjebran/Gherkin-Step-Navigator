/**
 * Step Parser Unit Tests
 */

import * as assert from 'assert';
import { patternToRegex, extractParameters } from '../../parser/stepParser';
import { parseGherkinLine } from '../../utils/gherkinParser';

suite('Step Parser Test Suite', () => {

    suite('patternToRegex', () => {
        test('should match simple pattern', () => {
            const regex = patternToRegex('I click the button');
            assert.ok(regex.test('I click the button'));
            assert.ok(!regex.test('I click another button'));
        });

        test('should match pattern with string parameter', () => {
            const regex = patternToRegex('the user "{username}" logs in');
            assert.ok(regex.test('the user "john" logs in'));
            // Pattern with double quotes should match double-quoted values
            assert.ok(!regex.test("the user 'admin' logs in"), 'double-quoted pattern should not match single quotes');
        });

        test('should match quoted parameter at end of pattern', () => {
            const regex = patternToRegex('I receive the following keys with "{value_type}" values');
            assert.ok(regex.test('I receive the following keys with "non-null" values'));
            assert.ok(regex.test('I receive the following keys with "null" values'));
            assert.ok(regex.test('I receive the following keys with "empty" values'));
        });

        test('should match single-quoted parameter', () => {
            const regex = patternToRegex("the status is '{status}'");
            assert.ok(regex.test("the status is 'active'"));
            assert.ok(regex.test("the status is 'pending'"));
        });

        test('should match unquoted parameter with various formats', () => {
            const regex = patternToRegex('I enter {value}');
            // Unquoted placeholders should match quoted strings or non-whitespace
            assert.ok(regex.test('I enter "hello"'));
            assert.ok(regex.test("I enter 'world'"));
            assert.ok(regex.test('I enter 123'));
        });

        test('should match pattern with integer parameter', () => {
            const regex = patternToRegex('I wait for {seconds:d} seconds');
            assert.ok(regex.test('I wait for 10 seconds'));
            assert.ok(regex.test('I wait for 0 seconds'));
            assert.ok(!regex.test('I wait for abc seconds'));
        });

        test('should match pattern with word parameter', () => {
            const regex = patternToRegex('I select the {option:w} option');
            assert.ok(regex.test('I select the first option'));
            assert.ok(regex.test('I select the second option'));
        });

        test('should match case insensitively', () => {
            const regex = patternToRegex('I click the button');
            assert.ok(regex.test('I CLICK THE BUTTON'));
            assert.ok(regex.test('i click the button'));
        });
    });

    suite('extractParameters', () => {
        test('should extract simple parameters', () => {
            const params = extractParameters('the user "{username}" logs in');
            assert.deepStrictEqual(params, ['username']);
        });

        test('should extract typed parameters', () => {
            const params = extractParameters('I wait for {seconds:d} seconds');
            assert.deepStrictEqual(params, ['seconds']);
        });

        test('should extract multiple parameters', () => {
            const params = extractParameters('user "{name}" with role "{role}" is created');
            assert.deepStrictEqual(params, ['name', 'role']);
        });

        test('should return empty array for no parameters', () => {
            const params = extractParameters('I click the button');
            assert.deepStrictEqual(params, []);
        });
    });

    suite('parseGherkinLine', () => {
        test('should parse Given step', () => {
            const result = parseGherkinLine('    Given I am on the home page');
            assert.ok(result);
            assert.strictEqual(result.keyword, 'Given');
            assert.strictEqual(result.stepText, 'I am on the home page');
        });

        test('should parse When step', () => {
            const result = parseGherkinLine('    When I click the button');
            assert.ok(result);
            assert.strictEqual(result.keyword, 'When');
            assert.strictEqual(result.stepText, 'I click the button');
        });

        test('should parse Then step', () => {
            const result = parseGherkinLine('    Then I should see the result');
            assert.ok(result);
            assert.strictEqual(result.keyword, 'Then');
            assert.strictEqual(result.stepText, 'I should see the result');
        });

        test('should parse And step', () => {
            const result = parseGherkinLine('    And I fill in the form');
            assert.ok(result);
            assert.strictEqual(result.keyword, 'And');
            assert.strictEqual(result.stepText, 'I fill in the form');
        });

        test('should parse But step', () => {
            const result = parseGherkinLine('    But I should not see error');
            assert.ok(result);
            assert.strictEqual(result.keyword, 'But');
            assert.strictEqual(result.stepText, 'I should not see error');
        });

        test('should return null for non-step lines', () => {
            assert.strictEqual(parseGherkinLine('Feature: My Feature'), null);
            assert.strictEqual(parseGherkinLine('Scenario: My Scenario'), null);
            assert.strictEqual(parseGherkinLine('# This is a comment'), null);
            assert.strictEqual(parseGherkinLine('@tag'), null);
            assert.strictEqual(parseGherkinLine(''), null);
        });

        test('should handle various indentation levels', () => {
            const result1 = parseGherkinLine('Given step');
            const result2 = parseGherkinLine('  Given step');
            const result3 = parseGherkinLine('    Given step');
            
            assert.ok(result1);
            assert.ok(result2);
            assert.ok(result3);
            assert.strictEqual(result1.stepText, 'step');
            assert.strictEqual(result2.stepText, 'step');
            assert.strictEqual(result3.stepText, 'step');
        });

        test('should handle asterisk as step keyword', () => {
            const result = parseGherkinLine('    * I perform an action');
            assert.ok(result);
            assert.strictEqual(result.keyword, '*');
            assert.strictEqual(result.stepText, 'I perform an action');
        });
    });
});
