import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { DocumentService, createDocumentSchema } from '../services/document.service';
import { avatarUpload, documentUpload, handleUploadError } from '../middleware/upload';
import { auditLogger } from '../middleware/auditTracking';

const router = Router();

// ========== DOCUMENTS ==========

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await DocumentService.getDocuments(req.query);
    res.json({ success: true, data: result.documents, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch documents' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const document = await DocumentService.getDocumentById(req.params.id);
    res.json({ success: true, data: document });
  } catch (error) {
    if (error instanceof Error && error.message === 'Document not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch document' });
  }
});

router.post('/', authenticateToken, documentUpload.single('file'), handleUploadError, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const documentData = {
      entityType: req.body.entityType,
      entityId: req.body.entityId,
      documentType: req.body.documentType,
      fileName: file.originalname,
      fileUrl: `/uploads/documents/${file.filename}`,
      fileSize: file.size,
      mimeType: file.mimetype,
      description: req.body.description,
    };

    const document = await DocumentService.createDocument(documentData, userId);
    
    // Document service returns void/error
    auditLogger.info('Document uploaded', {
      userId,
      documentId: 'unknown',
      entityType: documentData.entityType,
      entityId: documentData.entityId,
    });

    res.status(201).json({ success: true, data: document, message: 'Document uploaded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to upload document' });
  }
});

router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const result = await DocumentService.deleteDocument(req.params.id);
    auditLogger.info('Document deleted', { userId, documentId: req.params.id });
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Document not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
});

export default router;
