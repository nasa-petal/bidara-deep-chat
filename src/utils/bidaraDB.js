import * as dbUtils from "./indexDBUtils"

const CHAT_STORE_NAME = "threads";
const ACTIVE_STATUS = 1;
const INACTIVE_STATUS = 0;

const BIDARA_DB_CONFIG = { 
	name: "bidara", 
	version: 1,
	stores: [ 
		{ 
			name: CHAT_STORE_NAME, 
			primaryKey: "id",
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

export async function getAllThreads() {
	const threads = await dbUtils.readAll(BIDARA_DB, CHAT_STORE_NAME, "created_time", true);
	return threads;
}

export async function getThreadById(id) {
	const thread = await dbUtils.readByKey(BIDARA_DB, CHAT_STORE_NAME, id);
	return thread;
}

export async function getActiveThread() {
	return await dbUtils.readFirstByIndex(BIDARA_DB, CHAT_STORE_NAME, "active", true);
}

export async function getMostRecentlyCreatedThread() {
	return await dbUtils.readFirstByIndex(BIDARA_DB, CHAT_STORE_NAME, "created_time", false);
}

export async function getMostRecentlyUpdatedThread() {
	return await dbUtils.readFirstByIndex(BIDARA_DB, CHAT_STORE_NAME, "updated_time", true);
}

export async function getEmptyThread() {
	const emptyThread = await dbUtils.readFirstByIndex(BIDARA_DB, CHAT_STORE_NAME, "length", false);
	if (emptyThread && emptyThread.length === 0) {
		return emptyThread;
	}

	return null;
}

export async function getNameById(id) {
	const thread = await getThreadById(id);
	return thread.name;
}

export async function getLengthById(id) {
	const thread = await getThreadById(id);
	return thread.length;
}

export async function getFilteredThreads(thread_filter) {
	return await getAllThreads().filter(thread_filter);
}

export async function pushMessageToId(id, message) {
	await dbUtils.pushToListProperty(BIDARA_DB, CHAT_STORE_NAME, id, "messages", message,);
}

export async function setThread(thread) {
	await dbUtils.write(BIDARA_DB, CHAT_STORE_NAME, thread);
}

export async function setMessagesById(id, messages) {
	await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "messages", messages);
}

export async function setNameById(id, name) {
	await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "name", name);
}

export async function setLengthById(id, length) {
	await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "length", length);
}

export async function setActiveStatusById(id, status) {
	if (status) {
		await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "active", ACTIVE_STATUS);

	} else {
		await dbUtils.updateProperty(BIDARA_DB, CHAT_STORE_NAME, id, "active", INACTIVE_STATUS);
	}
}

export async function deleteThreadById(id) {
	await dbUtils.deleteByKey(BIDARA_DB, CHAT_STORE_NAME, id);
}
