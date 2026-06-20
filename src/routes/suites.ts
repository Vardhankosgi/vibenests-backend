import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { AppDataSource } from '../data-source';
import { Booking } from '../entities/Booking';
import { SuiteAvailability } from '../entities/SuiteAvailability';
import { In } from 'typeorm';
import {
  createSuite,
  findSuites,
  findSuiteById,
  updateSuite,
  deleteSuite,
  addAvailabilitySlot,
  removeAvailabilitySlot,
  getAvailabilityForSuite,
} from '../services/suites.service';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const suites = await findSuites();
    res.json(suites);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const suite = await findSuiteById(Number(req.params.id));
    if (!suite) return res.status(404).json({ message: 'Suite not found' });
    res.json(suite);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const suite = await createSuite(req.body);
    res.status(201).json(suite);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const suite = await updateSuite(Number(req.params.id), req.body);
    res.json(suite);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    await deleteSuite(Number(req.params.id));
    res.json({ message: 'Suite removed' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/availability', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const availability = await getAvailabilityForSuite(Number(req.params.id));
    res.json(availability);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/availability', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const { date, timeSlot, note } = req.body;
    const availability = await addAvailabilitySlot(Number(req.params.id), date, timeSlot, note);
    res.status(201).json(availability);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id/availability/:availabilityId', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    await removeAvailabilitySlot(Number(req.params.availabilityId));
    res.json({ message: 'Availability slot removed' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/blocked-slots', async (req, res) => {
  try {
    const suiteId = Number(req.params.id);
    const date = req.query.date as string;
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' });
    }

    let bookings = await AppDataSource.getRepository(Booking).find({
      where: {
        suiteId,
        date,
        status: In(['confirmed', 'pending', 'completed']),
      },
    });

    // Filter out pending bookings older than 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    bookings = bookings.filter((b) => {
      if (b.status === 'pending') {
        return new Date(b.createdAt) >= fifteenMinsAgo;
      }
      return true;
    });

    const availabilityRepo = AppDataSource.getRepository(SuiteAvailability);
    const blocks = await availabilityRepo.find({
      where: {
        suiteId,
        date,
        status: 'blocked',
      },
    });

    const blockedSlots = new Set<string>();
    bookings.forEach((b) => {
      if (b.timeSlot) blockedSlots.add(b.timeSlot);
    });
    blocks.forEach((b) => {
      if (b.timeSlot) blockedSlots.add(b.timeSlot);
    });

    res.json(Array.from(blockedSlots));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/availability-details', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const suiteId = Number(req.params.id);
    const date = req.query.date as string;
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' });
    }

    const bookingRepo = AppDataSource.getRepository(Booking);
    let bookings = await bookingRepo.find({
      where: {
        suiteId,
        date,
        status: In(['confirmed', 'pending', 'completed']),
      },
      relations: ['user'],
    });

    // Filter out pending bookings older than 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    bookings = bookings.filter((b) => {
      if (b.status === 'pending') {
        return new Date(b.createdAt) >= fifteenMinsAgo;
      }
      return true;
    });

    const availabilityRepo = AppDataSource.getRepository(SuiteAvailability);
    const blocks = await availabilityRepo.find({
      where: {
        suiteId,
        date,
        status: 'blocked',
      },
    });

    res.json({
      bookings,
      blocks,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
