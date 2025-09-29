const express = require('express');
const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const decomposePrompt = require('../utils/decomposePrompt');
const fetchRepoContents = require('../utils/fetchRepo');

const router = express.Router();
const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function callAI(aiType, message) {
  let url, config, dataKey;
  if (aiType === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    config = {
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      data: { model: 'llama3-8b-8192', messages: [{ role: 'user', content: message }] }
    };
    dataKey = data => data.choices[0].message.content;
  } else if (aiType === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`;
    config = {
      headers: { 'Content-Type': 'application/json' },
      data: { contents: [{ parts: [{ text: message }] }] }
    };
    dataKey = data => data.candidates[0].content.parts[0].text;
  } else {
    throw new Error('Invalid AI type');
  }

  try {
    const res = await axios.post(url, config.data, { headers: config.headers });
    return dataKey(res.data);
  } catch (err) {
    if (err.response && err.response.status === 429) {
      // Retry on rate limit (simple backoff)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const res = await axios.post(url, config.data, { headers: config.headers });
      return dataKey(res.data);
    }
    throw err;
  }
}

router.post('/enhance-prompt', async (req, res, next) => {
  const { aiType, prompt, level } = req.body;
  if (!aiType || !prompt || !level) return res.status(400).json({ error: 'Missing required fields' });
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
  if (!aiType || !prompt || !level) return res.status(400).json({ error: 'Missing required fields' });
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
  if (!repoUrl) return res.status(400).json({ error: 'Missing repoUrl' });
  try {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error('Invalid URL');
    const [_, owner, repo] = match;
    const octokit = new Octokit(GITHUB_TOKEN ? { auth: GITHUB_TOKEN } : undefined);
    const codeBase = await fetchRepoContents(octokit, owner, repo);
    res.json({ codeBase });
  } catch (err) {
    next(err);
  }
});

router.post('/enhance-code', async (req, res, next) => {
  const { aiType, codeBase, level } = req.body;
  if (!aiType || !codeBase || !level) return res.status(400).json({ error: 'Missing required fields' });
  try {
    // Better truncation: Limit to ~8000 tokens, but split if needed
    const truncatedCodeBase = codeBase.slice(0, 8000);
    const message = `Take this code base: ${truncatedCodeBase}. Make it production-ready at ${level} level: apply best practices like error handling, optimization, security fixes.`;
    const enhancedCode = await callAI(aiType, message);
    res.json({ enhancedCode });
  } catch (err) {
    next(err);
  }
});

module.exports = router;