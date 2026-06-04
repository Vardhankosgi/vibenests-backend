"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
const data_source_1 = require("./data-source");
dotenv_1.default.config();
const PORT = process.env.PORT || 4000;
data_source_1.AppDataSource.initialize()
    .then(() => {
    app_1.default.listen(PORT, () => {
        console.log(`Server started on http://localhost:${PORT}`);
    });
})
    .catch((err) => {
    console.error('Failed to initialize datasource', err);
    process.exit(1);
});
