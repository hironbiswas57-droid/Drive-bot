/**
 * Tool definitions and executor for Google Gemini Function Calling
 * Level 1 Agentic Architecture
 */

export const DRIVE_TOOLS_DECLARATIONS = [
  {
    name: 'search_files',
    description: 'Search for files or folders across Google Drive matching a search query, file name, full text content, or specific MIME type.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Keyword to search in file names or full document content. E.g., "invoice", "roadmap", "project alpha".',
        },
        mimeType: {
          type: 'STRING',
          description: 'Optional filter by MIME type, e.g. "application/vnd.google-apps.folder" for folders only, "application/vnd.google-apps.document" for Docs, "application/vnd.google-apps.spreadsheet" for Sheets.',
        },
        folderId: {
          type: 'STRING',
          description: 'Optional folder ID to restrict the search to a specific directory. Defaults to search across all accessible locations.',
        },
        starredOnly: {
          type: 'BOOLEAN',
          description: 'Set to true to only search within starred/favorited files.',
        },
        pageSize: {
          type: 'INTEGER',
          description: 'Maximum number of results to return (default 10).',
        },
      },
    },
  },
  {
    name: 'list_folder_contents',
    description: 'List all files and subfolders contained inside a specific folder ID in Google Drive. Use "root" for My Drive top-level directory.',
    parameters: {
      type: 'OBJECT',
      properties: {
        folderId: {
          type: 'STRING',
          description: 'The ID of the folder to list (use "root" for top-level My Drive).',
        },
        pageSize: {
          type: 'INTEGER',
          description: 'Maximum items to retrieve (default 20).',
        },
      },
      required: ['folderId'],
    },
  },
  {
    name: 'get_starred_files',
    description: 'Retrieve the user\'s starred (favorite or priority) files and folders across Google Drive.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pageSize: {
          type: 'INTEGER',
          description: 'Maximum number of starred items to return (default 10).',
        },
      },
    },
  },
  {
    name: 'extract_file_content',
    description: 'Extract and read the textual data and content from a Google Doc, Sheet, CSV, text, or markdown file. Use this when the user asks questions about what is inside a document.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fileId: {
          type: 'STRING',
          description: 'The unique ID of the file to extract content from.',
        },
        maxChars: {
          type: 'INTEGER',
          description: 'Maximum character length of text to read (default 4000).',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'get_folder_breadcrumbs',
    description: 'Get the human-readable breadcrumb path (e.g. My Drive > Projects > 2026) for a given folder ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        folderId: {
          type: 'STRING',
          description: 'The folder ID to get the breadcrumb path for.',
        },
      },
      required: ['folderId'],
    },
  },
];

/**
 * Dispatcher to execute the tool selected by the Agent LLM.
 */
export async function executeTool(name, args, driveService, sessionContext) {
  try {
    switch (name) {
      case 'search_files': {
        const results = await driveService.searchFiles({
          query: args.query || '',
          mimeType: args.mimeType || null,
          folderId: args.folderId || null,
          starredOnly: Boolean(args.starredOnly),
          pageSize: args.pageSize || 10,
        });
        return { success: true, count: results.length, files: results };
      }

      case 'list_folder_contents': {
        const folderId = args.folderId || sessionContext.currentFolderId || 'root';
        const res = await driveService.listFolderContents({
          folderId,
          pageSize: args.pageSize || 20,
        });
        // Update session's current folder if requested
        sessionContext.currentFolderId = folderId;
        return { success: true, ...res };
      }

      case 'get_starred_files': {
        const results = await driveService.getStarredFiles({
          pageSize: args.pageSize || 10,
        });
        return { success: true, count: results.length, starredFiles: results };
      }

      case 'extract_file_content': {
        const result = await driveService.extractFileContent({
          fileId: args.fileId,
          maxChars: args.maxChars || 4000,
        });
        return { success: true, extraction: result };
      }

      case 'get_folder_breadcrumbs': {
        const path = await driveService.getFolderPath({
          folderId: args.folderId || sessionContext.currentFolderId || 'root',
        });
        const formatted = path.map(p => p.name).join(' / ');
        return { success: true, breadcrumbs: path, pathString: formatted };
      }

      default:
        return { error: `Tool "${name}" is not recognized.` };
    }
  } catch (error) {
    return {
      error: `Failed to execute ${name}: ${error.message || String(error)}`,
    };
  }
}
