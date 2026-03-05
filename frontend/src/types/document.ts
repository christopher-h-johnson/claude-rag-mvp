/**
 * Document Type Definitions
 */

export interface UploadRequest {
    filename: string;
    fileSize: number;
    contentType: string;
}

export interface UploadURL {
    uploadUrl: string;
    documentId: string;
    expiresAt: number;
}

export interface Document {
    documentId: string;
    filename: string;
    uploadedAt: number;
    pageCount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface DocumentListResponse {
    documents: Document[];
    nextToken?: string;
}

export interface DeleteDocumentResponse {
    success: boolean;
    message: string;
}
