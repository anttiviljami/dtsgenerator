import assert from 'assert';
import dtsgenerator from '../src/core';
import { clearToDefault } from '../src/core/config';
import { OpenApisV3 } from '../src/core/openApiV3';
import { parseSchema, JsonSchema } from '../src/core/type';

describe('additionalProperties', () => {
    afterEach(() => {
        clearToDefault();
    });

    it('in a oneOf false on object with no properties', async () => {
        const schema: OpenApisV3.SchemaJson = {
            openapi: '3.0.3',
            info: {
                title: 'Test',
                version: '0.4.0',
            },
            paths: {},
            components: {
                schemas: {
                    EmptyObject: {
                        oneOf: [
                            {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    foo: {
                                        type: 'string',
                                    },
                                },
                            },
                            {
                                type: 'object',
                                additionalProperties: false,
                            },
                        ],
                    },
                },
            },
        };

        const result = await dtsgenerator({
            contents: [parseSchema(schema as JsonSchema)],
        });
        const expected = `declare namespace Components {
    namespace Schemas {
        export type EmptyObject = {
            foo?: string;
        } | {
            [key: string]: never;
        };
    }
}
`;
        assert.strictEqual(result, expected, result);
    });
});
