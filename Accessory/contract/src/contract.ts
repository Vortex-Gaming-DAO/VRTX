import { NearBindgen, NearPromise, AccountId, LookupMap, IntoStorageKey } from "near-sdk-js";
import { near, initialize, call, view, assert } from "near-sdk-js";
import { TokenId as NFTTokenId } from "near-contract-standards/lib/non_fungible_token/token";
import { Option } from "near-contract-standards/lib/non_fungible_token/utils";

class MTContractMetadata {
    spec: string; // required, essentially a version like "mt-1.0.0"
    name: string; // required Zoink's Digitial Sword Collection

    assert_valid() {
        
    }
}

class MTBaseTokenMetadata {
    name: string; // required, ex. "Silver Swords" or "Metaverse 3"
    id: string; // required a unique identifier for the metadata
    symbol: string | null; // required, ex. "MOCHI"
    icon: string | null; // Data URL
    decimals: string | null; // number of decimals for the token useful for FT related tokens
    base_uri: string | null; // Centralized gateway known to have reliable access to decentralized storage assets referenced by `reference` or `media` URLs
    reference: string | null; // URL to a JSON file with more info
    copies: number | null; // number of copies of this set of metadata in existence when token was minted.
    reference_hash: string | null; // Base64-encoded sha256 hash of JSON from reference field. Required if `reference` is included.
}

class MTTokenMetadata {
    title: string | null; // ex. "Arch Nemesis: Mail Carrier" or "Parcel #5055"
    description: string | null; // free-form description
    media: string | null; // URL to associated media, preferably to decentralized, content-addressed storage
    media_hash: string | null; // Base64-encoded sha256 hash of content referenced by the `media` field. Required if `media` is included.
    issued_at: string | null; // When token was issued or minted, Unix epoch in milliseconds
    expires_at: string | null; // When token expires, Unix epoch in milliseconds
    starts_at: string | null; // When token starts being valid, Unix epoch in milliseconds
    updated_at: string | null; // When token was last updated, Unix epoch in milliseconds
    extra: string | null; // Anything extra the MT wants to store on-chain. Can be stringified JSON.
    reference: string | null; // URL to an off-chain JSON file with more info.
    reference_hash: string | null; // Base64-encoded sha256 hash of JSON from reference field. Required if `reference` is included.
}

class MTTokenMetadataAll {
    base: MTBaseTokenMetadata;
    token: MTTokenMetadata;

    constructor() {
        this.base = new MTBaseTokenMetadata();
        this.token = new MTTokenMetadata();
    }
}

class Token {
    token_id: string;
    owner_id: string | null;
}

/* Events */

type MtEvent = "mt_mint" | "mt_burn" | "mt_transfer";

interface MtEventLogData {
    EVENT_JSON: {
        standard: "nep245",
        version: "1.0.0",
        event: MtEvent,
        data: MtMintLog[] | MtBurnLog[] | MtTransferLog[]
    }
}

interface MtMintLog {
    owner_id: string,
    token_ids: string[],
    amounts: string[],
    memo?: string
}

interface MtBurnLog {
    owner_id: string,
    authorized_id?: string,
    token_ids: string[],
    amounts: string[],
    memo?: string
}

interface MtTransferLog {
    authorized_id?: string,
    old_owner_id: string,
    new_owner_id: string,
    token_ids: string[],
    amounts: string[],
    memo?: string
}

/* storages */

class StorageKey {}

class StorageKeyTokenBalance extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "TOKEN_BALANCE_";
    }
}

class StorageKeyTokenMetadata extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "TOKEN_METADATA_";
    }
}

class StorageKeyTokenSupply extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "TOKEN_SUPPLY_";
    }
}

class StorageKeyMinter extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "MINTER_";
    }
}

@NearBindgen({ requireInit: true })
class Accessory {
    private owner_id: AccountId;
    private metadata: Option<MTContractMetadata>;
    private token_balances: LookupMap<bigint>;
    private token_metadata: LookupMap<MTTokenMetadata>;
    private token_supplies: LookupMap<bigint>;
    private minters: LookupMap<boolean>;

    constructor() {
        this.owner_id = "";
        this.metadata = new MTContractMetadata();
        this.token_balances = new LookupMap("");
        this.token_metadata = new LookupMap("");
        this.token_supplies = new LookupMap("");
        this.minters = new LookupMap("");
    }

    @initialize({ requireInit: true })
    init({ owner_id, metadata }: {
        owner_id: string;
        metadata: MTContractMetadata;
    }): void {
        this.owner_id = owner_id;
        this.metadata = Object.assign(this.metadata, metadata);
        this.metadata.assert_valid();
        this.token_balances = new LookupMap(new StorageKeyTokenBalance().into_storage_key());
        this.token_metadata = new LookupMap(new StorageKeyTokenMetadata().into_storage_key());
        this.token_supplies = new LookupMap(new StorageKeyTokenSupply().into_storage_key());
        this.minters = new LookupMap(new StorageKeyMinter().into_storage_key());
        this.minters.set(owner_id, true);
    }

