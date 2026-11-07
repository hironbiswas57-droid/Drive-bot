# Google Drive Level 1 Agentic AI Chatbot (JavaScript)

An autonomous **Level 1 Agentic AI Chatbot** built in JavaScript (Node.js) that interacts directly with Google Drive. It allows users to converse naturally to search for files, traverse directory trees and subfolders, inspect starred documents, and extract text/data directly from files (Google Docs, Google Sheets, CSV, text) to answer complex questions without manual downloading.

---

## 🧠 What Makes It "Level 1 Agentic"?

In agentic AI design, **Level 1 Autonomy** represents a **Tool-Using / ReAct (Reason + Act)** system:
- Rather than relying on rigid keyword commands or single-step prompt replies, the agent possesses autonomous tool selection and execution loops.
- When given a prompt like *"Find the Q3 budget spreadsheet in my finance folder and tell me what was spent on LLM tokens"*, the agent:
  1. **Reasons** about the user intent.
  2. **Executes `search_files`** or `list_folder_contents` to discover the target directory and file.
  3. **Executes `extract_file_content`** on the spreadsheet or document.
  4. **Synthesizes** the raw data into an accurate conversational answer.

```
                   ┌───────────────────────────────────┐
                   │            User Input             │
                   └─────────────────┬─────────────────┘
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │    Gemini LLM (Reasoning Loop)    │◄──────┐
                   └─────────────────┬─────────────────┘       │
                                     │ Tool Call               │ Function
                                     ▼                         │ Response
                   ┌───────────────────────────────────┐       │
                   │      Tool Execution Dispatcher    │       │
                   └─────────────────┬─────────────────┘       │
                                     │                         │
            ┌────────────────────────┼────────────────────────┐│
            ▼                        ▼                        ▼│
   ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
   │  search_files   │      │   list_folder   │      │  extract_text   │
   │  (Search/Scope) │      │  (Hierarchical) │      │ (Docs/Sheets/..)│
   └────────┬────────┘      └────────┬────────┘      └────────┬────────┘
            │                        │                        │
            └────────────────────────┼────────────────────────┘
                                     ▼
                       ┌───────────────────────────┐
                       │ Google Drive API / Mock   │
                       └───────────────────────────┘
```

---

## 🚀 Key Features

- 🔍 **Flexible Search**: Matches file names, folder names, or full-text keywords across your entire Google Drive.
- 📁 **Hierarchical Traversal**: Explores parent folders, child subfolders, and computes breadcrumb paths (`My Drive / Projects / AI-Roadmap`).
- ⭐ **Starred & Priority Tracking**: Instantly retrieves and filters for starred items.
- 📄 **Extractive Data Processing**:
  - Automatically exports **Google Docs** to plain text.
  - Automatically exports **Google Sheets** to CSV for numerical/tabular question answering.
  - Reads raw text files, JSON, markdown, and code snippets.
- 💬 **Multi-Turn Contextual Dialog**: Remembers prior context, resolves ambiguous file names, and accepts follow-up questions.
- 🧪 **Built-in Mock Drive Mode**: Test the agentic interaction immediately even before setting up Google Cloud credentials.

---

## 📂 Project Structure

```
├── .env.example              # Configuration template (Gemini API & Google OAuth2)
├── package.json              # ES Modules dependencies and scripts
├── README.md                 # Documentation and architecture guide
└── src/
    ├── config.js             # Environment variable loader
    ├── auth.js               # OAuth 2.0 flow & token storage
    ├── driveService.js       # Real Google Drive API v3 operations
    ├── tools.js              # Tool definitions & dispatch logic
    ├── agent.js              # Level 1 ReAct agent loop
    ├── cli.js                # Interactive terminal chat UI
    └── scripts/
        ├── mockDrive.js      # In-memory Drive simulator for zero-setup testing
        └── testAuth.js       # Standalone Google Drive API connection verifier
```

---

