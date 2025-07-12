// WorkerManager.js
const { Worker } = require("bullmq");
const IORedis = require("ioredis");

class WorkerManager {
	constructor(logger) {
		this.logger = logger;

		// Initialize Redis connection
		this.RedisConnection = new IORedis({
			host: process.env.REDIS_HOST,
			port: process.env.REDIS_PORT,
			maxRetriesPerRequest: null,
		});
	}

	/**
	 * Create a worker for a specific queue and tenant.
	 * @param {string} tenantId - The ID of the tenant.
	 * @param {string} queueName - The base name of the queue.
	 * @param {function} jobHandler - Function to handle job processing.
	 * @returns {Worker} - The created BullMQ Worker instance.
	 */
	// createWorker(tenantId, queueName = "leaderboardEventQueue", jobHandler) {
	createWorker(queueName = "defaultMySliceHRMSQueue", jobHandler) {
		const fullQueueName = queueName;
		// const fullQueueName = `${queueName}:${tenantId}`;

		const worker = new Worker(
			fullQueueName,
			async (job) => {
				// update the job progress optional
				await job.updateProgress(10);

				const result = await jobHandler(job);

				// update the job progress optional
				await job.updateProgress(100);

				this.logger.info(
					`Job #${job.id} completed successfully in ${fullQueueName} with result: ${result}`
				);

				return result;
			},
			{
				connection: this.RedisConnection,
				removeOnComplete: { count: 1000 },
				concurrency: 10,
			}
		);

		// Add worker event listeners
		worker.on("drained", () => {
			this.logger.info(
				`The ${fullQueueName} is drained. No more jobs left to process.`
			);
		});

		worker.on("completed", (job) => {
			this.logger.info(`Job #${job.id} completed in ${fullQueueName}.`);
		});

		worker.on("failed", (job, err) => {
			this.logger.error(
				`Job #${job.id} failed in ${fullQueueName} with error: ${err.message}`,
				{ jobData: job.data }
			);
		});

		return worker;
	}
}

module.exports = WorkerManager;
