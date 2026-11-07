/**
 * In-memory Mock Drive for quick testing, development, and demonstration
 * without requiring real Google Cloud credentials immediately.
 */

const MOCK_FILES = [
  {
    id: 'folder-root',
    name: 'My Drive',
    mimeType: 'application/vnd.google-apps.folder',
    parents: [],
    starred: false,
    modifiedTime: '2026-11-01T10:00:00Z',
  },
  {
    id: 'folder-projects',
    name: 'Projects',
    mimeType: 'application/vnd.google-apps.folder',
    parents: ['root'],
    starred: true,
    modifiedTime: '2026-11-02T12:00:00Z',
  },
  {
    id: 'folder-ai-assistant',
    name: 'AI-Assistant-Roadmap',
    mimeType: 'application/vnd.google-apps.folder',
    parents: ['folder-projects'],
    starred: true,
    modifiedTime: '2026-11-03T15:30:00Z',
  },
  {
    id: 'folder-finance',
    name: 'Finance & Invoices',
    mimeType: 'application/vnd.google-apps.folder',
    parents: ['root'],
    starred: false,
    modifiedTime: '2026-11-04T09:15:00Z',
  },
  {
    id: 'doc-roadmap-spec',
    name: 'Product Architecture & Roadmap 2026.gdoc',
    mimeType: 'application/vnd.google-apps.document',
    parents: ['folder-ai-assistant'],
    starred: true,
    modifiedTime: '2026-11-05T14:20:00Z',
    content: `# Product Architecture & Roadmap 2026

## Objective
Develop an autonomous Level 1 Agentic AI Assistant capable of interacting with Google Drive files, traversing directory trees, retrieving starred items, and extracting actionable text from corporate docs.

## Milestones
- Q1: Tool Calling interface for Drive search & folder navigation.
- Q2: Context-aware document chunking and extractive QA.
- Q3: Starred priorities automated digest generator.

## Key Contributors
- Lead Engineer: Hirak Biswas
- AI Architect: DeepMind Collab Team`,
  },
  {
    id: 'sheet-q3-budget',
    name: 'Q3 Financial Budget.gsheet',
    mimeType: 'application/vnd.google-apps.spreadsheet',
    parents: ['folder-finance'],
    starred: false,
    modifiedTime: '2026-11-02T11:45:00Z',
    content: `Category,Budget Allocated,Spent,Remaining
Cloud Infrastructure,15000,11200,3800
LLM API Tokens,8000,6400,1600
Contractor Fees,20000,18500,1500
Tooling & Licenses,4500,4100,400
Total,47500,40200,7300`,
  },
  {
    id: 'doc-meeting-notes',
    name: 'Weekly Sync Notes - Nov 2026.gdoc',
    mimeType: 'application/vnd.google-apps.document',
    parents: ['folder-projects'],
    starred: true,
    modifiedTime: '2026-11-06T18:00:00Z',
    content: `# Weekly Sync Notes - Nov 6, 2026

## Discussion Topics
1. Level 1 Agent evaluation: Testing multi-turn subfolder traversal and file content extraction.
2. Google Drive API integration: Confirmed read-only metadata and full-text extraction support.
3. Decision: Starred files should be highlighted on assistant startup as a priority dashboard.

## Next Steps
- Implement CLI REPL with breadcrumb navigation.
- Add support for both real Google Drive API and Mock Drive fallback.`,
  },
  {
    id: 'file-notes-txt',
    name: 'Quick-Ideas.txt',
    mimeType: 'text/plain',
    parents: ['root'],
    starred: false,
    modifiedTime: '2026-11-06T19:30:00Z',
    content: `Quick ideas for drive navigation:
- Filter by mimeType (folders, documents, spreadsheets)
- Support navigating relative paths like 'Projects/AI-Assistant-Roadmap'
- Extract data directly to answer user questions without requiring manual downloads.`,
  }
];

export class MockDriveService {
  constructor() {
    this.files = MOCK_FILES;
  }

  async searchFiles({ query = '', mimeType = null, folderId = null, starredOnly = false, pageSize = 10 }) {
    let results = this.files.filter(f => f.id !== 'folder-root');

    if (starredOnly) {
      results = results.filter(f => f.starred);
    }

    if (folderId) {
      const targetFolder = folderId === 'root' ? 'root' : folderId;
      results = results.filter(f => f.parents.includes(targetFolder));
    }

    if (mimeType) {
      results = results.filter(f => f.mimeType === mimeType);
    }

    if (query && query.trim() !== '') {
      const q = query.toLowerCase();
      results = results.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.content && f.content.toLowerCase().includes(q))
      );
    }

    return results.slice(0, pageSize).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      starred: f.starred,
      modifiedTime: f.modifiedTime,
      parents: f.parents,
    }));
  }

  async listFolderContents({ folderId = 'root', pageSize = 20 }) {
    const targetFolder = folderId === 'root' ? 'root' : folderId;
    const contents = this.files.filter(f => f.parents.includes(targetFolder));

    return {
      currentFolderId: folderId,
      totalFound: contents.length,
      items: contents.slice(0, pageSize).map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        isFolder: f.mimeType === 'application/vnd.google-apps.folder',
        starred: f.starred,
        modifiedTime: f.modifiedTime,
      })),
    };
  }

  async getStarredFiles({ pageSize = 10 }) {
    const starred = this.files.filter(f => f.starred && f.id !== 'folder-root');
    return starred.slice(0, pageSize).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      modifiedTime: f.modifiedTime,
      parents: f.parents,
    }));
  }

  async getFileMetadata({ fileId }) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) throw new Error(`File with ID "${fileId}" not found.`);
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
      starred: file.starred,
      modifiedTime: file.modifiedTime,
      parents: file.parents,
    };
  }

  async extractFileContent({ fileId, maxChars = 4000 }) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) throw new Error(`File with ID "${fileId}" not found.`);
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      return {
        id: file.id,
        name: file.name,
        error: 'Cannot extract text content from a directory/folder.',
      };
    }
    const rawContent = file.content || '(File contains no text or is binary)';
    const truncated = rawContent.slice(0, maxChars);
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      content: truncated,
      isTruncated: rawContent.length > maxChars,
      totalLength: rawContent.length,
    };
  }

  async getFolderPath({ folderId = 'root' }) {
    if (folderId === 'root' || folderId === 'folder-root') {
      return [{ id: 'root', name: 'My Drive' }];
    }

    const path = [];
    let current = this.files.find(f => f.id === folderId);

    while (current) {
      path.unshift({ id: current.id, name: current.name });
      const parentId = current.parents && current.parents[0];
      if (!parentId || parentId === 'root') {
        path.unshift({ id: 'root', name: 'My Drive' });
        break;
      }
      current = this.files.find(f => f.id === parentId);
    }

    return path;
  }
}
