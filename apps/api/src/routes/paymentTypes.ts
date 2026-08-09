import { Router, Request, Response } from 'express';
import { PaymentTypeService } from '../services/paymentType.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Get all payment types
router.get('/', async (req: Request, res: Response) => {
  try {
    const paymentTypes = await PaymentTypeService.getAllPaymentTypes();
    res.json({
      success: true,
      data: paymentTypes,
    });
  } catch (error: any) {
    console.error('Error fetching payment types:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des types de versement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: process.env.NODE_ENV === 'development' ? error.code : undefined,
    });
  }
});

// Get payment type by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const paymentType = await PaymentTypeService.getPaymentTypeById(id);
    
    if (!paymentType) {
      return res.status(404).json({ message: 'Type de versement non trouvé' });
    }
    
    res.json({
      success: true,
      data: paymentType,
    });
  } catch (error: any) {
    console.error('Error fetching payment type:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du type de versement' });
  }
});

// Create payment type (Admin/Accountant only)
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Le nom est requis' });
    }

    // Check if payment type already exists
    const exists = await PaymentTypeService.existsByName(name);
    if (exists) {
      return res.status(400).json({ message: 'Un type de versement avec ce nom existe déjà' });
    }

    const paymentType = await PaymentTypeService.createPaymentType({ name });
    res.status(201).json({
      success: true,
      data: paymentType,
    });
  } catch (error: any) {
    console.error('Error creating payment type:', error);
    res.status(500).json({ message: 'Erreur lors de la création du type de versement' });
  }
});

// Update payment type (Admin/Accountant only)
router.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Le nom est requis' });
    }

    // Check if payment type exists
    const exists = await PaymentTypeService.getPaymentTypeById(id);
    if (!exists) {
      return res.status(404).json({ message: 'Type de versement non trouvé' });
    }

    // Check if name is already used by another payment type
    const nameExists = await PaymentTypeService.existsByName(name, id);
    if (nameExists) {
      return res.status(400).json({ message: 'Un type de versement avec ce nom existe déjà' });
    }

    const paymentType = await PaymentTypeService.updatePaymentType(id, { name });
    res.json({
      success: true,
      data: paymentType,
    });
  } catch (error: any) {
    console.error('Error updating payment type:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du type de versement' });
  }
});

// Delete payment type (Admin only)
router.delete('/:id', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if payment type exists
    const exists = await PaymentTypeService.getPaymentTypeById(id);
    if (!exists) {
      return res.status(404).json({ message: 'Type de versement non trouvé' });
    }

    await PaymentTypeService.deletePaymentType(id);
    res.json({
      success: true,
      message: 'Type de versement supprimé avec succès',
    });
  } catch (error: any) {
    console.error('Error deleting payment type:', error);
    
    // Check if it's a foreign key constraint error
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        message: 'Impossible de supprimer ce type de versement car il est utilisé dans des tarifs' 
      });
    }
    
    res.status(500).json({ message: 'Erreur lors de la suppression du type de versement' });
  }
});

export default router;

