import readline from 'readline';
import { config } from './config.js';
import { getAuthenticatedDriveClient } from './auth.js';
import { GoogleDriveService } from './driveService.js';
import { MockDriveService } from './scripts/mockDrive.js';
import { DriveAgent } from './agent.js';

// ANSI escape sequences for clean terminal formatting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

async function initializeDriveService() {
  if (config.mockMode || (!config.google.clientId && !config.google.serviceAccountKeyPath)) {
    console.log(`${colors.yellow}[Info] Running in MOCK DRIVE mode.${colors.reset} (Set real credentials in .env to connect to live Google Drive).`);
    return new MockDriveService();
  }

  try {
    console.log(`${colors.cyan}[Auth] Authenticating with Google Drive API...${colors.reset}`);
    const driveClient = await getAuthenticatedDriveClient();
    console.log(`${colors.green}[Auth] Successfully connected to Google Drive!${colors.reset}`);
    return new GoogleDriveService(driveClient);
  } catch (err) {
    console.log(`${colors.yellow}[Warning] Live Google Drive authentication failed: ${err.message}${colors.reset}`);
    console.log(`${colors.yellow}[Info] Falling back to Mock Drive mode for testing.${colors.reset}\n`);
    return new MockDriveService();
  }
}

function printBanner() {
  console.clear();
  console.log(`${colors.bold}${colors.cyan}`);
  console.log('╔═════════════════════════════════════════════════════════════════════════╗');
  console.log('║               GOOGLE DRIVE LEVEL 1 AGENTIC AI CHATBOT                   ║');
  console.log('╚═════════════════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
  console.log(`Autonomous Drive Assistant with ReAct Tool Calling & Content Extraction`);
  console.log(`- Traverses folders, subfolders, and starred files.`);
  console.log(`- Extracts content from Docs, Sheets, and Text files to answer questions.`);
  console.log(`- Type ${colors.bold}/help${colors.reset} for quick commands or just chat naturally.`);
  console.log(`- Type ${colors.bold}exit${colors.reset} or ${colors.bold}/exit${colors.reset} to quit.\n`);
}

async function main() {
  printBanner();

  let driveService = await initializeDriveService();

  const agent = new DriveAgent({
    apiKey: config.gemini.apiKey,
    model: config.gemini.model,
    driveService,
    onActivity: (activity) => {
      if (activity.type === 'tool_call') {
        const argsStr = JSON.stringify(activity.args || {});
        console.log(`${colors.dim}${colors.magenta}  ↳ [Agent Tool] ⚡ ${activity.name}(${argsStr})${colors.reset}`);
      } else if (activity.type === 'tool_result') {
        const count = activity.result.count !== undefined ? ` (found ${activity.result.count})` : '';
        const status = activity.result.error ? `${colors.red}error${colors.reset}` : `${colors.green}done${count}${colors.reset}`;
        console.log(`${colors.dim}    [Tool Status: ${status}]${colors.reset}`);
      }
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `\n${colors.bold}${colors.cyan}DriveAgent > ${colors.reset}`,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === '/exit') {
      console.log(`\n${colors.cyan}Goodbye!${colors.reset}`);
      process.exit(0);
    }

    if (input.toLowerCase() === '/help') {
      console.log(`\n${colors.bold}Available Commands & Actions:${colors.reset}`);
      console.log(`  ${colors.green}/starred${colors.reset}  : View starred/favorite files in current Drive`);
      console.log(`  ${colors.green}/ls${colors.reset}       : List contents in the current folder`);
      console.log(`  ${colors.green}/clear${colors.reset}    : Clear conversational memory`);
      console.log(`  ${colors.green}/exit${colors.reset}     : Exit the program`);
      console.log(`\n${colors.bold}Example Natural Language Prompts:${colors.reset}`);
      console.log(`  • "What starred files do I have right now?"`);
      console.log(`  • "Find the project architecture document and summarize what it says."`);
      console.log(`  • "Navigate into the Finance folder and tell me the total budget remaining."`);
      console.log(`  • "Search for files with 'meeting notes' and give me the key points from Nov 2026."`);
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === '/clear') {
      agent.resetHistory();
      console.log(`${colors.green}Conversation history cleared.${colors.reset}`);
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === '/starred') {
      try {
        const starred = await driveService.getStarredFiles({});
        console.log(`\n${colors.bold}Starred Files (${starred.length}):${colors.reset}`);
        starred.forEach(f => console.log(`  ⭐ [${f.isFolder ? 'Folder' : 'File'}] ${f.name} (ID: ${f.id})`));
      } catch (e) {
        console.log(`${colors.red}Error fetching starred files: ${e.message}${colors.reset}`);
      }
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === '/ls') {
      try {
        const contents = await driveService.listFolderContents({ folderId: agent.sessionContext.currentFolderId });
        console.log(`\n${colors.bold}Folder Contents [${agent.sessionContext.currentFolderId}] (${contents.items.length}):${colors.reset}`);
        contents.items.forEach(f => console.log(`  📁 [${f.isFolder ? 'Folder' : 'File'}] ${f.name} (${f.id})`));
      } catch (e) {
        console.log(`${colors.red}Error listing contents: ${e.message}${colors.reset}`);
      }
      rl.prompt();
      return;
    }

    // Process natural language request via the Agent
    try {
      if (!config.gemini.apiKey) {
        console.log(`\n${colors.red}[Error] GEMINI_API_KEY is not set in .env.${colors.reset}`);
        console.log(`Please create or edit the .env file with your GEMINI_API_KEY from Google AI Studio.`);
        rl.prompt();
        return;
      }

      console.log(`${colors.dim}Thinking and navigating Drive...${colors.reset}`);
      const reply = await agent.chat(input);

      console.log(`\n${colors.bold}${colors.green}Agent Response:${colors.reset}\n${reply}\n`);
    } catch (err) {
      console.log(`\n${colors.red}Error: ${err.message}${colors.reset}\n`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(`\n${colors.cyan}Session ended.${colors.reset}`);
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
