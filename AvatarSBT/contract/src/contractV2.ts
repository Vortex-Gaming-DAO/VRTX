import { NearBindgen, NearPromise, AccountId, LookupMap, IntoStorageKey, validateAccountId } from "near-sdk-js";
import { near, initialize, call, view, assert } from "near-sdk-js";
import { NonFungibleToken } from "near-contract-standards/lib";
import { NonFungibleTokenCore } from "near-contract-standards/lib/non_fungible_token/core";
import { NonFungibleTokenMetadataProvider, NFTContractMetadata, TokenMetadata } from "near-contract-standards/lib/non_fungible_token/metadata";
import { NonFungibleTokenEnumeration } from "near-contract-standards/lib/non_fungible_token/enumeration";
import { Token, TokenId } from "near-contract-standards/lib/non_fungible_token/token";
import { Option } from "near-contract-standards/lib/non_fungible_token/utils";
import { Nep171Event } from "near-contract-standards/lib";
import { NearEvent } from "near-contract-standards/lib/event";

class StorageKey {}

class StorageKeyNonFungibleToken extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "NFT_";
    }
}

class StorageKeyTokenMetadata extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "TOKEN_METADATA_";
    }
}

class StorageKeyTokenEnumeration extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "TOKEN_ENUMERATION_";
    }
}

class StorageKeyTokenApproval extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "TOKEN_APPROVAL_";
    }
}

class StorageKeyTokenLock extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "TOKEN_LOCK_";
    }
}

class StorageKeyMinter extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "MINTER_";
    }
}

//#region Event
class CustomEventV1 extends NearEvent {
        standard: string
        version: string
        event: string
        data: any
      constructor(event: string, data: any) {
        super()
        this.standard = "VRTX-Avatar"
        this.version = "1.0.0"
        this.event = event
        this.data = data
    }
}

//#endregion

@NearBindgen({ requireInit: true })
export class AvatarSBT implements NonFungibleTokenCore, 
                                  NonFungibleTokenMetadataProvider,
                                  NonFungibleTokenEnumeration {
    private tokens: NonFungibleToken;
    private metadata: Option<NFTContractMetadata>;
    private token_locks: LookupMap<boolean>;
    private minters: LookupMap<boolean>;
    private is_sbt: boolean;

    constructor() {
        this.tokens = new NonFungibleToken();
        this.metadata = new NFTContractMetadata();
        this.token_locks = new LookupMap("");
        this.minters = new LookupMap("");
        this.is_sbt = false;
    }

    @initialize({ requireInit: true })
    init({ owner_id, metadata, is_sbt }: {
        owner_id: string;
        metadata: NFTContractMetadata;
        is_sbt?: boolean;
    }): void {
        this.metadata = Object.assign(new NFTContractMetadata(), metadata);
        this.metadata.assert_valid();
        this.tokens = new NonFungibleToken();
        this.tokens.init(
            new StorageKeyNonFungibleToken(),
            owner_id,
            new StorageKeyTokenMetadata(),
            new StorageKeyTokenEnumeration(),
            new StorageKeyTokenApproval()
        );
        this.token_locks = new LookupMap(new StorageKeyTokenLock().into_storage_key());
        this.minters = new LookupMap(new StorageKeyMinter().into_storage_key());
        this.minters.set(owner_id, true);
        this.is_sbt = is_sbt;
    }

    @call({ payableFunction: true })
    nft_mint({ token_id, token_owner_id, token_metadata, locked }: {
        token_id: TokenId,
        token_owner_id: AccountId,
        token_metadata: TokenMetadata,
        locked?: boolean
    }): void {
        const sender_id = near.signerAccountId();
        assert(this.minters.get(sender_id), "Sender is not a minter");
        assert(validateAccountId(token_owner_id), "Token Owner ID is invalid");

        this.tokens.internal_mint(token_id, token_owner_id, token_metadata);
        this.token_locks.set(token_id, locked || false);
    }

    @call({ payableFunction: true })
    nft_transfer({ receiver_id, token_id, approval_id, memo }: {
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id?: bigint,
        memo?: string
    }): void {
        assert(!this.is_sbt, "SBT can not be transfered");
        assert(validateAccountId(receiver_id), "Receiver account ID is invalid");

        this.tokens.nft_transfer({ receiver_id, token_id, approval_id, memo });
    }

    @call({ payableFunction: true })
    nft_transfer_call({ receiver_id, token_id, approval_id, memo, msg }: {
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id?: bigint,
        memo?: string,
        msg: string
    }): NearPromise {
        assert(!this.is_sbt, "SBT can not be transfered");
        assert(validateAccountId(receiver_id), "Receiver account ID is invalid");

        return this.tokens.nft_transfer_call({ receiver_id, token_id, approval_id, memo, msg });
    }

    @view({})
    nft_metadata(): NFTContractMetadata {
        assert(this.metadata !== null, "Metadata not initialized");

        return this.metadata;
    }

    @view({})
    nft_total_supply(): number {
        return this.tokens.nft_total_supply();
    }

    @view({})
    nft_tokens({ from_index, limit }: {
        from_index?: number,
        limit?: number
    }): Token[] {
        return this.tokens.nft_tokens({ from_index, limit });
    }

    @view({})
    nft_token({ token_id }: {
        token_id: TokenId
    }): Token | null {
        return this.tokens.nft_token({ token_id });
    }

    @view({})
    nft_supply_for_owner({ account_id }: {
        account_id: AccountId
    }): number {
        return this.tokens.nft_supply_for_owner({ account_id });
    }

    @view({})
    nft_tokens_for_owner({ account_id, from_index, limit }: {
        account_id: AccountId,
        from_index?: number,
        limit?: number
    }): Token[] {
        return this.tokens.nft_tokens_for_owner({ account_id, from_index, limit });
    }

    /* minter management */

    @call({})
    add_minter({ account_id }: {
        account_id: AccountId
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.tokens.owner_id, "Sender is not the contract's owner");
        assert(!this.minters.get(account_id), "Account is already minter");
        assert(validateAccountId(account_id), "Account ID is invalid");

        this.minters.set(account_id, true);
        new CustomEventV1("AddMinter", { account_id }).emit();
    }

    @call({})
    remove_minter({ account_id }: {
        account_id: AccountId
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.tokens.owner_id, "Sender is not the contract's owner");
        assert(this.minters.get(account_id), "Account is not a minter");
        assert(validateAccountId(account_id), "Account ID is invalid");

        this.minters.set(account_id, false);
        new CustomEventV1("RevekeMinter", { account_id }).emit();
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
        metadata: NFTContractMetadata
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.tokens.owner_id, "Sender is not the contract's owner");

        this.metadata = Object.assign(new NFTContractMetadata(), metadata);
        this.metadata.assert_valid();
        new CustomEventV1("UpdateMetadataEvent", {metadata : this.metadata}).emit();
    }

    @call({})
    update_token_metadata({ token_id, token_metadata, locked }: {
        token_id: TokenId,
        token_metadata: TokenMetadata,
        locked?: boolean
    }): void {
        const sender_id = near.signerAccountId();
        assert(this.minters.get(sender_id), "Sender is not a minter");
        assert(!this.token_locks.get(token_id), "Token is locked");

        this.tokens.token_metadata_by_id?.set(token_id, token_metadata);
        this.token_locks.set(token_id, locked || false);
        new CustomEventV1("UpdateTokenMetadataEvent", {token_id, token_metadata, locked}).emit();
    }
}
