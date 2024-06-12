import * as dbUtils from "./indexDBUtils"

const CHAT_STORE_NAME = "threads";
const FILE_STORE_NAME = "files";
const ACTIVE_STATUS = 1;
const INACTIVE_STATUS = 0;

const BIDARA_DB_CONFIG = { 
	name: "bidara", 
	version: 4,
	stores: [ 
		{ 
			name: CHAT_STORE_NAME, 
			primaryKey: {
				key: "id",
				autoIncrement: false
			},
			indices: [
				{
					name: "active",
					property: "active",
					options: {
						unique: false
					}
				},
				{
					name: "length",
					property: "length",
					options: {
						unique: false
					}
				},
				{
					name: "created_time",
					property: "created_time",
					options: {
						unique: false
					}
				},
				{
					name: "updated_time",
					property: "updated_time",
					options: {
						unique: false
					}
				}
			]
		},
		{
			name: FILE_STORE_NAME,
			primaryKey: {
				key: "fileId",
				autoIncrement: true
			},
			indices : [
				{
					name: "thread",
					property: "threadId",
					options: {
						unique: false
					}
				}
			]
		}
	] 
}

let BIDARA_DB = null;

export async function createBidaraDB() {
	if (BIDARA_DB) {
		throw new Error("Bidara DB already instantiated.");
	}

	BIDARA_DB = await dbUtils.openDB(BIDARA_DB_CONFIG.name, BIDARA_DB_CONFIG.stores, BIDARA_DB_CONFIG.version);
}

export async function closeBidaraDB() {
	await dbUtils.closeDB(BIDARA_DB);
}

async function waitForDB() {
	if (BIDARA_DB) return;
	const maxWaitCount = 10;

	return await new Promise(async (resolve, reject) => {
		let waitCount = 0;
		while (true) {
			if (BIDARA_DB) {
				resolve();
				return;
			} 

			waitCount++;

			if (waitCount > maxWaitCount) {
				reject("Database took too long to respond.");
				return;
			}

			await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 10));
		}
	});
}

export async function getAllThreads() {
	await waitForDB();

	const threads = await dbUtils.readAll(BIDARA_DB, CHAT_STORE_NAME, "created_time", true);
	return threads;
}

export async function getThreadById(id) {
	await waitForDB();

	const thread = await dbUtils.readByKey(BIDARA_DB, CHAT_STORE_NAME, id);
	return thread;
}

export async function getActiveThread() {
	await waitForDB();

	return await dbUtils.readFirstByIndex(BIDARA_DB, CHAT_STORE_NAME, "active", true);
}

export async function getMostRecentlyCreatedThread() {
	await waitForDB();

	return await dbUtils.readFirstByIndex(BIDARA_DB, CHAT_STORE_NAME, "created_time", false);
}

export async function getMostRecentlyUpdatedThread() {
	await waitForDB();

	return await dbUtils.readFirstByIndex(BIDARA_DB, CHAT_STORE_NAME, "updated_time", true);
}

export async function getThreadFiles(threadId) {
	await waitForDB();

	const files = await dbUtils.readByProperty(BIDARA_DB, FILE_STORE_NAME, "threadId", threadId);

	if (!files) {
		return [];
	}

	return files;
}

export async function getFileById(fileId) {
	await waitForDB();

	const file = await dbUtils.readByKey(BIDARA_DB, FILE_STORE_NAME, fileId);
	return file;
}

export async function getEmptyThread(emptyLength) {
	await waitForDB();

	const emptyThread = await dbUtils.readFirstByIndex(BIDARA_DB, CHAT_STORE_NAME, "length", false);
	if (emptyThread && emptyThread.length <= emptyLength) {
		return emptyThread;
	}

	return null;
}

export async function getNameById(id) {
	await waitForDB();

	const thread = await getThreadById(id);
	return thread.name;
}

export async function getLengthById(id) {
	await waitForDB();

	const thread = await getThreadById(id);
	return thread.length;
}

export async function getFilteredThreads(thread_filter) {
	await waitForDB();

	return await getAllThreads().filter(thread_filter);
}

async function updateTimeById(id) {
	await waitForDB();

	const updated_time = Date.now();
	await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "update_time", updated_time)
}

export async function pushMessageToId(id, message) {
	await waitForDB();

	await dbUtils.pushToListProperty(BIDARA_DB, CHAT_STORE_NAME, id, "messages", message,);
	const length = await getLengthById(id);
	await setLengthById(id, length + 1);
	await updateTimeById(id);
}

export async function pushFile(file) {
	await waitForDB();

	// { index: int, file: b64Data }
	await dbUtils.write(BIDARA_DB, FILE_STORE_NAME, file);
}

export async function setThread(thread) {
	await waitForDB();

	await dbUtils.write(BIDARA_DB, CHAT_STORE_NAME, thread);
}

export async function setMessagesById(id, messages) {
	await waitForDB();

	await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "messages", messages);
}

export async function setNameById(id, name) {
	await waitForDB();

	await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "name", name);
}

export async function setLengthById(id, length) {
	await waitForDB();

	await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "length", length);
}

export async function setAsstById(id, asst) {
	await waitForDB();

	await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "asst", asst);
}

export async function setActiveStatusById(id, status) {
	await waitForDB();

	if (status) {
		await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "active", ACTIVE_STATUS);

	} else {
		await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "active", INACTIVE_STATUS);
	}
	await waitForDB();

}

export async function deleteThreadById(id) {
	await waitForDB();

	await dbUtils.deleteByKey(BIDARA_DB, CHAT_STORE_NAME, id);
}
