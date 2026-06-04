"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAddOn = exports.updateAddOn = exports.findAddOnById = exports.findAllAddOns = exports.findAddOns = exports.createAddOn = void 0;
const data_source_1 = require("../data-source");
const AddOn_1 = require("../entities/AddOn");
const repo = () => data_source_1.AppDataSource.getRepository(AddOn_1.AddOn);
const createAddOn = async (payload) => {
    const addon = repo().create(payload);
    return repo().save(addon);
};
exports.createAddOn = createAddOn;
const findAddOns = async () => repo().find({ where: { status: 'active' } });
exports.findAddOns = findAddOns;
const findAllAddOns = async () => repo().find();
exports.findAllAddOns = findAllAddOns;
const findAddOnById = async (id) => repo().findOneBy({ id });
exports.findAddOnById = findAddOnById;
const updateAddOn = async (id, payload) => {
    const addon = await repo().findOneBy({ id });
    if (!addon)
        throw new Error('Add-on not found');
    repo().merge(addon, payload);
    return repo().save(addon);
};
exports.updateAddOn = updateAddOn;
const deleteAddOn = async (id) => {
    const addon = await repo().findOneBy({ id });
    if (!addon)
        throw new Error('Add-on not found');
    return repo().remove(addon);
};
exports.deleteAddOn = deleteAddOn;
