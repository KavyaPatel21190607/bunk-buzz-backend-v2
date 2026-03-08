import Timetable from '../models/Timetable.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import crypto from 'crypto';

/**
 * @route   GET /api/timetable
 * @desc    Get all timetable entries for logged-in user
 * @access  Private
 */
export const getTimetable = async (req, res, next) => {
  try {
    const { day } = req.query;

    const filter = {
      userId: req.user._id,
      isActive: true,
    };

    if (day) {
      filter.dayOfWeek = day;
    }

    const timetable = await Timetable.find(filter)
      .populate('subjectId', 'name code color')
      .sort({ dayOfWeek: 1, startTime: 1 });

    // Map the timetable to include both 'day' and 'dayOfWeek' for compatibility
    const mappedTimetable = timetable.map(entry => ({
      _id: entry._id,
      day: entry.dayOfWeek,
      dayOfWeek: entry.dayOfWeek,
      subjectId: entry.subjectId._id,
      subjectName: entry.subjectId.name,
      subjectCode: entry.subjectId.code,
      color: entry.subjectId.color,
      startTime: entry.startTime,
      endTime: entry.endTime,
      room: entry.room,
      lectureType: entry.lectureType,
    }));

    // Group by day
    const groupedByDay = mappedTimetable.reduce((acc, entry) => {
      if (!acc[entry.day]) {
        acc[entry.day] = [];
      }
      acc[entry.day].push(entry);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      count: mappedTimetable.length,
      data: {
        timetable: mappedTimetable,
        groupedByDay,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/timetable/:id
 * @desc    Get single timetable entry
 * @access  Private
 */
export const getTimetableById = async (req, res, next) => {
  try {
    const entry = await Timetable.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate('subjectId', 'name code color');

    if (!entry) {
      return next(new AppError('Timetable entry not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        entry,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/timetable
 * @desc    Create a new timetable entry
 * @access  Private
 */
export const createTimetableEntry = async (req, res, next) => {
  try {
    const { subjectId, dayOfWeek, startTime, endTime, room, lectureType } = req.body;

    // Verify subject belongs to user
    const subject = await Subject.findOne({
      _id: subjectId,
      userId: req.user._id,
    });

    if (!subject) {
      return next(new AppError('Subject not found', 404));
    }

    // Check for time conflicts
    const conflicts = await Timetable.find({
      userId: req.user._id,
      dayOfWeek,
      isActive: true,
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime },
        },
      ],
    });

    if (conflicts.length > 0) {
      return next(new AppError('Time slot conflicts with existing entry', 400));
    }

    const entry = await Timetable.create({
      userId: req.user._id,
      subjectId,
      dayOfWeek,
      startTime,
      endTime,
      room,
      lectureType,
    });

    const populatedEntry = await Timetable.findById(entry._id).populate(
      'subjectId',
      'name code color'
    );

    res.status(201).json({
      success: true,
      message: 'Timetable entry created successfully',
      data: {
        entry: populatedEntry,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/timetable/:id
 * @desc    Update a timetable entry
 * @access  Private
 */
export const updateTimetableEntry = async (req, res, next) => {
  try {
    const entry = await Timetable.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!entry) {
      return next(new AppError('Timetable entry not found', 404));
    }

    // If updating subject, verify it exists
    if (req.body.subjectId) {
      const subject = await Subject.findOne({
        _id: req.body.subjectId,
        userId: req.user._id,
      });

      if (!subject) {
        return next(new AppError('Subject not found', 404));
      }
    }

    // Check for time conflicts if time is being updated
    if (req.body.startTime || req.body.endTime || req.body.dayOfWeek) {
      const dayOfWeek = req.body.dayOfWeek || entry.dayOfWeek;
      const startTime = req.body.startTime || entry.startTime;
      const endTime = req.body.endTime || entry.endTime;

      const conflicts = await Timetable.find({
        userId: req.user._id,
        dayOfWeek,
        isActive: true,
        _id: { $ne: entry._id },
        $or: [
          {
            startTime: { $lt: endTime },
            endTime: { $gt: startTime },
          },
        ],
      });

      if (conflicts.length > 0) {
        return next(new AppError('Time slot conflicts with existing entry', 400));
      }
    }

    // Update fields
    const allowedUpdates = [
      'subjectId',
      'dayOfWeek',
      'startTime',
      'endTime',
      'room',
      'lectureType',
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        entry[field] = req.body[field];
      }
    });

    await entry.save();

    const populatedEntry = await Timetable.findById(entry._id).populate(
      'subjectId',
      'name code color'
    );

    res.status(200).json({
      success: true,
      message: 'Timetable entry updated successfully',
      data: {
        entry: populatedEntry,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/timetable/:id
 * @desc    Delete a timetable entry
 * @access  Private
 */
export const deleteTimetableEntry = async (req, res, next) => {
  try {
    const entry = await Timetable.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!entry) {
      return next(new AppError('Timetable entry not found', 404));
    }

    // Soft delete
    entry.isActive = false;
    await entry.save();

    res.status(200).json({
      success: true,
      message: 'Timetable entry deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/timetable/today
 * @desc    Get today's timetable
 * @access  Private
 */
export const getTodayTimetable = async (req, res, next) => {
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    const timetable = await Timetable.find({
      userId: req.user._id,
      dayOfWeek: today,
      isActive: true,
    })
      .populate('subjectId', 'name code color')
      .sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      day: today,
      count: timetable.length,
      data: {
        timetable,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/timetable/generate-share-code
 * @desc    Generate a shareable code for user's timetable
 * @access  Private
 */
export const generateShareCode = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Generate unique 8-character code
    let shareCode;
    let isUnique = false;
    
    while (!isUnique) {
      shareCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const existing = await User.findOne({ timetableShareCode: shareCode });
      if (!existing) isUnique = true;
    }

    user.timetableShareCode = shareCode;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Share code generated successfully',
      data: {
        shareCode,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/timetable/preview/:shareCode
 * @desc    Preview a timetable by share code (public view without sensitive data)
 * @access  Public
 */
export const previewTimetableByShareCode = async (req, res, next) => {
  try {
    const { shareCode } = req.params;

    const owner = await User.findOne({ timetableShareCode: shareCode.toUpperCase() });
    
    if (!owner) {
      return next(new AppError('Invalid share code', 404));
    }

    // Get subjects without attendance data
    const subjects = await Subject.find({
      userId: owner._id,
      isActive: true,
    }).select('name code color minimumAttendance');

    // Get timetable entries
    const timetable = await Timetable.find({
      userId: owner._id,
      isActive: true,
    })
      .populate('subjectId', 'name code color')
      .sort({ dayOfWeek: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      message: 'Timetable preview fetched successfully',
      data: {
        ownerName: owner.name,
        ownerCollege: owner.college,
        subjects: subjects.map(s => ({
          name: s.name,
          code: s.code,
          color: s.color,
          minimumAttendance: s.minimumAttendance,
        })),
        timetable: timetable.map(t => ({
          dayOfWeek: t.dayOfWeek,
          startTime: t.startTime,
          endTime: t.endTime,
          room: t.room,
          lectureType: t.lectureType,
          subject: {
            name: t.subjectId.name,
            code: t.subjectId.code,
            color: t.subjectId.color,
          },
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/timetable/adopt/:shareCode
 * @desc    Adopt/copy timetable from another user
 * @access  Private
 */
export const adoptTimetable = async (req, res, next) => {
  try {
    const { shareCode } = req.params;
    const currentUser = req.user;

    const owner = await User.findOne({ timetableShareCode: shareCode.toUpperCase() });
    
    if (!owner) {
      return next(new AppError('Invalid share code', 404));
    }

    if (owner._id.toString() === currentUser._id.toString()) {
      return next(new AppError('Cannot adopt your own timetable', 400));
    }

    // Check if user already has subjects/timetable
    const existingSubjects = await Subject.countDocuments({ userId: currentUser._id });
    const existingTimetable = await Timetable.countDocuments({ userId: currentUser._id });

    if (existingSubjects > 0 || existingTimetable > 0) {
      return next(new AppError('You already have subjects or timetable. Please delete them first before adopting.', 400));
    }

    // Get owner's subjects
    const ownerSubjects = await Subject.find({
      userId: owner._id,
      isActive: true,
    });

    // Get owner's timetable
    const ownerTimetable = await Timetable.find({
      userId: owner._id,
      isActive: true,
    });

    // Create a mapping of old subject IDs to new subject IDs
    const subjectIdMap = {};

    // Copy subjects (without attendance data)
    const newSubjects = await Promise.all(
      ownerSubjects.map(async (subject) => {
        const newSubject = await Subject.create({
          userId: currentUser._id,
          name: subject.name,
          code: subject.code,
          color: subject.color,
          minimumAttendance: subject.minimumAttendance,
          totalLectures: 0,
          attendedLectures: 0,
          isActive: true,
        });
        
        subjectIdMap[subject._id.toString()] = newSubject._id;
        return newSubject;
      })
    );

    // Copy timetable entries with new subject IDs
    const newTimetable = await Promise.all(
      ownerTimetable.map(async (entry) => {
        const newSubjectId = subjectIdMap[entry.subjectId.toString()];
        
        if (!newSubjectId) {
          throw new Error('Subject mapping error');
        }

        return await Timetable.create({
          userId: currentUser._id,
          subjectId: newSubjectId,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room,
          lectureType: entry.lectureType,
          isActive: true,
        });
      })
    );

    res.status(201).json({
      success: true,
      message: `Successfully adopted timetable from ${owner.name}`,
      data: {
        subjectsCreated: newSubjects.length,
        timetableEntriesCreated: newTimetable.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/timetable/share-code
 * @desc    Revoke/delete share code
 * @access  Private
 */
export const revokeShareCode = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    user.timetableShareCode = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Share code revoked successfully',
    });
  } catch (error) {
    next(error);
  }
};