    @call({ payableFunction: true })
    mt_mint({ token_ids, amounts, token_owner_id }: {
        token_ids: string[],
        amounts: (string | number)[],
        token_owner_id: AccountId
    }): void {
        const sender_id = near.signerAccountId();
        assert(this.minters.get(sender_id), "Sender is not a minter");

        for (let index = 0; index < token_ids.length; ++index) {
            const token_owner_key = `${token_owner_id}:${token_ids[index]}`;
            const balance = this.token_balances.get(token_owner_key, { defaultValue: BigInt(0) });
            const supply = this.token_supplies.get(token_ids[index], { defaultValue: BigInt(0) });

            this.token_balances.set(token_owner_key, balance + BigInt(amounts[index]));
            this.token_supplies.set(token_ids[index], supply + BigInt(amounts[index]));
        }
    }

    @call({})
    mt_lock({ nft_token_id, token_owner_id, token_ids, amounts }: {
        nft_token_id: NFTTokenId,
        token_owner_id: AccountId,
        token_ids: string[],
        amounts:  (string | number)[] /* bigint */
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(this.minters.get(sender_id), "Sender is not a minter");

        for (let index = 0; index < token_ids.length; ++index) {
            const token_receiver_key = `nft:${nft_token_id}:${token_ids[index]}`;
            const token_sender_key   = `${token_owner_id}:${token_ids[index]}`;

            const amount_to_transfer = BigInt(amounts[index]);
            assert(this.token_balances.get(token_sender_key, { defaultValue: BigInt(0) }) >= amount_to_transfer, "Insufficient balance");
    
            this.token_balances.set(token_sender_key, this.token_balances.get(token_sender_key, { defaultValue: BigInt(0) }) - amount_to_transfer);
            this.token_balances.set(token_receiver_key, this.token_balances.get(token_receiver_key, { defaultValue: BigInt(0) }) + amount_to_transfer);
        }
    }

    @call({})
    mt_unlock({ nft_token_id, token_owner_id, token_ids, amounts }: {
        nft_token_id: NFTTokenId,
        token_owner_id: AccountId,
        token_ids: string[],
        amounts:  (string | number)[] /* bigint */
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(this.minters.get(sender_id), "Sender is not a minter");

        for (let index = 0; index < token_ids.length; ++index) {
            const token_sender_key   = `nft:${nft_token_id}:${token_ids[index]}`;
            const token_receiver_key = `${token_owner_id}:${token_ids[index]}`;

            const amount_to_transfer = BigInt(amounts[index]);
            assert(this.token_balances.get(token_sender_key, { defaultValue: BigInt(0) }) >= amount_to_transfer, "Insufficient balance");
    
            this.token_balances.set(token_sender_key, this.token_balances.get(token_sender_key, { defaultValue: BigInt(0) }) - amount_to_transfer);
            this.token_balances.set(token_receiver_key, this.token_balances.get(token_receiver_key, { defaultValue: BigInt(0) }) + amount_to_transfer);
        }
    }

    @call({})
    mt_transfer({ receiver_id, token_id, amount, approval, memo }: {
        receiver_id: AccountId,
        token_id: string,
        amount: string | number /* bigint */
        approval: [ owner_id: AccountId, approval_id: number ] | null,
        memo: string | null
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(this.minters.get(sender_id), "Sender is not a minter");

        const token_receiver_key = `${receiver_id}:${token_id}`;
        const token_sender_key   = `${sender_id}:${token_id}`;
    
        const amount_to_transfer = BigInt(amount);
        assert(this.token_balances.get(token_sender_key) >= amount_to_transfer, "Insufficient balance");

        this.token_balances.set(token_sender_key, this.token_balances.get(token_sender_key) - amount_to_transfer);
        this.token_balances.set(token_receiver_key, this.token_balances.get(token_receiver_key) + amount_to_transfer);
    }

    @call({})
    mt_batch_transfer({ receiver_id, token_ids, amounts, approvals, memo }: {
        receiver_id: AccountId,
        token_ids: string[],
        amounts: (string | number)[] /* array of bigint */
        approvals: ([ owner_id: AccountId, approval_id: number ] | null)[],
        memo: string | null
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(this.minters.get(sender_id), "Sender is not a minter");

        for (let index = 0; index < token_ids.length; ++index) {
            const token_receiver_key = `${receiver_id}:${token_ids[index]}`;
            const token_sender_key   = `${sender_id}:${token_ids[index]}`;

            const amount_to_transfer = BigInt(amounts[index]);
            assert(this.token_balances.get(token_sender_key) >= amount_to_transfer, "Insufficient balance");
    
            this.token_balances.set(token_sender_key, this.token_balances.get(token_sender_key) - amount_to_transfer);
            this.token_balances.set(token_receiver_key, this.token_balances.get(token_receiver_key) + amount_to_transfer);
        }
    }

    @call({})
    mt_transfer_call({ receiver_id, token_id, amount, approval, memo, msg }: {
        receiver_id: AccountId,
        token_id: string,
        amount: string | number /* bigint */
        approval: [ owner_id: AccountId, approval_id: number ] | null,
        memo: string | null,
        msg: string
    }): NearPromise {
        const sender_id = near.predecessorAccountId();
        assert(this.minters.get(sender_id), "Sender is not a minter");

        return NearPromise.new(receiver_id);
    }

    @call({})
    mt_batch_transfer_call({ receiver_id, token_ids, amounts, approvals, memo, msg }: {
        receiver_id: AccountId,
        token_ids: string[],
        amounts: (string | number)[] /* array of bigint */
        approvals: ([ owner_id: AccountId, approval_id: number ] | null)[],
        memo: string | null,
        msg: string
    }): NearPromise {
        const sender_id = near.predecessorAccountId();
        assert(this.minters.get(sender_id), "Sender is not a minter");

        return NearPromise.new(receiver_id);
    }

    @view({})
    mt_metadata_contract(): MTContractMetadata {
        assert(this.metadata !== null, "Metadata not initialized");

        return this.metadata;
    }

    @view({})
    mt_metadata_token_all({ token_ids }: {
        token_ids: string[]
    }): MTTokenMetadataAll[] {
        return [];
    }

    @view({})
    mt_metadata_token_by_token_id({ token_ids }: {
        token_ids: string[]
    }): MTTokenMetadata[] {
        return [];
    }

    @view({})
    mt_metadata_base_by_token_id({ token_ids }: {
        token_ids: string[]
    }): MTBaseTokenMetadata[] {
        return [];
    }

    @view({})
    mt_metadata_base_by_metadata_id({ base_metadata_ids }: {
        base_metadata_ids: string[]
    }): MTBaseTokenMetadata[] {
        return [];
    }

    @view({})
    mt_tokens_base_metadata_all({ from_index, limit }: {
        from_index: string | null,
        limit: number | null
    }): MTBaseTokenMetadata[] {
        return [];
    }

    @view({})
    mt_token({ token_ids }: {
        token_ids: string[]
    }): (Token | null)[] {
        return null;
    }

    @view({})
    mt_tokens({ from_index, limit }: {
        from_index: string | null,
        limit: number | null
    }): Token[] {
        return [];
    }

    @view({})
    mt_balance_of({ account_id, token_id }: {
        account_id: AccountId,
        token_id: string
    }): bigint {
        const token_owner_key = `${account_id}:${token_id}`;
        return this.token_balances.get(token_owner_key, { defaultValue: BigInt(0) });
    }

    @view({})
    mt_batch_balance_of({ account_id, token_ids }: {
        account_id: AccountId,
        token_ids: string[]
    }): bigint[] {
        return token_ids.map((token_id) => {
            const token_owner_key = `${account_id}:${token_id}`;
            return this.token_balances.get(token_owner_key, { defaultValue: BigInt(0) });
        });
    }

    @view({})
    mt_locked_balance_of({ nft_token_id, token_id }: {
        nft_token_id: NFTTokenId,
        token_id: string
    }): bigint {
        const token_owner_key = `nft:${nft_token_id}:${token_id}`;
        return this.token_balances.get(token_owner_key, { defaultValue: BigInt(0) });
    }

    @view({})
    mt_batch_locked_balance_of({ nft_token_id, token_ids }: {
        nft_token_id: NFTTokenId,
        token_ids: string[]
    }): bigint[] {
        return token_ids.map((token_id) => {
            const token_owner_key = `nft:${nft_token_id}:${token_id}`;
            return this.token_balances.get(token_owner_key, { defaultValue: BigInt(0) });
        });
    }

    @view({})
    mt_supply({ token_id }: {
        token_id: string
    }): bigint {
        return this.token_supplies.get(token_id, { defaultValue: BigInt(0) });
    }

    @view({})
    mt_batch_supply({ token_ids }: {
        token_ids: string[]
    }): bigint[] {
        return token_ids.map((token_id) => {
            return this.token_supplies.get(token_id, { defaultValue: BigInt(0) });
        });
    }

    /* minter management */

    @call({})
    add_minter({ account_id }: {
        account_id: AccountId
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(!this.minters.get(account_id), "Account is already minter");

        this.minters.set(account_id, true);
    }

    @call({})
    remove_minter({ account_id }: {
        account_id: AccountId
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(this.minters.get(account_id), "Account is not a minter");

        this.minters.set(account_id, false);
    }

    @view({})
    is_minter({ account_id }: {
        account_id: AccountId
    }): boolean {
        return this.minters.get(account_id);
    }

    /* metadata management */

    @call({})
    update_metadata({ metadata }: {
        metadata: MTContractMetadata
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");

        this.metadata = metadata;
        this.metadata.assert_valid();
    }

    @call({})
    update_token_metadata({ token_id, token_metadata }: {
        token_id: string,
        token_metadata: MTTokenMetadata
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(this.minters.get(sender_id), "Sender is not a minter");

        //
    }

    /* private functions */
}
