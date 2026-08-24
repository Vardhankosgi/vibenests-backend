"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
const data_source_1 = require("./data-source");
const offerSync_cron_1 = require("./cron/offerSync.cron");
const auth_service_1 = require("./services/auth.service");
dotenv_1.default.config();
const PORT = process.env.PORT || 5000;
data_source_1.AppDataSource.initialize()
    .then(async () => {
    console.log('Database connected & synchronized successfully');
    await (0, auth_service_1.seedAdminCredentials)();
    (0, offerSync_cron_1.startOfferCronJobs)();
    function startServer() {
        const server = app_1.default.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`Server started on 0.0.0.0:${PORT}`);
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`[WARN] Port ${PORT} is in use. This usually happens if the server is restarting or running in another terminal. Retrying in 3 seconds...`);
                setTimeout(() => {
                    server.close();
                    startServer();
                }, 3000);
            }
            else {
                console.error('Server error:', err);
                process.exit(1);
            }
        });
    }
    startServer();
})
    .catch((err) => {
    console.error('Failed to initialize datasource', err);
    process.exit(1);
});
