import { NearBindgen, NearPromise, AccountId, LookupMap, IntoStorageKey, validateAccountId } from "near-sdk-js";
import { near, initialize, call, view, assert } from "near-sdk-js";
import { TokenMetadata as NFTTokenMetadata } from "near-contract-standards/lib/non_fungible_token/metadata";
import { NearEvent } from "near-contract-standards/lib/event";

const TEN_TGAS       = BigInt( "10000000000000");
const TWENTY_TGAS    = BigInt( "20000000000000");
const THIRTY_TGAS    = BigInt( "30000000000000");
const FOURTY_TGAS    = BigInt( "40000000000000");
const FIFTY_TGAS     = BigInt( "50000000000000");
const SIXTY_TGAS     = BigInt( "60000000000000");
const SEVENTY_TGAS   = BigInt( "70000000000000");
const EIGHTY_TGAS    = BigInt( "80000000000000");
const NINETY_TGAS    = BigInt( "90000000000000");
const HUNDRED_TGAS   = BigInt("100000000000000");
const NO_DEPOSIT     = BigInt(0);
const DEPOSIT_1YOCTO = BigInt(1);
const NO_ARGS        = JSON.stringify({});

class StorageKey {}

class StorageKeyOracle extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "ORACLE_";
    }
}

//#region Events
class CustomEventV1 extends NearEvent {
        standard: string
        version: string
        event: string
        data: any
    constructor(event: string, data: any) {
        super()
        this.standard = "VRTX-Composition"
        this.version = "1.0.0"
        this.event = event
        this.data = data
    }
}

//#endregion

@NearBindgen({ requireInit: true })
class Composition {
    private owner_id: AccountId;
    private oracles: LookupMap<boolean>;
    private nft_contract_id: AccountId;
    private mt_contract_id: AccountId;

    constructor() {
        this.owner_id = "";
        this.oracles = new LookupMap("");
        this.nft_contract_id = "";
        this.mt_contract_id = "";
    }

    @initialize({ requireInit: true })
    init({ owner_id }: {
        owner_id: AccountId;
    }): void {
        assert(near.predecessorAccountId() === 'vrtxnft.vrtx', "Initial Owner ID is invalid");
        this.owner_id = owner_id;
        this.oracles = new LookupMap(new StorageKeyOracle().into_storage_key());
        this.oracles.set(owner_id, true);
    }

    /* oracle management */

