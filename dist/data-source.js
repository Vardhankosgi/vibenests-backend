"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const User_1 = require("./entities/User");
const Booking_1 = require("./entities/Booking");
const Suite_1 = require("./entities/Suite");
const SuiteAvailability_1 = require("./entities/SuiteAvailability");
const AddOn_1 = require("./entities/AddOn");
const Payment_1 = require("./entities/Payment");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: true,
    logging: false,
    entities: [User_1.User, Booking_1.Booking, Suite_1.Suite, SuiteAvailability_1.SuiteAvailability, AddOn_1.AddOn, Payment_1.Payment],
    migrations: [],
});
