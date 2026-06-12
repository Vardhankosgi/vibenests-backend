"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAvailableSuites = exports.getAvailabilityForSuite = exports.removeAvailabilitySlot = exports.addAvailabilitySlot = exports.deleteSuite = exports.updateSuite = exports.findSuiteById = exports.findSuites = exports.createSuite = void 0;
const data_source_1 = require("../data-source");
const Suite_1 = require("../entities/Suite");
const SuiteAvailability_1 = require("../entities/SuiteAvailability");
const suiteRepo = () => data_source_1.AppDataSource.getRepository(Suite_1.Suite);
const availabilityRepo = () => data_source_1.AppDataSource.getRepository(SuiteAvailability_1.SuiteAvailability);
function parseImages(images) {
    if (Array.isArray(images))
        return images;
    try {
        return JSON.parse(images);
    }
    catch {
        return [];
    }
}
function parseAmenities(val) {
    if (Array.isArray(val))
        return val.filter(Boolean);
    if (!val || val === '')
        return [];
    return String(val)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
const createSuite = async (payload) => {
    const data = { ...payload, images: JSON.stringify(payload.images ?? []) };
    const suite = suiteRepo().create(data);
    const saved = await suiteRepo().save(suite);
    saved.images = parseImages(saved.images);
    saved.amenities = parseAmenities(saved.amenities);
    return saved;
};
exports.createSuite = createSuite;
const findSuites = async () => {
    const suites = await suiteRepo().find();
    return suites.map((s) => {
        const anySuite = s;
        return {
            ...s,
            images: parseImages(anySuite.images),
            amenities: parseAmenities(anySuite.amenities),
        };
    });
};
exports.findSuites = findSuites;
const findSuiteById = async (id) => {
    const suite = await suiteRepo().findOne({ where: { id } });
    if (suite) {
        const anySuite = suite;
        anySuite.images = parseImages(anySuite.images);
        anySuite.amenities = parseAmenities(anySuite.amenities);
    }
    return suite;
};
exports.findSuiteById = findSuiteById;
const updateSuite = async (id, payload) => {
    const suite = await suiteRepo().findOneBy({ id });
    if (!suite)
        throw new Error('Suite not found');
    const suiteAny = suite;
    const data = {
        ...payload,
        images: JSON.stringify(payload.images ?? parseImages(suiteAny.images)),
    };
    suiteRepo().merge(suite, data);
    const saved = await suiteRepo().save(suite);
    const anySaved = saved;
    anySaved.images = parseImages(anySaved.images);
    anySaved.amenities = parseAmenities(anySaved.amenities);
    return saved;
};
exports.updateSuite = updateSuite;
const deleteSuite = async (id) => {
    const suite = await suiteRepo().findOneBy({ id });
    if (!suite)
        throw new Error('Suite not found');
    return suiteRepo().remove(suite);
};
exports.deleteSuite = deleteSuite;
const addAvailabilitySlot = async (suiteId, date, timeSlot, note) => {
    const entry = availabilityRepo().create({
        suite: { id: suiteId },
        suiteId,
        date,
        timeSlot,
        status: 'blocked',
        note,
    });
    return availabilityRepo().save(entry);
};
exports.addAvailabilitySlot = addAvailabilitySlot;
const removeAvailabilitySlot = async (id) => {
    const entry = await availabilityRepo().findOneBy({ id });
    if (!entry)
        throw new Error('Availability entry not found');
    return availabilityRepo().remove(entry);
};
exports.removeAvailabilitySlot = removeAvailabilitySlot;
const getAvailabilityForSuite = async (suiteId) => availabilityRepo().find({ where: { suiteId } });
exports.getAvailabilityForSuite = getAvailabilityForSuite;
const findAvailableSuites = async (date, timeSlot) => {
    const qb = suiteRepo().createQueryBuilder('suite');
    if (date && timeSlot) {
        qb.leftJoinAndSelect('suite.availability', 'availability').andWhere('(availability.date != :date OR availability.timeSlot != :timeSlot OR availability.status = :status)', {
            date,
            timeSlot,
            status: 'available',
        });
    }
    return qb.getMany();
};
exports.findAvailableSuites = findAvailableSuites;
