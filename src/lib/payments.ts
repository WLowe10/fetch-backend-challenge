// this file contains helper functions for payments

import type { Payment } from "@prisma/client";

/**
 * Gets the remaining points available in a payment
 *
 * @param {Payment} payment
 * @returns number
 */
export const getRemainingPoints = (payment: Payment) => payment.amount - payment.spent;

/**
 * Aggregates the balance of multiple payments
 *
 * @param {Payment[]} payments
 * @returns number
 */
export const aggregatePaymentsBalance = (payments: Payment[]) =>
	payments.reduce((acc, payment) => acc + payment.amount - payment.spent, 0);
