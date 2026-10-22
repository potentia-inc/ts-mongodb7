import type { CommandOperationOptions, Db, Document, MongoClientOptions } from 'mongodb';
import { MongoClient } from 'mongodb';
export declare const TOPOLOGY_ERROR_CODES: ReadonlySet<number>;
export declare function isTopologyError(err: unknown): boolean;
export type RebuildingEvent = {
    reason?: unknown;
};
export type RebuiltEvent = {
    reason?: unknown;
    generation: number;
    error?: unknown;
};
export type RebuildOptions = {
    cooldown?: number;
    grace?: number;
    onRebuilding?: (event: RebuildingEvent) => void;
    onRebuilt?: (event: RebuiltEvent) => void;
};
export type ConnectionOptions = MongoClientOptions & {
    $onConnecting?: (client: MongoClient, generation: number) => void;
    $onConnected?: (client: MongoClient, generation: number, error?: unknown) => void;
    $rebuild?: false | RebuildOptions;
};
export declare class Connection {
    #private;
    get client(): MongoClient;
    get db(): Db;
    get generation(): number;
    constructor(uri: string, options?: ConnectionOptions);
    connect(): Promise<MongoClient>;
    disconnect(force?: boolean): Promise<void>;
    rebuild(reason?: unknown): Promise<boolean>;
    retry<T>(fn: () => Promise<T>, { retries }?: {
        retries?: number;
    }): Promise<T>;
    transaction<T>(fn: (options: CommandOperationOptions) => Promise<T>, options?: CommandOperationOptions): Promise<T>;
    migrate<Doc extends Document>({ name, validator, indexes, }: {
        name: string;
        validator?: Document;
        indexes?: Document;
    }): Promise<void>;
}
export declare function isTransactionError(err: unknown): boolean;
export declare function isDuplicationError(err: unknown): boolean;
