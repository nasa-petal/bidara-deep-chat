export async function openDB(name, stores, version) {
  return new Promise((resolve, reject) => {

    const request = indexedDB.open(name, version)

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      stores.forEach((store) => {
				createStore(event, db, store.name, store.primaryKey, store.indices);
      });
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    }

    request.onerror = (event) => {
      const error = event.target.error;
      reject(error);
    }
  });
}

function createStore(event, db, name, primaryKey, indices) {
	if (db.objectStoreNames.contains(name)) {
		const existingStore = event.currentTarget.transaction.objectStore(name);
		if (storeIsUpdated(existingStore, primaryKey, indices)) {
			return;
		} 

		db.deleteObjectStore(name);
	}

  const objectStore = db.createObjectStore(name, { keyPath: primaryKey });

  if (indices) {
    indices.forEach((index) => {
      objectStore.createIndex(index.name, index.property, index.options);
    });
  }
}

function storeIsUpdated(objectStore, primaryKey, indices) {
	if (!objectStore.keyPath || objectStore.keyPath !== primaryKey) {
		return false;
	}

	indices.forEach((index) => {
		if (!objectStore.indexNames.contains(index.name)) {
			return false;
		}
	})

	return true;
}

export async function readByKey(db, storeName, key, transaction = null, callback = null) {
  return new Promise((resolve, reject) => {
		if (!transaction) {
			transaction = db.transaction([storeName], 'readonly');
		}
    const objectStore = transaction.objectStore(storeName);

    const getRequest = objectStore.get(key);

    getRequest.onsuccess = (event) => {
      const result = event.target.result;
      resolve(result);
    }

    getRequest.onerror = (event) => {
      const error = event.target.error;
      reject(error);
    }

		if (typeof callback === 'function') {
			callback(transaction);
		}
  });
}

export async function readAll(db, storeName, storeIndex = null, reversed = null, transaction = null, callback = null) {
  return new Promise((resolve, reject) => {
		if (!transaction) {
			transaction = db.transaction([storeName], 'readonly');
		}
    const objectStore = transaction.objectStore(storeName);

		let store;

		if (storeIndex) {
			store = objectStore.index(storeIndex);

		} else {
			store = objectStore;
		}

    const getRequest = store.getAll();

    getRequest.onsuccess = (event) => {
      const result = event.target.result;

			if (reversed) {
				result.reverse();
			}

      resolve(result);
    }

    getRequest.onerror = (event) => {
      const error = event.target.error;
      reject(error);
    }

		if (typeof callback === 'function') {
			callback(transaction);
		}
  });
}

export async function readByProperty(db, storeName, propertyKey, propertyValue, storeIndex = null, reversed = null, transaction = null, callback = null) {
  return new Promise((resolve, reject) => {
		if (!transaction) {
			transaction = db.transaction([storeName], 'readonly');
		}
    const objectStore = transaction.objectStore(storeName);

    let store;
    if (storeIndex) {
      store = objectStore.index(storeIndex);
    } else {
			store = objectStore;
    }

		const cursorRequest = reversed ? store.openCursor(null, 'prev') : store.openCursor();
		let skipFirst = reversed; 

    const matchedItems = [];
    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
				// Cursor always starts at beginning of db.
				// Reversed should skip and go to next (which will be the last)
				if (skipFirst) {
					cursor.continue();
					skipFirst = false;
				}

				if (cursor.value.hasOwnProperty(propertyKey) && cursor.value[propertyKey] === propertyValue) {
					matchedItems.push(cursor.value);
				}
				cursor.continue();
			} else {
				resolve(matchedItems);
			}
		};

    transaction.onerror = (event) => {
      const error = event.target.error;
      reject(error); }
  });

		if (typeof callback === 'function') {
			callback(transaction);
		}
}

export async function readFirstByIndex(db, storeName, storeIndex, reversed, transaction = null, callback = null) {
	return new Promise((resolve, reject) => {
		if (!transaction) {
			transaction = db.transaction([storeName], 'readonly');
		}
    const objectStore = transaction.objectStore(storeName);

		const index = objectStore.index(storeIndex);

		// 'prev' tells cursor what direction `cursor.continue()` will go
		const cursorRequest = reversed ? index.openCursor(null, 'prev') : index.openCursor();
		let skipFirst = reversed; 

    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
				// Cursor always starts at beginning of db.
				// Reversed should skip and go to next (which will be the last)
				if (skipFirst) {
					cursor.continue();
					skipFirst = false;
				}

				resolve(cursor.value)
			} 
			resolve(null);
		};

    transaction.onerror = (event) => {
      const error = event.target.error;
      reject(error);
		}

		if (typeof callback === 'function') {
			callback(transaction);
		}
  });

}

