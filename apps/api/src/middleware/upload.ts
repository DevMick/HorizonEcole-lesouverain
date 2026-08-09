import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create subdirectories
const subdirs = ['avatars', 'documents', 'students', 'parents', 'justificatifs'];
subdirs.forEach(subdir => {
  const dir = path.join(uploadDir, subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Allowed MIME types
const allowedMimeTypes = {
  images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  documents: [
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  justificatifs: [
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  ],
};

// File size limits (in bytes)
const fileSizeLimits = {
  avatar: 2 * 1024 * 1024, // 2MB
  document: 10 * 1024 * 1024, // 10MB
};

// Resolve the upload subdirectory for a request (mirrors `destination` below).
const resolveSubdir = (req: Request): string => {
  const uploadType = req.params.type || 'documents';
  if (uploadType === 'avatar') return 'avatars';
  if (uploadType === 'justificatif') return 'justificatifs';
  return 'documents';
};

// Keep the original filename (so the UI can display/preview it as uploaded),
// sanitized for the filesystem, with a numeric suffix to avoid collisions.
const generateFileName = (subdir: string, originalName: string): string => {
  const ext = path.extname(originalName);
  const rawBase = path.basename(originalName, ext);
  const base = rawBase
    .normalize('NFKD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100) || 'fichier';
  const dir = path.join(uploadDir, subdir);
  let candidate = `${base}${ext}`;
  let counter = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${counter}${ext}`;
    counter += 1;
  }
  return candidate;
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, path.join(uploadDir, resolveSubdir(req)));
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, generateFileName(resolveSubdir(req), file.originalname));
  },
});

// File filter function
const fileFilter = (allowedTypes: string[]) => (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// Multer configurations
export const avatarUpload = multer({
  storage,
  fileFilter: fileFilter(allowedMimeTypes.images),
  limits: {
    fileSize: fileSizeLimits.avatar,
    files: 1,
  },
});

export const documentUpload = multer({
  storage,
  fileFilter: fileFilter(allowedMimeTypes.documents),
  limits: {
    fileSize: fileSizeLimits.document,
  },
});

export const justificatifUpload = multer({
  storage: multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb) => {
      cb(null, path.join(uploadDir, 'justificatifs'));
    },
    filename: (req: Request, file: Express.Multer.File, cb) => {
      cb(null, generateFileName('justificatifs', file.originalname));
    },
  }),
  fileFilter: fileFilter(allowedMimeTypes.justificatifs),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
});

// Utility functions
export const deleteFile = (filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

export const getFileUrl = (filename: string, type: 'avatar' | 'document' | 'justificatif' = 'document'): string => {
  let subdir = 'documents';
  if (type === 'avatar') subdir = 'avatars';
  else if (type === 'justificatif') subdir = 'justificatifs';
  return `/uploads/${subdir}/${filename}`;
};

export const getFilePath = (filename: string, type: 'avatar' | 'document' | 'justificatif' = 'document'): string => {
  let subdir = 'documents';
  if (type === 'avatar') subdir = 'avatars';
  else if (type === 'justificatif') subdir = 'justificatifs';
  return path.join(uploadDir, subdir, filename);
};

// Validation helpers
export const validateFileType = (file: Express.Multer.File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.mimetype);
};

export const validateFileSize = (file: Express.Multer.File, maxSize: number): boolean => {
  return file.size <= maxSize;
};

// Error handling middleware
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File too large',
          message: `File size exceeds the limit`,
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files',
          message: `Maximum number of files exceeded`,
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field',
          message: `Unexpected file field name`,
        });
      default:
        return res.status(400).json({
          success: false,
          error: 'Upload error',
          message: error.message,
        });
    }
  }

  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type',
      message: error.message,
    });
  }

  next(error);
};
