"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAvailableSuites = exports.getAvailabilityForSuite = exports.removeAvailabilitySlot = exports.addAvailabilitySlot = exports.deleteSuite = exports.updateSuite = exports.findSuiteById = exports.findSuites = exports.createSuite = void 0;
const data_source_1 = require("../data-source");
const Suite_1 = require("../entities/Suite");
const SuiteAvailability_1 = require("../entities/SuiteAvailability");
const suiteRepo = () => data_source_1.AppDataSource.getRepository(Suite_1.Suite);
const availabilityRepo = () => data_source_1.AppDataSource.getRepository(SuiteAvailability_1.SuiteAvailability);
const createSuite = async (payload) => {
    const suite = suiteRepo().create(payload);
    return suiteRepo().save(suite);
};
exports.createSuite = createSuite;
const findSuites = async () => suiteRepo().find();
exports.findSuites = findSuites;
const findSuiteById = async (id) => suiteRepo().findOne({ where: { id } });
exports.findSuiteById = findSuiteById;
const updateSuite = async (id, payload) => {
    const suite = await suiteRepo().findOneBy({ id });
    if (!suite)
        throw new Error('Suite not found');
    suiteRepo().merge(suite, payload);
    return suiteRepo().save(suite);
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
    const entry = availabilityRepo().create({ suite: { id: suiteId }, suiteId, date, timeSlot, status: 'blocked', note });
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
        qb.leftJoinAndSelect('suite.availability', 'availability')
            .andWhere('(availability.date != :date OR availability.timeSlot != :timeSlot OR availability.status = :status)', {
            date,
            timeSlot,
            status: 'available',
        });
    }
    return qb.getMany();
};
exports.findAvailableSuites = findAvailableSuites;