export async function write(db, storeName, value, transaction = null, callback = null) {
  return new Promise((resolve, reject) => {
		if (!transaction) {
			transaction = db.transaction([storeName], 'readwrite');
		}
    const objectStore = transaction.objectStore(storeName);

		const now = Date.now();
		if (!value?.created_time) {
			value.created_time = now;
		}
		value.updated_time = now;

    const putRequest = objectStore.put(value);

    putRequest.onsuccess = (event) => {
      resolve();
    }

    putRequest.onerror = (event) => {
      const error = event.target.error;
      reject(error);
    }

		if (typeof callback === 'function') {
			callback(transaction);
		}
  });
}

export async function deleteByKey(db, storeName, key, transaction = null, callback = null) {
	return new Promise((resolve, reject) => {
		if (!transaction) {
			transaction = db.transaction([storeName], 'readwrite');
		}
		const objectStore = transaction.objectStore(storeName);

		const deleteRequest = objectStore.delete(key);

		deleteRequest.onsuccess = (event) => {
			resolve();
		}

		deleteRequest.onerror = (event) => {
			const error = event.target.error;
			reject(error);
		}

		if (typeof callback === 'function') {
			callback(transaction);
		}
	});
}

export async function updateProperty(db, storeName, key, propertyKey, propertyValue, transaction = null, callback = null) {
  // Did not reuse for transaction purposes. 
  // This way, the read and write happens as one transaction
  return new Promise((resolve, reject) => {
		if (!transaction) {
			transaction = db.transaction([storeName], 'readwrite');
		}
    const objectStore = transaction.objectStore(storeName);

    const getRequest = objectStore.get(key);

    // Successful get, so update and write back
    getRequest.onsuccess = (event) => {
      const result = event.target.result;

      // Ensure resulting object has desired property. 
      // Would error anyways, but gives a better message
      if (!result.hasOwnProperty(propertyKey)) {
				reject(`Object has no property: '${propertyKey}' (in store: ${storeName} by key: '${result}')`);
      }

      result[propertyKey] = propertyValue;

      const putRequest = objectStore.put(result);

      // Successfully wrote updated object back to db
      putRequest.onsuccess = (event) => {
				resolve();
      }

      putRequest.onerror = (event) => {
				const error = event.target.error;
				reject(error);
      }
    }

    getRequest.onerror = (event) => {
      const error = event.target.error;
      reject(error);
    }

		if (typeof callback === 'function') {
			callback(transaction);
		}
  });
}

// Made into own function because updating list will happen very frequently, 
// and would rather it be one transaction
export async function pushToListProperty(db, storeName, key, listPropertyKey, appendValue, transaction = null, callback = null) {
  // Did not reuse for transaction purposes. 
  // This way, the read and write happens as one transaction
  return new Promise((resolve, reject) => {
		if (!transaction) {
			transaction = db.transaction([storeName], 'readwrite');
		}
    const objectStore = transaction.objectStore(storeName);

    const getRequest = objectStore.get(key);

    // Successful get, so update and write back
    getRequest.onsuccess = (event) => {
      const result = event.target.result;

      // Ensure resulting object has desired property. 
      // Would error anyways, but gives a better message
      if (!result.hasOwnProperty(listPropertyKey)) {
				reject(`Object has no property: '${listPropertyKey}' (in store: ${storeName} by key: '${result}')`);
      }
      // Ensure resulting object property is a list. 
      // Would error anyways, but gives a better message
      if (!Array.isArray(result[listPropertyKey])) {
				reject(`Object property is not list: '${listPropertyKey}' (in store: ${storeName} by key: '${result}')`);
      }

      result[listPropertyKey].push(appendValue);

      // Unsure if these truly belong here, but for our current use case they do
      if (result.hasOwnProperty("length")) {
				result.length += 1;
      }
			if (result.hasOwnProperty("updated_time")) {
				result.updated_time = Date.now();
			}

      const putRequest = objectStore.put(result);

      putRequest.onsuccess = (event) => {
				resolve();
      }

      putRequest.onerror = (event) => {
				const error = event.target.error;
				reject(error);
      }
    }

    getRequest.onerror = (event) => {
      const error = event.target.error;
      reject(error);
    }

		if (typeof callback === 'function') {
			callback(transaction);
		}
  });
}
