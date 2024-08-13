import { NearBindgen, NearPromise, AccountId, LookupMap, IntoStorageKey, validateAccountId } from "near-sdk-js";
import { near, initialize, call, view, assert } from "near-sdk-js";
import { TokenMetadata as NFTTokenMetadata } from "near-contract-standards/lib/non_fungible_token/metadata";

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

        const promise = NearPromise.new(this.mt_contract_id)
            .functionCall(
                "mt_unlock", 
                JSON.stringify({ 
                    nft_token_id: nft_token_id, 
                    token_owner_id: nft_token_owner_id, 
                    token_ids: mt_unlock_token_ids, 
                    amounts: mt_unlock_amounts 
                }), 
                NO_DEPOSIT,
                TWENTY_TGAS
            )
            .then(NearPromise.new(near.currentAccountId())
                .functionCall(
                    "mt_unlock_callback", 
                    JSON.stringify({
                        nft_token_id: nft_token_id,
                        nft_token_owner_id: nft_token_owner_id,
                        nft_token_metadata: nft_token_metadata,
                        mt_lock_token_ids: mt_lock_token_ids, 
                        mt_lock_amounts: mt_lock_amounts, 
                    }), 
                    NO_DEPOSIT, 
                    HUNDRED_TGAS
                ));

        return promise.asReturn();
    }

    @call({ privateFunction: true })
    mt_unlock_callback({ nft_token_id, nft_token_owner_id, nft_token_metadata, mt_lock_token_ids, mt_lock_amounts }: {
        nft_token_id: string,
        nft_token_owner_id: string,
        nft_token_metadata: NFTTokenMetadata,
        mt_lock_token_ids: string[],
        mt_lock_amounts: (string | number)[]
    }): NearPromise | boolean {
        assert(validateAccountId(nft_token_owner_id), "NFT Token Owner ID is invalid");
        try {
            near.promiseResult(0);
        } catch {
            return false;
        }

        const promise = NearPromise.new(this.mt_contract_id)
            .functionCall(
                "mt_lock", 
                JSON.stringify({ 
                    nft_token_id: nft_token_id, 
                    token_owner_id: nft_token_owner_id, 
                    token_ids: mt_lock_token_ids, 
                    amounts: mt_lock_amounts 
                }), 
                NO_DEPOSIT, 
                TWENTY_TGAS
            )
            .then(NearPromise.new(near.currentAccountId())
                .functionCall(
                    "mt_lock_callback", 
                    JSON.stringify({
                        nft_token_id: nft_token_id,
                        nft_token_metadata: nft_token_metadata
                    }), 
                    NO_DEPOSIT, 
                    SIXTY_TGAS
                ));

        return promise.asReturn();
    }

    @call({ privateFunction: true })
    mt_lock_callback({ nft_token_id, nft_token_metadata }: {
        nft_token_id: string,
        nft_token_metadata: NFTTokenMetadata
    }): NearPromise | boolean {
        try {
            near.promiseResult(0);
        } catch {
            return false;
        }

        const promise = NearPromise.new(this.nft_contract_id)
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
                    "update_nft_callback", 
                    NO_ARGS, 
                    NO_DEPOSIT, 
                    TEN_TGAS
                ));

        return promise.asReturn();
    }

    @call({ privateFunction: true })
    update_nft_callback(): boolean {
        try {
            near.promiseResult(0);
        } catch {
            return false;
        }

        return true;
    }
}
