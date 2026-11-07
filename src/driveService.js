/**
 * Google Drive API v3 Service
 * Provides structured abstractions for file searching, folder navigation,
 * starred file retrieval, and content extraction.
 */

export class GoogleDriveService {
  constructor(driveClient) {
    this.drive = driveClient;
  }

  /**
   * Search files and folders across Google Drive.
   * Supports name queries, full-text queries, mimeTypes, starred filters, and folder constraints.
   */
  async searchFiles({ query = '', mimeType = null, folderId = null, starredOnly = false, pageSize = 10 }) {
    const queryParts = ['trashed = false'];

    if (query && query.trim() !== '') {
      const sanitized = query.replace(/'/g, "\\'");
      // Searches both file name and document body full-text
      queryParts.push(`(name contains '${sanitized}' or fullText contains '${sanitized}')`);
    }

    if (starredOnly) {
      queryParts.push('starred = true');
    }

    if (folderId) {
      const target = folderId === 'root' ? 'root' : folderId;
      queryParts.push(`'${target}' in parents`);
    }

    if (mimeType) {
      queryParts.push(`mimeType = '${mimeType}'`);
    }

    const q = queryParts.join(' and ');

    const res = await this.drive.files.list({
      q,
      pageSize,
      fields: 'files(id, name, mimeType, starred, modifiedTime, parents, size)',
      orderBy: 'folder,modifiedTime desc',
    });

    const files = res.data.files || [];
    return files.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
      starred: file.starred || false,
      modifiedTime: file.modifiedTime,
      parents: file.parents || [],
      size: file.size ? `${(file.size / 1024).toFixed(1)} KB` : undefined,
    }));
  }

  /**
   * List files and subfolders directly inside a specified folder.
   */
  async listFolderContents({ folderId = 'root', pageSize = 25 }) {
    const target = folderId === 'root' ? 'root' : folderId;
    const q = `'${target}' in parents and trashed = false`;

    const res = await this.drive.files.list({
      q,
      pageSize,
      fields: 'files(id, name, mimeType, starred, modifiedTime, size)',
      orderBy: 'folder,name',
    });

    const items = (res.data.files || []).map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
      starred: file.starred || false,
      modifiedTime: file.modifiedTime,
      size: file.size ? `${(file.size / 1024).toFixed(1)} KB` : undefined,
    }));

    return {
      currentFolderId: folderId,
      totalFound: items.length,
      items,
    };
  }

  /**
   * Retrieve all starred files and folders.
   */
  async getStarredFiles({ pageSize = 15 }) {
    const q = 'starred = true and trashed = false';
    const res = await this.drive.files.list({
      q,
      pageSize,
      fields: 'files(id, name, mimeType, modifiedTime, parents)',
      orderBy: 'modifiedTime desc',
    });

    return (res.data.files || []).map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
      modifiedTime: file.modifiedTime,
      parents: file.parents || [],
    }));
  }

  /**
   * Get metadata for a specific file or folder by ID.
   */
  async getFileMetadata({ fileId }) {
    const res = await this.drive.files.get({
      fileId,
      fields: 'id, name, mimeType, starred, modifiedTime, parents, size, description',
    });

    const file = res.data;
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
      starred: file.starred || false,
      modifiedTime: file.modifiedTime,
      parents: file.parents || [],
      description: file.description || '',
    };
  }

  /**
   * Extract textual content from a document (Google Docs, Sheets, text files, markdown, etc.)
   */
  async extractFileContent({ fileId, maxChars = 4000 }) {
    const meta = await this.getFileMetadata({ fileId });

    if (meta.isFolder) {
      return {
        id: fileId,
        name: meta.name,
        error: 'Target item is a folder, not a readable document.',
      };
    }

    let textContent = '';

    // Handle Google Docs (export to text/plain)
    if (meta.mimeType === 'application/vnd.google-apps.document') {
      const exportRes = await this.drive.files.export({
        fileId,
        mimeType: 'text/plain',
      });
      textContent = typeof exportRes.data === 'string' ? exportRes.data : JSON.stringify(exportRes.data);
    }
    // Handle Google Sheets (export to text/csv)
    else if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') {
      const exportRes = await this.drive.files.export({
        fileId,
        mimeType: 'text/csv',
      });
      textContent = typeof exportRes.data === 'string' ? exportRes.data : JSON.stringify(exportRes.data);
    }
    // Handle plain text, markdown, json, csv
    else if (
      meta.mimeType.startsWith('text/') ||
      meta.mimeType === 'application/json' ||
      meta.mimeType === 'application/javascript'
    ) {
      const getRes = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'text' }
      );
      textContent = typeof getRes.data === 'string' ? getRes.data : JSON.stringify(getRes.data);
    }
    // Binary or unsupported extraction type
    else {
      return {
        id: fileId,
        name: meta.name,
        mimeType: meta.mimeType,
        content: `[Binary or non-text document format: ${meta.mimeType}. Full direct extraction not supported via plain text export.]`,
        isTruncated: false,
      };
    }

    const truncated = textContent.slice(0, maxChars);
    return {
      id: fileId,
      name: meta.name,
      mimeType: meta.mimeType,
      content: truncated,
      isTruncated: textContent.length > maxChars,
      totalLength: textContent.length,
    };
  }

  /**
   * Traverse parent relationships to build a breadcrumb path (e.g. My Drive > Projects > 2026).
   */
  async getFolderPath({ folderId = 'root' }) {
    if (folderId === 'root') {
      return [{ id: 'root', name: 'My Drive' }];
    }

    const path = [];
    let currentId = folderId;

    while (currentId && currentId !== 'root') {
      try {
        const file = await this.drive.files.get({
          fileId: currentId,
          fields: 'id, name, parents',
        });

        path.unshift({ id: file.data.id, name: file.data.name });
        const parents = file.data.parents;
        if (!parents || parents.length === 0 || parents[0] === 'root') {
          path.unshift({ id: 'root', name: 'My Drive' });
          break;
        }
        currentId = parents[0];
      } catch (e) {
        break;
      }
    }

    return path;
  }
}
