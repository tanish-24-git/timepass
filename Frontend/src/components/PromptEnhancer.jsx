import React, { useState } from 'react';
import axios from 'axios';

const PromptEnhancer = () => {
  const [prompt, setPrompt] = useState('');
  const [aiType, setAiType] = useState('groq');
  const [level, setLevel] = useState('basic');
  const [repoUrl, setRepoUrl] = useState('');
  const [codeBase, setCodeBase] = useState('');
  const [output, setOutput] = useState('');

  const apiBaseUrl = 'http://localhost:5000/api'; // Update to production URL later

  const makeApiCall = async (endpoint, data) => {
    try {
      const response = await axios.post(`${apiBaseUrl}${endpoint}`, data);
      return response.data;
    } catch (error) {
      setOutput(`Error: ${error.response?.data?.error || error.message}`);
      throw error;
    }
  };

  const enhancePrompt = async () => {
    if (!prompt || !aiType || !level) {
      setOutput('Please fill all fields');
      return;
    }
    const result = await makeApiCall('/enhance-prompt', { aiType, prompt, level });
    setOutput(JSON.stringify(result.enhanced, null, 2));
  };

  const generateCode = async () => {
    if (!prompt || !aiType || !level) {
      setOutput('Please fill all fields');
      return;
    }
    const result = await makeApiCall('/generate-code', { aiType, prompt, level });
    setOutput(result.code);
  };

  const ingestRepo = async () => {
    if (!repoUrl) {
      setOutput('Please enter a repo URL');
      return;
    }
    const result = await makeApiCall('/ingest-repo', { repoUrl });
    setOutput(result.codeBase);
  };

  const enhanceCode = async () => {
    if (!codeBase || !aiType || !level) {
      setOutput('Please fill all fields');
      return;
    }
    const result = await makeApiCall('/enhance-code', { aiType, codeBase, level });
    setOutput(result.enhancedCode);
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
        placeholder="GitHub Repo URL"
      />
      <button onClick={ingestRepo}>Ingest Repo</button>
      <textarea
        value={codeBase}
        onChange={(e) => setCodeBase(e.target.value)}
        placeholder="Code to enhance"
      />
      <button onClick={enhanceCode}>Enhance Code</button>
      <pre>{output}</pre>
    </div>
  );
};

export default PromptEnhancer;