// QueueManager.js
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

class QueueManager {
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
	 * Create a queue with a tenant-specific name.
	 * @param {string} tenantId - The ID of the tenant.
	 * @param {string} queueName - The base name of the queue.
	 * @returns {Queue} - The created BullMQ queue instance.
	 */
	// createQueue(tenantId, queueName = "defaultMySliceHRMSQueue") {
	createQueue(queueName = "defaultMySliceHRMSQueue") {
		const fullQueueName = queueName;
		// const fullQueueName = `${queueName}:${tenantId}`;

		const queue = new Queue(fullQueueName, {
			connection: this.RedisConnection,
			defaultJobOptions: {
				attempts: 3,
				backoff: {
					type: "exponential",
					delay: 1000,
				},
				removeOnComplete: { count: 1000 },
			},
		});

		// Add event listener for the queue
		queue.on("waiting", (job) => {
			this.logger.info(
				`Job #${job.id} is waiting to be processed in ${fullQueueName}.`
			);
		});

		return queue;
	}

	/**
	 * Add a job to a specific queue.
	 * @param {Queue} queue - The BullMQ queue instance.
	 * @param {string} jobName - The name/type of the job.
	 * @param {object} jobData - The data to be processed in the job.
	 * @returns {Promise} - A promise that resolves when the job is added.
	 */
	async addJobToQueue(queue, jobName, jobData) {
		try {
			await queue.add(jobName, jobData);
			this.logger.info(
				`Job added to ${queue.name} with data: ${JSON.stringify(
					jobData
				)}`
			);
		} catch (error) {
			this.logger.error(
				`Failed to add job to ${queue.name}: ${error.message}`
			);
		}
	}
}

module.exports = QueueManager;
