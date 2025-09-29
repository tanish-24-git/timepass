const express = require('express');
const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const decomposePrompt = require('../utils/decomposePrompt');
const fetchRepoContents = require('../utils/fetchRepo');
const winston = require('winston');

const router = express.Router();
const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Logger setup
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

async function callAI(aiType, message) {
  let url, config, dataKey;
  if (aiType === 'groq') {
    if (!GROQ_KEY) throw new Error('GROQ_API_KEY is missing in .env');
    url = 'https://api.groq.com/openai/v1/chat/completions';
    config = {
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      data: { model: 'llama3-groq-70b-versatile', messages: [{ role: 'user', content: message }] }
    };
    dataKey = data => data.choices[0].message.content;
  } else if (aiType === 'gemini') {
    if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY is missing in .env');
    url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
    config = {
      headers: { 'Content-Type': 'application/json' },
      data: { contents: [{ parts: [{ text: message }] }] }
    };
    dataKey = data => data.candidates[0].content.parts[0].text;
  } else {
    throw new Error('Invalid AI type');
  }

  try {
    logger.debug(`Calling ${aiType} API with message: ${message.substring(0, 100)}...`);
    const res = await axios.post(url, config.data, { headers: config.headers });
    return dataKey(res.data);
  } catch (err) {
    if (err.response && err.response.status === 429) {
      logger.warn('Rate limit hit, retrying after 1s');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const res = await axios.post(url, config.data, { headers: config.headers });
      return dataKey(res.data);
    }
    const errorMsg = err.response 
      ? `${err.response.status}: ${err.response.data?.error?.message || err.response.data?.message || err.message} (URL: ${url})`
      : err.message;
    logger.error(`API call failed: ${errorMsg}`);
    throw new Error(`API call failed: ${errorMsg}`);
  }
}

router.post('/enhance-prompt', async (req, res, next) => {
  const { aiType, prompt, level } = req.body;
  logger.debug(`Received /enhance-prompt request: ${JSON.stringify(req.body)}`);
  if (!aiType || !prompt || !level) {
    logger.error('Missing required fields in /enhance-prompt');
    return res.status(400).json({ error: 'Missing required fields: aiType, prompt, and level are required' });
  }
  if (!['groq', 'gemini'].includes(aiType)) {
    logger.error(`Invalid aiType: ${aiType}`);
    return res.status(400).json({ error: 'Invalid aiType: must be "groq" or "gemini"' });
  }
  if (!['basic', 'advanced', 'production'].includes(level)) {
    logger.error(`Invalid level: ${level}`);
    return res.status(400).json({ error: 'Invalid level: must be "basic", "advanced", or "production"' });
  }
  try {
    const decompositions = decomposePrompt(prompt, level);
    const enhanced = await Promise.all(decompositions.map(dec => callAI(aiType, `Enhance this decomposed prompt for code generation at ${level} level: ${dec}`)));
    res.json({ enhanced });
  } catch (err) {
    next(err);
  }
});

router.post('/generate-code', async (req, res, next) => {
  const { aiType, prompt, level } = req.body;
  logger.debug(`Received /generate-code request: ${JSON.stringify(req.body)}`);
  if (!aiType || !prompt || !level) {
    logger.error('Missing required fields in /generate-code');
    return res.status(400).json({ error: 'Missing required fields: aiType, prompt, and level are required' });
  }
  if (!['groq', 'gemini'].includes(aiType)) {
    logger.error(`Invalid aiType: ${aiType}`);
    return res.status(400).json({ error: 'Invalid aiType: must be "groq" or "gemini"' });
  }
  if (!['basic', 'advanced', 'production'].includes(level)) {
    logger.error(`Invalid level: ${level}`);
    return res.status(400).json({ error: 'Invalid level: must be "basic", "advanced", or "production"' });
  }
  try {
    const message = `Generate production-ready code based on this prompt: ${prompt}. Apply best practices at ${level} level: clean code, error handling, security.`;
    const code = await callAI(aiType, message);
    res.json({ code });
  } catch (err) {
    next(err);
  }
});

router.post('/ingest-repo', async (req, res, next) => {
  const { repoUrl } = req.body;
  logger.debug(`Received /ingest-repo request: ${JSON.stringify(req.body)}`);
  if (!repoUrl) {
    logger.error('Missing repoUrl in /ingest-repo');
    return res.status(400).json({ error: 'Missing repoUrl' });
  }
  try {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
    if (!match) {
      logger.error(`Invalid GitHub URL: ${repoUrl}`);
      throw new Error('Invalid GitHub URL. Use format: https://github.com/owner/repo');
    }
    const [_, owner, repo] = match;
    logger.debug(`Using GITHUB_TOKEN: ${GITHUB_TOKEN ? 'present' : 'not present'}`);
    const octokit = new Octokit(GITHUB_TOKEN ? { auth: GITHUB_TOKEN } : undefined);
    try {
      const codeBase = await fetchRepoContents(octokit, owner, repo);
      res.json({ codeBase });
    } catch (err) {
      if (err.status === 403 && err.message.includes('rate limit')) {
        logger.warn('GitHub rate limit exceeded, retrying after 1s');
        await new Promise(resolve => setTimeout(resolve, 1000));
        const codeBase = await fetchRepoContents(octokit, owner, repo);
        res.json({ codeBase });
      } else {
        throw err;
      }
    }
  } catch (err) {
    logger.error(`Ingest repo failed: ${err.message}`);
    next(err);
  }
});

router.post('/enhance-code', async (req, res, next) => {
  const { aiType, codeBase, level } = req.body;
  logger.debug(`Received /enhance-code request: ${JSON.stringify(req.body)}`);
  if (!aiType || !codeBase || !level) {
    logger.error('Missing required fields in /enhance-code');
    return res.status(400).json({ error: 'Missing required fields: aiType, codeBase, and level are required' });
  }
  if (!['groq', 'gemini'].includes(aiType)) {
    logger.error(`Invalid aiType: ${aiType}`);
    return res.status(400).json({ error: 'Invalid aiType: must be "groq" or "gemini"' });
  }
  if (!['basic', 'advanced', 'production'].includes(level)) {
    logger.error(`Invalid level: ${level}`);
    return res.status(400).json({ error: 'Invalid level: must be "basic", "advanced", or "production"' });
  }
  try {
    const truncatedCodeBase = codeBase.slice(0, 8000);
    const message = `Take this code base: ${truncatedCodeBase}. Make it production-ready at ${level} level: apply best practices like error handling, optimization, security fixes.`;
    const enhancedCode = await callAI(aiType, message);
    res.json({ enhancedCode });
  } catch (err) {
    next(err);
  }
});

module.exports = router;