import { MongoClient, MongoError, } from 'mongodb';
import { ConflictError, DisconnectedError, TransactionError } from './error.js';
export class Connection {
    #client = undefined;
    #uri;
    #options;
    get client() {
        if (this.#client === undefined)
            throw new DisconnectedError();
        return this.#client;
    }
    get db() {
        return this.client.db();
    }
    constructor(uri, options) {
        this.#uri = uri;
        this.#options = options;
    }
    async connect() {
        if (this.#client === undefined) {
            const client = await MongoClient.connect(this.#uri, this.#options);
            ['error', 'timeout', 'parseError'].forEach((event) => {
                client.on(event, (...args) => console.error(`db event ${event}: ${JSON.stringify(args)}`));
            });
            if (this.#client === undefined)
                this.#client = client;
            else
                client.close().catch(console.error);
        }
        return this.#client;
    }
    async disconnect(force = false) {
        if (this.#client !== undefined) {
            const client = this.#client;
            this.#client = undefined;
            await client.close(force);
        }
    }
    async transaction(fn, options = {}) {
        if (options?.session !== undefined)
            return await fn(options);
        const session = this.client.startSession();
        try {
            return await session.withTransaction(async (session) => await fn({ ...options, session }));
        }
        catch (err) {
            if (isDuplicationError(err))
                throw new ConflictError();
            if (isTransactionError(err))
                throw new TransactionError();
            throw err;
        }
        finally {
            await session.endSession();
        }
    }
    async migrate({ name, validator, indexes = {}, }) {
        const collection = await (async () => {
            try {
                return await this.db.createCollection(name);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            }
            catch (err) {
                return this.db.collection(name);
            }
        })();
        // drop the removed indexes
        const names = (await collection.listIndexes().toArray())
            .map(({ name }) => name)
            .filter((name) => !(name === '_id_' || name in indexes));
        for (const name of names)
            await collection.dropIndex(name);
        // create/update the current index
        for (const name of Object.keys(indexes)) {
            const { keys, options = {} } = indexes[name];
            try {
                // try to create the index
                await collection.createIndex(keys, { name, ...options });
            }
            catch (err) {
                // if fails, drop it and try it again
                console.warn('fail to create index:', err);
                try {
                    await collection.dropIndex(name);
                }
                catch (err) {
                    console.warn('fail to drop index:', err);
                }
                await collection.createIndex(keys, { name, ...options });
            }
        }
        // update the validator
        if (validator !== undefined) {
            await this.db.command({
                collMod: name,
                validator,
                validationLevel: 'strict',
                validationAction: 'error',
            });
        }
    }
}
export function isTransactionError(err) {
    return (err instanceof MongoError &&
        err.errorLabels !== undefined &&
        Array.isArray(err.errorLabels) &&
        err.errorLabels.includes('TransientTransactionError'));
}
export function isDuplicationError(err) {
    return err instanceof MongoError && err.code === 11000;
}
//# sourceMappingURL=connection.js.map