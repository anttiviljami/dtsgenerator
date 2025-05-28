import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import dtsgenerator from '../src/core';
import { JsonSchemaDraft07 } from '../src/core/jsonSchemaDraft07';
import { parseSchema } from '../src/core/type';
import * as utils from '../src/utils';

describe('URL $ref test', () => {
    let originalReadUrl: any;
    let mockReadUrl: any;

    beforeEach(() => {
        // Store original readUrl function
        originalReadUrl = utils.readUrl;

        // Create mock that tracks calls and returns petstore content
        const mockCalls: string[] = [];
        mockReadUrl = {
            calls: mockCalls,
        };

        // Mock implementation that returns petstore content from snapshots
        const mockReadUrlImpl = (url: string): Promise<string> => {
            mockCalls.push(url);

            if (url.includes('petstore.yaml')) {
                // Return the petstore content from snapshots
                const petstorePath = path.join(
                    __dirname,
                    'snapshots/openapi-v3/petstore/petstore-expanded.json',
                );
                return Promise.resolve(fs.readFileSync(petstorePath, 'utf-8'));
            }

            // For other URLs, throw an error as expected
            return Promise.reject(new Error(`Unmocked URL: ${url}`));
        };

        // Replace the readUrl function with our mock
        (utils as any).readUrl = mockReadUrlImpl;
    });

    afterEach(() => {
        // Restore original readUrl function
        (utils as any).readUrl = originalReadUrl;
    });

    it('should handle remote URL $ref to whole spec (no fragment)', async () => {
        // Test with a reference to an entire remote OpenAPI spec
        const schema: JsonSchemaDraft07.Schema = {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: '/test/remote_whole_spec_ref',
            type: 'object',
            properties: {
                // Reference the entire OpenAPI spec (no fragment)
                petStoreSpec: {
                    $ref: 'https://example.com/petstore.yaml',
                },
            },
        };

        const result = await dtsgenerator({ contents: [parseSchema(schema)] });
        assert.ok(
            result.length > 0,
            'Generated TypeScript should not be empty',
        );

        // Check that the whole spec is referenced
        assert.ok(
            result.includes('Pet') || result.includes('NewPet'),
            'Should include Pet types from the spec',
        );

        // When referencing whole spec, OpenAPI components should be generated
        assert.ok(
            result.includes('Components') ||
                result.includes('Schemas') ||
                result.includes('Pet'),
            'Should include types from the OpenAPI spec',
        );

        // Should include the pet store entities from the spec
        assert.ok(
            result.includes('Pet') || result.includes('NewPet'),
            'Should include Pet definition from the spec',
        );

        // Should include paths or operations from the OpenAPI spec
        assert.ok(
            result.includes('Paths') ||
                result.includes('Operations') ||
                result.includes('Pet'),
            'Should include API types from OpenAPI spec',
        );

        // Verify the mock was called with the correct URL
        assert.ok(
            mockReadUrl.calls.some((call: string) =>
                call.includes('https://example.com/petstore.yaml'),
            ),
            'Should have fetched the petstore schema',
        );
    });

    it('should handle remote URL $ref with fragment', async () => {
        // Test with a real OpenAPI schema that has components
        const schema: JsonSchemaDraft07.Schema = {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: '/test/remote_fragment_ref',
            type: 'object',
            properties: {
                // Reference a specific component within a remote schema
                petStorePet: {
                    $ref: 'https://example.com/petstore.yaml#/components/schemas/Pet',
                },
                // Another reference to test multiple remote refs (using actual schemas from petstore)
                petStoreNewPet: {
                    $ref: 'https://example.com/petstore.yaml#/components/schemas/NewPet',
                },
                // Reference to Error schema
                petStoreError: {
                    $ref: 'https://example.com/petstore.yaml#/components/schemas/Error',
                },
            },
        };

        const result = await dtsgenerator({ contents: [parseSchema(schema)] });
        assert.ok(
            result.length > 0,
            'Generated TypeScript should not be empty',
        );

        // Check that the remote schema types are included
        assert.ok(
            result.includes('Pet') && result.includes('NewPet'),
            'Should include Pet type from remote schema',
        );

        // The Pet/NewPet schema should have name property (from the actual petstore schema)
        assert.ok(
            result.includes('name'),
            'Pet type should have name property',
        );

        // Should have id property (Pet has id, NewPet doesn't but Error has code)
        assert.ok(
            result.includes('id') || result.includes('code'),
            'Should have id or code property from the schemas',
        );

        // Verify the mock was called with the correct URL (without fragment)
        assert.ok(
            mockReadUrl.calls.some((call: string) =>
                call.includes('https://example.com/petstore.yaml'),
            ),
            'Should have fetched the petstore schema',
        );
    });
});
