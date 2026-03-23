/**
 * Vercel Serverless Function entry point.
 * Wraps the Express app for the serverless environment.
 */
import 'dotenv/config';
import { app } from '../src/app.js';

export default app;
