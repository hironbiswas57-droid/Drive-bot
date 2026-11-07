import { DRIVE_TOOLS_DECLARATIONS, executeTool } from './tools.js';

const SYSTEM_INSTRUCTION = `You are a helpful, proactive Level 1 Agentic AI Assistant specialized in Google Drive navigation, document exploration, and content extraction.

Your capabilities:
1. Search across Google Drive for files and folders by name, keywords, or full-text content.
2. Navigate directory trees and explore contents of subfolders or root ("My Drive").
3. Inspect starred/favorite files to help users access their priority items quickly.
4. Extract textual content from Google Docs, Google Sheets, text files, and markdown files to answer questions directly based on actual document content.
5. Provide breadcrumb paths (e.g., My Drive / Projects / AI-Assistant-Roadmap) so users always understand where their documents reside.

Behavioral Guidelines:
- Autonomously decide which tools to call. You can chain multiple tool calls (e.g., search for a folder, list its contents, then extract content from a specific file inside it).
- When a user asks about information likely contained in a file, do NOT speculate: locate the file, read its content using 'extract_file_content', and extract the relevant answer.
- Always mention the file name and its folder location when citing extracted data.
- If multiple files match a query, list the candidates clearly with their IDs/paths and ask the user if they'd like to inspect one specifically.
- Keep responses clean, concise, and formatted in clear markdown.`;

export class DriveAgent {
  constructor({ apiKey, model = 'gemini-2.5-flash', driveService, onActivity = null }) {
    this.apiKey = apiKey;
    this.model = model;
    this.driveService = driveService;
    this.onActivity = onActivity || (() => {});
    this.history = [];
    this.sessionContext = {
      currentFolderId: 'root',
      currentFolderName: 'My Drive',
    };
  }

  /**
   * Reset conversation memory.
   */
  resetHistory() {
    this.history = [];
    this.sessionContext.currentFolderId = 'root';
    this.sessionContext.currentFolderName = 'My Drive';
  }

  /**
   * Main conversational entry point. Runs the agentic loop.
   */
  async chat(userMessage) {
    // Append user message to history
    this.history.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    const maxSteps = 8;
    let stepCount = 0;

    while (stepCount < maxSteps) {
      stepCount++;

      // Call Gemini API with tools and history
      const responseData = await this._callGeminiAPI();

      const candidate = responseData?.candidates?.[0];
      if (!candidate || !candidate.content) {
        throw new Error('No candidate content received from Gemini model.');
      }

      const parts = candidate.content.parts || [];
      const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall);

      // If the model did not call any tools, it's the final answer
      if (functionCalls.length === 0) {
        // Record model turn in history
        this.history.push(candidate.content);
        const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');
        return textParts;
      }

      // Record the model's function calls in history
      this.history.push({
        role: 'model',
        parts: functionCalls.map(fc => ({ functionCall: fc })),
      });

      // Execute each function call and gather responses
      const functionResponses = [];
      for (const call of functionCalls) {
        this.onActivity({
          type: 'tool_call',
          name: call.name,
          args: call.args,
        });

        const result = await executeTool(call.name, call.args, this.driveService, this.sessionContext);

        this.onActivity({
          type: 'tool_result',
          name: call.name,
          result,
        });

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: result,
          },
        });
      }

      // Append function results back into history as 'user' / 'function' turn
      this.history.push({
        role: 'user',
        parts: functionResponses,
      });
    }

    return 'Agent reached maximum step limit while navigating Google Drive. Please refine your query.';
  }

  /**
   * Calls the Gemini REST API directly using Node's native fetch.
   */
  async _callGeminiAPI() {
    if (!this.apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured. Please add it to your .env file.'
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const payload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: this.history,
      tools: [
        {
          functionDeclarations: DRIVE_TOOLS_DECLARATIONS,
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API Error [${res.status}]: ${errText}`);
    }

    return await res.json();
  }
}
