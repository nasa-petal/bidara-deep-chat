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

const DB = BidaraDB();

function BidaraDB() {
	let BIDARA_DB = null;
	let created = false;

	return {
		get: async () => {
			if (BIDARA_DB) return BIDARA_DB;

			if (created) {
				BIDARA_DB = await dbUtils.openDB(BIDARA_DB_CONFIG.name, BIDARA_DB_CONFIG.version);
				return BIDARA_DB;
			}

			BIDARA_DB = await dbUtils.createDB(BIDARA_DB_CONFIG.name, BIDARA_DB_CONFIG.stores, BIDARA_DB_CONFIG.version);
			created = true;

			return BIDARA_DB;
		},
		close: async () => {
			if (!BIDARA_DB) return;

			await dbUtils.closeDB(BIDARA_DB);
			BIDARA_DB = null;
		}
	}
}

export async function getAllThreads() {
	const db = await DB.get();

	const threads = await dbUtils.readAll(db, CHAT_STORE_NAME, "created_time", true);

	await DB.close();

	return threads;
}

export async function getThreadById(id) {
	const db = await DB.get();

	const thread = await dbUtils.readByKey(db, CHAT_STORE_NAME, id);

	await DB.close();

	return thread;
}

export async function getActiveThread() {
	const db = await DB.get();

	const thread = await dbUtils.readFirstByIndex(db, CHAT_STORE_NAME, "active", true);

	await DB.close();

	return thread;
}

export async function getMostRecentlyCreatedThread() {
	const db = await DB.get();

	const thread = await dbUtils.readFirstByIndex(db, CHAT_STORE_NAME, "created_time", false);

	await DB.close();

	return thread;
}

export async function getMostRecentlyUpdatedThread() {
	const db = await DB.get();

	const thread = await dbUtils.readFirstByIndex(db, CHAT_STORE_NAME, "updated_time", true);

	await DB.close();

	return thread;
}

export async function getThreadFiles(threadId) {
	const db = await DB.get();

	const files = await dbUtils.readByProperty(db, FILE_STORE_NAME, "threadId", threadId);

	await DB.close();

	if (!files) {
		return [];
	}

	return files;
}

export async function getFileById(fileId) {
	const db = await DB.get();

	const file = await dbUtils.readByKey(db, FILE_STORE_NAME, fileId);

	await DB.close();

	return file;
}

export async function getEmptyThread(emptyLength) {
	const db = await DB.get();

	const emptyThread = await dbUtils.readFirstByIndex(db, CHAT_STORE_NAME, "length", false);

	await DB.close();

	if (emptyThread && emptyThread.length <= emptyLength) {
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

async function updateTimeById(id) {
	const db = await DB.get();

	const updated_time = Date.now();
	await dbUtils.updateProperty(db, CHAT_STORE_NAME, id, "update_time", updated_time)

	await DB.close();
}

export async function pushMessageToId(id, message) {
	const db = await DB.get();

	await dbUtils.pushToListProperty(db, CHAT_STORE_NAME, id, "messages", message,);

	const length = await getLengthById(id);
	await setLengthById(id, length + 1);
	await updateTimeById(id);

	await DB.close();
}

export async function pushFile(file) {
	const db = await DB.get();

	// { index: int, file: b64Data }
	await dbUtils.write(db, FILE_STORE_NAME, file);

	await DB.close();
}

export async function setThread(thread) {
	const db = await DB.get();

	await dbUtils.write(db, CHAT_STORE_NAME, thread);

	await DB.close();
}

export async function setMessagesById(id, messages) {
	const db = await DB.get();

	await dbUtils.updateProperty(db, CHAT_STORE_NAME, id, "messages", messages);

	await DB.close();
}

export async function setNameById(id, name) {
	const db = await DB.get();

	await dbUtils.updateProperty(db, CHAT_STORE_NAME, id, "name", name);

	await DB.close();
}

export async function setLengthById(id, length) {
	const db = await DB.get();

	await dbUtils.updateProperty(db, CHAT_STORE_NAME, id, "length", length);

	await DB.close();
}

export async function setAsstById(id, asst) {
	const db = await DB.get();

	await dbUtils.updateProperty(db, CHAT_STORE_NAME, id, "asst", asst);

	await DB.close();
}

export async function setActiveStatusById(id, status) {
	const db = await DB.get();

	if (status) {
		await dbUtils.updateProperty(db, CHAT_STORE_NAME, id, "active", ACTIVE_STATUS);

	} else {
		await dbUtils.updateProperty(db, CHAT_STORE_NAME, id, "active", INACTIVE_STATUS);
	}

	await DB.close();
}

export async function deleteThreadById(id) {
	const db = await DB.get();

	await dbUtils.deleteByKey(db, CHAT_STORE_NAME, id);

	await DB.close();
}