## 🛠️ Getting Started

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 2. Installation
Clone or navigate to the project directory:
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and fill in:
```ini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

#### Option A: Quick Test with Mock Drive (Zero Setup)
Leave `USE_MOCK_DRIVE=true` in `.env` to try out simulated folders (`Projects`, `Finance`, `AI-Assistant-Roadmap`, starred docs, and budget sheets).

#### Option B: Connecting Live Google Drive
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and enable the **Google Drive API**.
3. Configure the **OAuth Consent Screen** (User Type: External / Testing; add your email as a test user).
4. Go to **Credentials** -> **Create Credentials** -> **OAuth Client ID**.
   - Application type: **Desktop App**.
5. Copy the **Client ID** and **Client Secret** into your `.env`:
   ```ini
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=yyyy
   ```

---

## 🖥️ Running the Chatbot

You can run the bot either as a **Web Interface (Browser UI)** or in the **Terminal (CLI)**:

### 1. Web Interface (Recommended)
Launch the local web server:
```bash
npm run web
```
Then open your browser at **`http://localhost:3000`**.

Features in the Web UI:
- **Interactive Chat**: Natural conversation with rendered markdown tables, bold highlights, and bullet points.
- **Visual Tool-Calling Badges**: See every step the agent takes in real-time (e.g. `⚡ search_files`, `⚡ extract_file_content`). Click any badge to inspect the raw tool parameters and output!
- **Starred Priorities Sidebar**: One-click shortcuts to ask questions about your starred documents.
- **Active Location Breadcrumb**: Always shows your current folder in Google Drive.
- **Quick Action Prompts**: Sample questions to explore drive navigation immediately.

---

### 2. Terminal CLI Interface
Launch the interactive command-line session:
```bash
npm start
```

### Testing Google Drive Connection Standalone:
```bash
npm run test:auth
```

---

## 💬 Example Interactions

### Example 1: Discovering Starred Documents & Summarizing Content
```
DriveAgent > What starred files do I have, and what does the meeting notes doc say?

  ↳ [Agent Tool] ⚡ get_starred_files({})
    [Tool Status: done (found 3)]
  ↳ [Agent Tool] ⚡ extract_file_content({"fileId":"doc-meeting-notes"})
    [Tool Status: done]

Agent Response:
You have 3 starred items:
1. Product Architecture & Roadmap 2026.gdoc
2. AI-Assistant-Roadmap (Folder)
3. Weekly Sync Notes - Nov 2026.gdoc

According to your Weekly Sync Notes (from Nov 6, 2026), the main takeaways are:
- Evaluating Level 1 Agent multi-turn subfolder traversal and file extraction.
- Confirmed read-only metadata and full-text extraction support for Google Drive.
- Decided that starred files should be highlighted on assistant startup as a priority dashboard.
```

### Example 2: Subfolder Navigation & Data Extraction
```
DriveAgent > Go to the Finance folder, open the budget sheet, and tell me how much is remaining for Cloud Infrastructure.

  ↳ [Agent Tool] ⚡ search_files({"query":"Finance","mimeType":"application/vnd.google-apps.folder"})
    [Tool Status: done (found 1)]
  ↳ [Agent Tool] ⚡ list_folder_contents({"folderId":"folder-finance"})
    [Tool Status: done (found 1)]
  ↳ [Agent Tool] ⚡ extract_file_content({"fileId":"sheet-q3-budget"})
    [Tool Status: done]

Agent Response:
I navigated into the "Finance & Invoices" folder and reviewed the "Q3 Financial Budget.gsheet".

Here are the details for Cloud Infrastructure:
- Allocated: $15,000
- Spent: $11,200
- Remaining: $3,800
```

---

## ⚙️ Quick Terminal Commands

| Command | Action |
|---|---|
| `/starred` | Show all starred files immediately |
| `/ls` | List items inside the active working folder |
| `/clear` | Clear agent conversational memory |
| `/help` | Display command help and example prompts |
| `/exit` | Exit the chatbot session |

---

## 🛡️ Security & Privacy
- This implementation requests **read-only scopes** (`https://www.googleapis.com/auth/drive.readonly`). It will not delete, rename, or modify user files.
- Credentials and OAuth tokens are cached locally in `tokens.json` (do not commit this file).
