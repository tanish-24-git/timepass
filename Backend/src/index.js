const express = require('express');
const dotenv = require('dotenv');
const winston = require('winston');
const aiRoutes = require('./routes/aiRoutes');

dotenv.config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const app = express();
app.use(express.json());

// Log environment variables for debugging (mask sensitive parts)
logger.debug(`Environment variables: PORT=${process.env.PORT}, GROQ_API_KEY=${process.env.GROQ_API_KEY ? 'present' : 'missing'}, GEMINI_API_KEY=${process.env.GEMINI_API_KEY ? 'present' : 'missing'}, GITHUB_TOKEN=${process.env.GITHUB_TOKEN ? 'present' : 'missing'}`);

app.use('/api', aiRoutes);

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server running in development mode on port ${PORT}`);
});