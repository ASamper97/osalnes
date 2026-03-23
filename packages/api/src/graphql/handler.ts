import { createHandler } from 'graphql-http/lib/use/express';
import { schema } from './schema.js';

export const graphqlHandler = createHandler({ schema });
