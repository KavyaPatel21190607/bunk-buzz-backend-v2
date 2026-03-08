import express from 'express';
import {
  getTimetable,
  getTimetableById,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getTodayTimetable,
  generateShareCode,
  previewTimetableByShareCode,
  adoptTimetable,
  revokeShareCode,
} from '../controllers/timetableController.js';
import { authenticate, requireEmailVerified } from '../middleware/auth.js';
import {
  timetableValidation,
  mongoIdValidation,
} from '../middleware/validation.js';

const router = express.Router();

// Public route - preview timetable by share code
router.get('/preview/:shareCode', previewTimetableByShareCode);

// All other timetable routes require authentication and email verification
router.use(authenticate, requireEmailVerified);

// Timetable sharing routes
router.post('/generate-share-code', generateShareCode);
router.delete('/share-code', revokeShareCode);
router.post('/adopt/:shareCode', adoptTimetable);

router.get('/today', getTodayTimetable);

router
  .route('/')
  .get(getTimetable)
  .post(timetableValidation, createTimetableEntry);

router
  .route('/:id')
  .get(mongoIdValidation, getTimetableById)
  .put(mongoIdValidation, updateTimetableEntry)
  .delete(mongoIdValidation, deleteTimetableEntry);

export default router;