    @call({})
    add_oracle({ account_id }: {
        account_id: AccountId
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(!this.oracles.get(account_id), "Account is already minter");
        assert(validateAccountId(account_id), "Account ID is invalid");

        this.oracles.set(account_id, true);

        new CustomEventV1("AddOracle", { account_id }).emit();
    }

    @call({})
    remove_oracle({ account_id }: {
        account_id: AccountId
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(this.oracles.get(account_id), "Account is not a minter");
        assert(validateAccountId(account_id), "Account ID is invalid");

        this.oracles.set(account_id, false);
        new CustomEventV1("RevekeOracle", { account_id }).emit();
    }

    @view({})
    is_oracle({ account_id }: {
        account_id: AccountId
    }): boolean {
        return this.oracles.get(account_id);
    }

    /* admin functions */

    @call({})
    set_nft_contract({ contract_id }: {
        contract_id: AccountId
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(validateAccountId(contract_id), "Contract ID is invalid");

        this.nft_contract_id = contract_id;

        new CustomEventV1("SetNftContract", {contract_id}).emit();
    }

    @view({})
    get_nft_contract(): AccountId {
        return this.nft_contract_id;
    }

    @call({})
    set_mt_contract({ contract_id }: {
        contract_id: AccountId
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(validateAccountId(contract_id), "Contract ID is invalid");

        this.mt_contract_id = contract_id;
        new CustomEventV1("SetMtContract", {contract_id}).emit();
    }

    @view({})
    get_mt_contract(): AccountId {
        return this.mt_contract_id;
    }

    /* user functions */

    @call({})
    update_nft({ nft_token_id, nft_token_owner_id, mt_lock_token_ids, mt_lock_amounts, mt_unlock_token_ids, mt_unlock_amounts, nft_token_metadata }: {
        nft_token_id: AccountId,
        nft_token_owner_id: AccountId,
        mt_lock_token_ids: string[],
        mt_lock_amounts: (string | number)[],
        mt_unlock_token_ids: string[],
        mt_unlock_amounts: (string | number)[],
        nft_token_metadata: NFTTokenMetadata
    }): NearPromise {
        const sender_id = near.signerAccountId();
        assert(this.oracles.get(sender_id), "Sender is not a oracle");
        assert(validateAccountId(nft_token_owner_id), "NFT Token Owner ID is invalid");
        assert(this.valid_bigint({ value: nft_token_id }), `NFT Token ID '${nft_token_id}' is not a valid number`);
        assert(Array.isArray(mt_lock_token_ids) && Array.isArray(mt_lock_amounts), "mt_lock_token_ids and mt_lock_amounts must be an array.");
        assert(mt_lock_token_ids.length === mt_lock_amounts.length, "The length of lock_token_ids and mt_lock_amounts must be the same.");
        assert(Array.isArray(mt_unlock_token_ids) && Array.isArray(mt_unlock_amounts), "mt_unlock_token_ids and mt_unlock_amounts must be an array.");
        assert(mt_unlock_token_ids.length === mt_unlock_amounts.length, "The length of mt_unlock_token_ids and mt_unlock_amounts must be the same.");

        for (let index = 0; index < mt_lock_token_ids.length; ++index) {
            const token_id = mt_lock_token_ids[index];
            const amount = mt_lock_amounts[index];
            assert(this.valid_bigint({ value: token_id }), `MT Lock Token ID '${token_id}' is not a valid number`);
            assert(this.valid_bigint({ value: amount }), `MT Lock Amount '${amount}' is not a valid number`);
            assert(BigInt(amount) > 0, `MT Lock amount must be positive`);
        }
        for (let index = 0; index < mt_unlock_token_ids.length; ++index) {
            const token_id = mt_unlock_token_ids[index];
            const amount = mt_unlock_amounts[index];
            assert(this.valid_bigint({ value: token_id }), `MT Unlock Token ID '${token_id}' is not a valid number`);
            assert(this.valid_bigint({ value: amount }), `MT Unlock Amount '${amount}' is not a valid number`);
            assert(BigInt(amount) > 0, `MT Unlock amount must be positive`);
        }

        const TOTAL_REQUIRED_GAS = TWENTY_TGAS + TWENTY_TGAS + TWENTY_TGAS + TWENTY_TGAS + TWENTY_TGAS + TWENTY_TGAS + FIFTY_TGAS;
        assert(near.prepaidGas() >= TOTAL_REQUIRED_GAS, `Not enough prepaid gas for cross-contract calls.`);

        const promise = 
            NearPromise.new(this.mt_contract_id)
                .functionCall(
                    "mt_lock_and_unlock", 
                    JSON.stringify({ 
                        nft_token_id: nft_token_id, 
                        token_owner_id: nft_token_owner_id, 
                        lock_token_ids: mt_lock_token_ids,
                        lock_amounts: mt_lock_amounts,
                        unlock_token_ids: mt_unlock_token_ids, 
                        unlock_amounts: mt_unlock_amounts 
                    }),
                    NO_DEPOSIT,
                    TWENTY_TGAS
                )
            .then(NearPromise.new(near.currentAccountId())
                .functionCall(
                    "mt_lock_and_unlock_callback",
                    JSON.stringify({
                        nft_token_id,
                        nft_token_owner_id,
                        mt_lock_token_ids,
                        mt_lock_amounts,
                        mt_unlock_token_ids,
                        mt_unlock_amounts,
                        nft_token_metadata
                    }),
                    NO_DEPOSIT,
                    TWENTY_TGAS + TWENTY_TGAS + TWENTY_TGAS + TWENTY_TGAS + TWENTY_TGAS
                )
            );

        return promise.asReturn();
    }

    @call({ privateFunction: true})
    mt_lock_and_unlock_callback({ nft_token_id, nft_token_owner_id, mt_lock_token_ids, mt_lock_amounts, mt_unlock_token_ids, mt_unlock_amounts, nft_token_metadata }: {
        nft_token_id: AccountId,
        nft_token_owner_id: AccountId,
        mt_lock_token_ids: string[],
        mt_lock_amounts: (string | number)[],
        mt_unlock_token_ids: string[],
        mt_unlock_amounts: (string | number)[],
        nft_token_metadata: NFTTokenMetadata
    }) {
        try {
            near.promiseResult(0);

            const promise = 
                NearPromise.new(this.nft_contract_id)
                    .functionCall(
                        "update_token_metadata", 
                        JSON.stringify({ 
                            token_id: nft_token_id, 
                            token_metadata: nft_token_metadata 
                        }), 
                        NO_DEPOSIT, 
                        TWENTY_TGAS
                    )
                .then(NearPromise.new(near.currentAccountId())
                    .functionCall(
                        "update_token_metadata_callback", 
                        JSON.stringify({
                            nft_token_id,
                            nft_token_owner_id,
                            mt_lock_token_ids,
                            mt_lock_amounts,
                            mt_unlock_token_ids,
                            mt_unlock_amounts,
                            nft_token_metadata
                        }),
                        NO_DEPOSIT,
                        TWENTY_TGAS + TWENTY_TGAS + TWENTY_TGAS
                    )
                );
            return promise.asReturn();
        } catch {
            return false;
        }
    }

    @call({ privateFunction: true})
    update_token_metadata_callback({ nft_token_id, nft_token_owner_id, mt_lock_token_ids, mt_lock_amounts, mt_unlock_token_ids, mt_unlock_amounts, nft_token_metadata }: {
        nft_token_id: AccountId,
        nft_token_owner_id: AccountId,
        mt_lock_token_ids: string[],
        mt_lock_amounts: (string | number)[],
        mt_unlock_token_ids: string[],
        mt_unlock_amounts: (string | number)[],
        nft_token_metadata: NFTTokenMetadata
    }) {
        try {
            near.promiseResult(0);
            new CustomEventV1("UpdateNft", {nft_token_id, nft_token_owner_id, mt_lock_token_ids, mt_lock_amounts, mt_unlock_token_ids, mt_unlock_amounts, nft_token_metadata}).emit();
        } catch {
            const promise = 
            NearPromise.new(this.mt_contract_id)
                .functionCall(
                    "mt_lock_and_unlock", 
                    JSON.stringify({ 
                        nft_token_id: nft_token_id, 
                        token_owner_id: nft_token_owner_id, 
                        lock_token_ids: mt_unlock_token_ids,
                        lock_amounts: mt_unlock_amounts,
                        unlock_token_ids: mt_lock_token_ids, 
                        unlock_amounts: mt_lock_amounts
                    }),
                    NO_DEPOSIT,
                    TWENTY_TGAS
                )
            .then(NearPromise.new(near.currentAccountId())
                .functionCall(
                    "mt_lock_and_unlock_rollback_callback",
                    JSON.stringify({
                        nft_token_id,
                        nft_token_owner_id,
                        mt_lock_token_ids,
                        mt_lock_amounts,
                        mt_unlock_token_ids,
                        mt_unlock_amounts,
                        nft_token_metadata
                    }),
                    NO_DEPOSIT,
                    TWENTY_TGAS
                )
            );
            return promise.asReturn();
        }
        return true;
    }

    @call({ privateFunction: true})
    mt_lock_and_unlock_rollback_callback({ nft_token_id, nft_token_owner_id, mt_lock_token_ids, mt_lock_amounts, mt_unlock_token_ids, mt_unlock_amounts, nft_token_metadata }: {
        nft_token_id: AccountId,
        nft_token_owner_id: AccountId,
        mt_lock_token_ids: string[],
        mt_lock_amounts: (string | number)[],
        mt_unlock_token_ids: string[],
        mt_unlock_amounts: (string | number)[],
        nft_token_metadata: NFTTokenMetadata
    }) {
        try {
            near.promiseResult(0);
            return true;
        } catch {
            new CustomEventV1("UpdateNftRollbackFail", {nft_token_id, nft_token_owner_id, mt_lock_token_ids, mt_lock_amounts, mt_unlock_token_ids, mt_unlock_amounts, nft_token_metadata}).emit();
            return false;
        }
    }

    valid_bigint({ value }: { value: string | number }): boolean {
        try {
            BigInt(value);
            return true;
        } catch {
            return false;
        }
    }
}
