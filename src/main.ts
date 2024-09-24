import Fastify from "fastify";
import { mainController } from "./controller.js";

const fastify = Fastify({ logger: true });

// register the main routes
fastify.register(mainController);

await fastify.listen({
	port: process.env.PORT ? Number(process.env.PORT) : 8000,
});
