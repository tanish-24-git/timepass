import React, { useState } from 'react';
import axios from 'axios';

const PromptEnhancer = () => {
  const [prompt, setPrompt] = useState('');
  const [aiType, setAiType] = useState('groq');
  const [level, setLevel] = useState('basic');
  const [repoUrl, setRepoUrl] = useState('');
  const [codeBase, setCodeBase] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const apiBaseUrl = 'http://localhost:5000/api'; // Update to production URL later

  const makeApiCall = async (endpoint, data) => {
    console.log(`Sending request to ${endpoint}:`, data); // Debug log
    try {
      const response = await axios.post(`${apiBaseUrl}${endpoint}`, data);
      setError('');
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      setError(`Error: ${errorMsg}`);
      setOutput('');
      throw error;
    }
  };

  const copyToClipboard = async () => {
    if (!output) {
      setError('No output to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      setError('Output copied to clipboard!');
      setTimeout(() => setError(''), 2000); // Clear message after 2s
    } catch (err) {
      setError('Failed to copy: ' + err.message);
    }
  };

  const enhancePrompt = async () => {
    if (!prompt || !aiType || !level) {
      setError('Please fill all fields: prompt, AI type, and level');
      setOutput('');
      return;
    }
    try {
      const result = await makeApiCall('/enhance-prompt', { aiType, prompt, level });
      setOutput(JSON.stringify(result.enhanced, null, 2));
    } catch (err) {
      // Error is set in makeApiCall
    }
  };

  const generateCode = async () => {
    if (!prompt || !aiType || !level) {
      setError('Please fill all fields: prompt, AI type, and level');
      setOutput('');
      return;
    }
    try {
      const result = await makeApiCall('/generate-code', { aiType, prompt, level });
      setOutput(result.code);
    } catch (err) {
      // Error is set in makeApiCall
    }
  };

  const ingestRepo = async () => {
    if (!repoUrl) {
      setError('Please enter a GitHub repo URL');
      setOutput('');
      return;
    }
    if (!repoUrl.match(/^https?:\/\/github\.com\/[^\/]+\/[^\/]+$/)) {
      setError('Invalid GitHub URL. Use format: https://github.com/owner/repo');
      setOutput('');
      return;
    }
    try {
      const result = await makeApiCall('/ingest-repo', { repoUrl });
      setOutput(result.codeBase);
    } catch (err) {
      // Error is set in makeApiCall
    }
  };

  const enhanceCode = async () => {
    if (!codeBase || !aiType || !level) {
      setError('Please fill all fields: code base, AI type, and level');
      setOutput('');
      return;
    }
    try {
      const result = await makeApiCall('/enhance-code', { aiType, codeBase, level });
      setOutput(result.enhancedCode);
    } catch (err) {
      // Error is set in makeApiCall
    }
  };

  return (
    <div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your prompt"
      />
      <select value={aiType} onChange={(e) => setAiType(e.target.value)}>
        <option value="groq">Groq</option>
        <option value="gemini">Gemini</option>
      </select>
      <select value={level} onChange={(e) => setLevel(e.target.value)}>
        <option value="basic">Basic</option>
        <option value="advanced">Advanced</option>
        <option value="production">Production</option>
      </select>
      <button onClick={enhancePrompt}>Enhance Prompt</button>
      <button onClick={generateCode}>Generate Code</button>
      <input
        type="text"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
        placeholder="GitHub Repo URL (e.g., https://github.com/owner/repo)"
      />
      <button onClick={ingestRepo}>Ingest Repo</button>
      <textarea
        value={codeBase}
        onChange={(e) => setCodeBase(e.target.value)}
        placeholder="Code to enhance"
      />
      <button onClick={enhanceCode}>Enhance Code</button>
      <button onClick={copyToClipboard}>Copy Output</button>
      {error && <div style={{ color: error.startsWith('Output copied') ? 'green' : 'red' }}>{error}</div>}
      <pre>{output}</pre>
    </div>
  );
};

export default PromptEnhancer;