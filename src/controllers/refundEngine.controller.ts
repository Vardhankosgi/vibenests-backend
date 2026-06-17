import { Request, Response } from 'express';
import * as svc from '../services/refundEngine.service';
import { REFUND_POLICY_TIERS, GATEWAY_CHARGE_RATE } from '../entities/RefundCalculation';

const getIp = (req: Request) => req.ip || req.socket.remoteAddress;

// ── Public: Policy tiers (no auth needed) ────────────────────────────────────
export const getPolicy = async (_req: Request, res: Response) => {
  try {
    const pcts = await svc.getRefundPolicyPercentages();
    const dynamicTiers = [
      {
        label: 'Full Refund (minus gateway charges)',
        minHours: 168,
        maxHours: Infinity,
        percentage: pcts.tier100,
        gatewayDeduction: true,
      },
      {
        label: `${pcts.tier75}% Refund`,
        minHours: 72,
        maxHours: 168,
        percentage: pcts.tier75,
        gatewayDeduction: false,
      },
      {
        label: `${pcts.tier50}% Refund`,
        minHours: 24,
        maxHours: 72,
        percentage: pcts.tier50,
        gatewayDeduction: false,
      },
      {
        label: 'Not Eligible – No Refund',
        minHours: 0,
        maxHours: 24,
        percentage: 0,
        gatewayDeduction: false,
      },
    ];
    res.json({
      tiers: dynamicTiers,
      gatewayChargeRate: GATEWAY_CHARGE_RATE,
      description: 'Refund eligibility is calculated automatically based on time remaining before the event.',
    });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
};

// ── Calculate policy preview ──────────────────────────────────────────────────
export const calculateRefund = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.body;
    res.json(await svc.calculateRefund(+bookingId));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
};

// ── Initiate refund (automated) ───────────────────────────────────────────────
export const initiateRefund = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { bookingId, refundReason, customerMessage, attachments } = req.body;
    res.status(201).json(await svc.initiateRefund(
      +bookingId,
      req.user.id,
      refundReason,
      customerMessage,
      attachments,
      getIp(req)
    ));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
};

// ── List refunds ──────────────────────────────────────────────────────────────
export const listRefunds = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { status, searchKeyword, page, limit, userId } = req.query as any;
    const targetUserId = req.user.role === 'admin'
      ? (userId ? +userId : undefined)
      : req.user.id;

    res.json(await svc.getRefunds({
      status,
      searchKeyword,
      userId: targetUserId,
      page: +page || 1,
      limit: +limit || 20
    }));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
};

// ── Get single refund ─────────────────────────────────────────────────────────
export const getRefund = async (req: Request & { user?: any }, res: Response) => {
  try {
    const refund = await svc.getRefundById(+req.params.id);
    if (req.user.role !== 'admin' && refund.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(refund);
  } catch (e: any) {
    res.status(404).json({ message: e.message });
  }
};

// ── Admin manual override endpoints ──────────────────────────────────────────
export const markUnderReview = async (req: Request & { user?: any }, res: Response) => {
  try {
    res.json(await svc.updateStatusToReview(+req.params.id, req.user.id, getIp(req)));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
};

export const approveRefund = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { selectedPercentage, adminNotes } = req.body;
    res.json(await svc.approveRefund(+req.params.id, req.user.id, +selectedPercentage, adminNotes, getIp(req)));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
};

export const rejectRefund = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { rejectionReason } = req.body;
    res.json(await svc.rejectRefund(+req.params.id, req.user.id, rejectionReason, getIp(req)));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
};

export const progressToProcessing = async (req: Request & { user?: any }, res: Response) => {
  try {
    res.json(await svc.moveToProcessing(+req.params.id, req.user.id, getIp(req)));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
};

export const completeRefund = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { referenceId, paymentGatewayResponse } = req.body;
    res.json(await svc.completeRefund(+req.params.id, req.user.id, referenceId, paymentGatewayResponse, getIp(req)));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
};
