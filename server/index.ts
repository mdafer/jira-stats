import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import { initDatabase } from './models/database.js';
import tasksRouter from './routes/tasks.js';

const app = express();
const PORT = Number(process.env.SERVER_PORT) || 3001;

app.use(cors());
app.use(express.json());

// Initialize SQLite database
initDatabase();

// Routes
app.use('/api', tasksRouter);

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
