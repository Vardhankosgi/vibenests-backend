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
exports.Suite = void 0;
const typeorm_1 = require("typeorm");
const SuiteAvailability_1 = require("./SuiteAvailability");
let Suite = class Suite {
};
exports.Suite = Suite;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Suite.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Suite.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], Suite.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 1 }),
    __metadata("design:type", Number)
], Suite.prototype, "minCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], Suite.prototype, "capacity", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Suite.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Suite.prototype, "ratePerExtraPerson", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Suite.prototype, "baseDiscount", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Suite.prototype, "amenities", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Suite.prototype, "themeType", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { default: '[]' }),
    __metadata("design:type", Array)
], Suite.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: '09:00' }),
    __metadata("design:type", String)
], Suite.prototype, "slotStartTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: '21:00' }),
    __metadata("design:type", String)
], Suite.prototype, "slotEndTime", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 150 }),
    __metadata("design:type", Number)
], Suite.prototype, "slotDurationMins", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 30 }),
    __metadata("design:type", Number)
], Suite.prototype, "gapBetweenSlotsMins", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'available' }),
    __metadata("design:type", String)
], Suite.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => SuiteAvailability_1.SuiteAvailability, (availability) => availability.suite),
    __metadata("design:type", Array)
], Suite.prototype, "availability", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Suite.prototype, "createdAt", void 0);
exports.Suite = Suite = __decorate([
    (0, typeorm_1.Entity)()
], Suite);
