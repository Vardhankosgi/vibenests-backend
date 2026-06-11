"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
const data_source_1 = require("./data-source");
const offerSync_cron_1 = require("./cron/offerSync.cron");
const User_1 = require("./entities/User");
const bcrypt_1 = __importDefault(require("bcrypt"));
dotenv_1.default.config();
const PORT = process.env.PORT || 4000;
async function seedAdmin() {
    const repo = data_source_1.AppDataSource.getRepository(User_1.User);
    const exists = await repo.findOneBy({ email: 'admin@vibenests.com' });
    if (!exists) {
        const hash = await bcrypt_1.default.hash('admin1234', 10);
        const admin = repo.create({ fullName: 'Admin', email: 'admin@vibenests.com', password: hash, role: 'admin', isVerified: true, isActive: true });
        await repo.save(admin);
        console.log('Admin seeded: admin@vibenests.com / admin1234');
    }
}
data_source_1.AppDataSource.initialize()
    .then(async () => {
    console.log('Database connected');
    await seedAdmin();
    (0, offerSync_cron_1.startOfferCronJobs)();
    app_1.default.listen(PORT, () => {
        console.log(`Server started on http://localhost:${PORT}`);
    });
})
    .catch((err) => {
    console.error('Failed to initialize datasource', err);
    process.exit(1);
});
