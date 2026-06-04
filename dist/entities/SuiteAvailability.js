"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuiteAvailability = void 0;
const typeorm_1 = require("typeorm");
const Suite_1 = require("./Suite");
let SuiteAvailability = class SuiteAvailability {
};
exports.SuiteAvailability = SuiteAvailability;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SuiteAvailability.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Suite_1.Suite, (suite) => suite.availability, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'suiteId' }),
    __metadata("design:type", Suite_1.Suite)
], SuiteAvailability.prototype, "suite", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SuiteAvailability.prototype, "suiteId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SuiteAvailability.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SuiteAvailability.prototype, "timeSlot", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'blocked' }),
    __metadata("design:type", String)
], SuiteAvailability.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], SuiteAvailability.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], SuiteAvailability.prototype, "createdAt", void 0);
exports.SuiteAvailability = SuiteAvailability = __decorate([
    (0, typeorm_1.Entity)()
], SuiteAvailability);
