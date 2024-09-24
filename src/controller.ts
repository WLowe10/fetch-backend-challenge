import { z } from "zod";
import { prisma } from "./lib/prisma.js";
import { aggregatePaymentsBalance, getRemainingPoints } from "./lib/payments.js";
import type { FastifyInstance } from "fastify";

const pointsValueSchema = z.number().int();

// schema to validate the body for /add
const addPointsSchema = z.object({
	payer: z.string(),
	points: pointsValueSchema,
	timestamp: z.string().datetime(),
});

// schema to validate the body for /spend
const spendPointsSchema = z.object({
	points: pointsValueSchema,
});

export async function mainController(fastify: FastifyInstance) {
	fastify.get("/balance", async (request, reply) => {
		// a map storing the aggregated points for each payer
		const balanceMap = new Map<string, number>();

		const payments = await prisma.payment.findMany({
			where: {
				is_closed: false,
			},
		});

		for (const payment of payments) {
			// get the aggregated points
			const points = balanceMap.get(payment.payer_name) ?? 0;

			// add to the aggregated points
			balanceMap.set(payment.payer_name, points + getRemainingPoints(payment));
		}

		// serialize the map into a JS object. Fastify will automatically convert this to a JSON string
		return Object.fromEntries(balanceMap);
	});

	fastify.post("/add", async (request, reply) => {
		// validate the request body
		const dataResult = addPointsSchema.safeParse(request.body);

		if (!dataResult.success) {
			return reply.code(400).send();
		}

		const data = dataResult.data;

		let payer = await prisma.payer.findUnique({
			where: {
				name: data.payer,
			},
		});

		// if the payer doesn't exist, insert a new one
		if (!payer) {
			payer = await prisma.payer.create({
				data: {
					name: data.payer,
				},
			});
		}

		// if this is a negative addition, we need to deduct points from a previous payment of this payer
		if (data.points < 0) {
			// get all of the payer's payments that are not closed, from oldest to newest
			const payerPayments = await prisma.payment.findMany({
				where: {
					payer_name: payer.name,
					is_closed: false,
				},
				orderBy: {
					date: "asc",
				},
			});

			const amountToDeduct = -data.points;
			const payerBalance = aggregatePaymentsBalance(payerPayments);

			if (payerBalance < amountToDeduct) {
				return reply
					.code(400)
					.send("The payer does not have enough points to complete this transaction");
			}

			let remainingPointsToDeduct = amountToDeduct;

			// traverse the payments from oldest to newest
			for (const payment of payerPayments) {
				if (remainingPointsToDeduct <= 0) {
					break;
				}

				const amountRemaining = getRemainingPoints(payment);
				const amountToDeduct = Math.min(amountRemaining, remainingPointsToDeduct);

				// update the payment, spending the points
				await prisma.payment.update({
					where: {
						id: payment.id,
					},
					data: {
						spent: {
							// atomically increment the spent points
							increment: amountToDeduct,
						},
						is_closed: amountRemaining === amountToDeduct,
					},
				});
			}
		} else {
			// otherwise, just insert the payment record
			await prisma.payment.create({
				data: {
					payer_name: data.payer,
					amount: data.points,
					date: data.timestamp,
				},
			});
		}
	});

	fastify.post("/spend", async (request, reply) => {
		const dataResult = spendPointsSchema.safeParse(request.body);

		if (!dataResult.success) {
			return reply.code(400).send();
		}

		const data = dataResult.data;

		// select all payments that aren't closed, ordered by date ascending (oldest first)
		const payments = await prisma.payment.findMany({
			orderBy: {
				date: "asc",
			},
			where: {
				is_closed: false,
			},
		});

		const totalBalance = aggregatePaymentsBalance(payments);

		if (data.points > totalBalance) {
			return reply
				.code(400)
				.send("You do not have enough points to complete this transaction");
		}

		let remainingPoints = data.points;

		// this deduction map is for storing the points deducted from each payer to be sent in the response
		const deductionMap = new Map<string, number>();

		for (const payment of payments) {
			if (remainingPoints <= 0) {
				break;
			}

			const amountRemaining = getRemainingPoints(payment);
			const amountToDeduct = Math.min(amountRemaining, remainingPoints);

			remainingPoints -= amountToDeduct;

			const updatedPayment = await prisma.payment.update({
				where: {
					id: payment.id,
				},
				data: {
					spent: {
						// atomically increment the spent points
						increment: amountToDeduct,
					},
					is_closed: amountRemaining === amountToDeduct,
				},
			});

			const prevDeducted = deductionMap.get(updatedPayment.payer_name) ?? 0;

			deductionMap.set(updatedPayment.payer_name, prevDeducted - amountToDeduct);
		}

		return Object.fromEntries(deductionMap);
	});
}
