const express = require('express');
const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const decomposePrompt = require('../utils/decomposePrompt');
const fetchRepoContents = require('../utils/fetchRepo');

const router = express.Router();
const GROK_KEY = process.env.GROK_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

async function callAI(aiType, message) {
  let url, config, dataKey;
  if (aiType === 'grok') {
    url = 'https://api.x.ai/v1/chat/completions';
    config = {
      headers: { Authorization: `Bearer ${GROK_KEY}`, 'Content-Type': 'application/json' },
      data: { model: 'grok-4', messages: [{ role: 'user', content: message }] }
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

  const res = await axios.post(url, config.data, { headers: config.headers });
  return dataKey(res.data);
}

router.post('/enhance-prompt', async (req, res) => {
  const { aiType, prompt, level } = req.body;
  try {
    const decompositions = decomposePrompt(prompt, level);
    const enhanced = await Promise.all(decompositions.map(dec => callAI(aiType, `Enhance this decomposed prompt for code generation at ${level} level: ${dec}`)));
    res.json({ enhanced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate-code', async (req, res) => {
  const { aiType, prompt, level } = req.body;
  try {
    const message = `Generate production-ready code based on this prompt: ${prompt}. Apply best practices at ${level} level: clean code, error handling, security.`;
    const code = await callAI(aiType, message);
    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ingest-repo', async (req, res) => {
  const { repoUrl } = req.body;
  try {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error('Invalid URL');
    const [_, owner, repo] = match;
    const octokit = new Octokit(); // Add auth if needed: { auth: process.env.GITHUB_TOKEN }
    const codeBase = await fetchRepoContents(octokit, owner, repo);
    res.json({ codeBase });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/enhance-code', async (req, res) => {
  const { aiType, codeBase, level } = req.body;
  try {
    const message = `Take this code base: ${codeBase.slice(0, 8000)}. Make it production-ready at ${level} level: apply best practices like error handling, optimization, security fixes.`; // Truncate if too long
    const enhancedCode = await callAI(aiType, message);
    res.json({ enhancedCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;