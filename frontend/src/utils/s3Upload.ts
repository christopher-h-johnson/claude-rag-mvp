/**
 * S3 Upload Utility
 * 
 * Handles direct file uploads to S3 using presigned URLs.
 */

import axios from 'axios';

export interface UploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

export interface UploadOptions {
    file: File;
    presignedUrl: string;
    onProgress?: (progress: UploadProgress) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
}

/**
 * Upload file to S3 using presigned URL
 */
export const uploadToS3 = async (options: UploadOptions): Promise<void> => {
    const { file, presignedUrl, onProgress, onComplete, onError } = options;

    try {
        await axios.put(presignedUrl, file, {
            headers: {
                'Content-Type': file.type,
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const progress: UploadProgress = {
                        loaded: progressEvent.loaded,
                        total: progressEvent.total,
                        percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
                    };
                    onProgress(progress);
                }
            },
        });

        if (onComplete) {
            onComplete();
        }
    } catch (error) {
        const uploadError = error instanceof Error
            ? error
            : new Error('Upload failed');

        if (onError) {
            onError(uploadError);
        } else {
            throw uploadError;
        }
    }
};

/**
 * Validate file before upload
 */
export const validateFile = (file: File, maxSizeMB: number = 100): { valid: boolean; error?: string } => {
    // Check file type
    if (file.type !== 'application/pdf') {
        return {
            valid: false,
            error: 'Only PDF files are allowed',
        };
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return {
            valid: false,
            error: `File size must be less than ${maxSizeMB}MB`,
        };
    }

    return { valid: true };
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
