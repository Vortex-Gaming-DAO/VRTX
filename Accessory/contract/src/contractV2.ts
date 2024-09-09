import { NearBindgen, NearPromise, AccountId, LookupMap, IntoStorageKey } from "near-sdk-js";
import { near, initialize, call, view, assert, migrate } from "near-sdk-js";
import { TokenId as NFTTokenId } from "near-contract-standards/lib/non_fungible_token/token";
import { Option } from "near-contract-standards/lib/non_fungible_token/utils";

class MTContractMetadata {
    spec: string; // 필수. 버전 정보를 나타내는 문자열. 예를 들어 "mt-1.0.0".
    name: string; // 필수. 메타데이터의 이름. 예를 들어 "Zoink's Digital Sword Collection".

    assert_valid() {
        
    }
}

class MTBaseTokenMetadata {
    name: string; // 필수. 토큰의 이름. 예를 들어 "Silver Swords" 또는 "Metaverse 3".
    id: string; // 필수. 메타데이터를 위한 고유 식별자.
    symbol: string | null; // 필수. 토큰의 기호. 예를 들어 "MOCHI". (값이 없을 수도 있음)
    icon: string | null; // 아이콘의 데이터 URL. (값이 없을 수도 있음)
    decimals: string | null; // 토큰의 소수점 자리수. FT(대체 가능한 토큰) 관련 토큰에서 유용함. (값이 없을 수도 있음)
    base_uri: string | null; // 중앙화된 게이트웨이 URL로, 분산 저장소 자산에 신뢰성 있게 접근할 수 있는 주소. (값이 없을 수도 있음)
    reference: string | null; // 추가 정보가 담긴 JSON 파일의 URL. (값이 없을 수도 있음)
    copies: number | null; // 이 메타데이터 세트의 존재 개수. 토큰이 발행될 때의 개수. (값이 없을 수도 있음)
    reference_hash: string | null; // reference 필드의 JSON을 Base64로 인코딩한 sha256 해시. reference가 포함된 경우 필수. (값이 없을 수도 있음)
}

class MTTokenMetadata {
    title: string | null; // 토큰의 제목. 예를 들어 "Arch Nemesis: Mail Carrier" 또는 "Parcel #5055". (값이 없을 수도 있음)
    description: string | null; // 자유 형식의 설명. (값이 없을 수도 있음)
    media: string | null; // 연관된 미디어의 URL. 분산형, 콘텐츠 주소 지정 스토리지에 저장된 것이 바람직함. (값이 없을 수도 있음)
    media_hash: string | null; // media 필드가 참조하는 콘텐츠의 Base64로 인코딩된 sha256 해시. media가 포함된 경우 필수. (값이 없을 수도 있음)
    issued_at: string | null; // 토큰이 발행된 시점, 유닉스 에포크(밀리초 단위). (값이 없을 수도 있음)
    expires_at: string | null; // 토큰이 만료되는 시점, 유닉스 에포크(밀리초 단위). (값이 없을 수도 있음)
    starts_at: string | null; // 토큰이 유효해지는 시점, 유닉스 에포크(밀리초 단위). (값이 없을 수도 있음)
    updated_at: string | null; // 토큰이 마지막으로 업데이트된 시점, 유닉스 에포크(밀리초 단위). (값이 없을 수도 있음)
    extra: string | null; // MT(메타 데이터)가 블록체인에 저장하고 싶은 추가 정보. 문자열화된 JSON일 수 있음. (값이 없을 수도 있음)
    reference: string | null; // 추가 정보가 담긴 오프체인 JSON 파일의 URL. (값이 없을 수도 있음)
    reference_hash: string | null; // reference 필드의 JSON을 Base64로 인코딩한 sha256 해시. reference가 포함된 경우 필수. (값이 없을 수도 있음)
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
    token_metadata?: MTTokenMetadata;
    base_metadata_id: string;

    constructor(
        token_id,
        owner_id,
        token_metadata,
        base_metadata_id,
    ) {
        this.token_id = token_id;
        this.owner_id = owner_id;
        this.token_metadata = token_metadata;
        this.base_metadata_id = base_metadata_id;
    }
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

class StorageKeyToken extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "TOKEN_";
    }
}

class StorageKeyBaseTokenMetadata extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "BASE_TOKEN_METADATA_";
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

class StorageKeyTokenIndex extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "TOKEN_INDEX_";
    }
}

@NearBindgen({ requireInit: true })
class Accessory {
    private owner_id: AccountId;
    private metadata: Option<MTContractMetadata>;
    private tokens: LookupMap<Token>;
    private token_base_metadatas: LookupMap<MTBaseTokenMetadata>;
    private token_balances: LookupMap<bigint>;
    private token_supplies: LookupMap<bigint>;
    private minters: LookupMap<boolean>;
    private token_count: number;
    private token_indices: LookupMap<string>; // index to token_id mapping

    constructor() {
        this.owner_id = "";
        this.metadata = new MTContractMetadata();
        this.tokens = new LookupMap("");
        this.token_base_metadatas = new LookupMap("");
        this.token_balances = new LookupMap("");
        this.token_supplies = new LookupMap("");
        this.minters = new LookupMap("");
        this.token_count = 0;
        this.token_indices = new LookupMap("");
    }

    @initialize({ requireInit: true })
    init({ owner_id, metadata }: {
        owner_id: string;
        metadata: MTContractMetadata;
    }): void {
        this.owner_id = owner_id;
        this.metadata = Object.assign(this.metadata, metadata);
        this.metadata.assert_valid();
        this.tokens = new LookupMap(new StorageKeyToken().into_storage_key());
        this.token_base_metadatas = new LookupMap(new StorageKeyBaseTokenMetadata().into_storage_key());
        this.token_balances = new LookupMap(new StorageKeyTokenBalance().into_storage_key());
        this.token_supplies = new LookupMap(new StorageKeyTokenSupply().into_storage_key());
        this.minters = new LookupMap(new StorageKeyMinter().into_storage_key());
        this.minters.set(owner_id, true);
        this.token_count = 0;
        this.token_indices = new LookupMap(new StorageKeyTokenIndex().into_storage_key());
    }

    @migrate({})
    migrateState() {
        const sender_id = near.predecessorAccountId();
        let state = JSON.parse(near.storageRead("STATE"));
        assert(sender_id === state.owner_id, "Sender is not the contract's owner");
        
        this.owner_id = state.owner_id;
        this.metadata = state.metadata;
        this.token_balances = state.token_balances;
        this.token_supplies = state.token_supplies;
        this.minters = state.minters;

        this.tokens = new LookupMap(new StorageKeyToken().into_storage_key());
        this.token_base_metadatas = new LookupMap(new StorageKeyBaseTokenMetadata().into_storage_key());
        this.token_count = 0;
        this.token_indices = new LookupMap(new StorageKeyTokenIndex().into_storage_key());
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
    update_all_token_metadata({ token_id, token_metadata, base_token_metadata }: {
        token_id: string,
        token_metadata: MTTokenMetadata,
        base_token_metadata: MTBaseTokenMetadata
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        const token: Token = {
            token_id,
            owner_id: null,
            token_metadata,
            base_metadata_id: token_id
        }
        if(!this.tokens.get(token_id)) {
            this.token_indices.set(this.token_count.toString(), token_id);
            this.token_count += 1;
        }
        this.tokens.set(token_id, token);
        this.token_base_metadatas.set(token_id, base_token_metadata);
    }

    @call({})
    update_token_metadata({ token_id, token_metadata }: {
        token_id: string,
        token_metadata: MTTokenMetadata
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        const token: Token = {
            token_id,
            owner_id: null,
            token_metadata,
            base_metadata_id: token_id
        }
        if(!this.tokens.get(token_id)) {
            this.token_indices.set(this.token_count.toString(), token_id);
            this.token_count += 1;
        }
        this.tokens.set(token_id, token);
    }

    @call({})
    update_base_token_metadata({ token_id, base_token_metadata }: {
        token_id: string,
        base_token_metadata: MTBaseTokenMetadata
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        if(!this.tokens.get(token_id)) {
            this.token_indices.set(this.token_count.toString(), token_id);
            this.token_count += 1;
        }
        this.token_base_metadatas.set(token_id, base_token_metadata);
    }

    /* VIEW */
    @view({})
    mt_token({ token_ids }: {
        token_ids: string[]
    }): (Token | null)[] {
        const tokens = token_ids.map(token_id => {
            return this.tokens.get(token_id, { defaultValue: new Token(token_id, null, null, token_id)});
        })
        return tokens;
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

    @view({})
    mt_tokens({ from_index, limit }: {
        from_index: string | null,
        limit: number | null
    }): Token[] {
        const from_index_number = from_index ? Number(from_index) : 0;
        
        assert(!isNaN(from_index_number), "The from_index argument must be a valid integer");
        assert(from_index_number >= 0, "The from_index argument must be a non-negative integer");
        assert(this.token_count > from_index_number, "The from_index argument must be less then all count, all count is " + this.token_count);
        if(!limit) {
            limit = this.token_count - from_index_number;
        }
        assert(limit > 0,"The limit argument must be a positive integer, " + limit);

        const tokens: Token[] = [];
        for(let x=0;x<limit;x++) {
            const index = from_index_number + x;
            const token_id = this.token_indices.get(index.toString());
            if(!token_id) {
                break;
            }
            tokens.push(this.tokens.get(token_id));
        }
        return tokens;
    }

    @view({})
    mt_tokens_for_owner({ account_id, from_index, limit }: {
        account_id: string,
        from_index: string|null, // default: 0
        limit: number|null, // default: unlimited (could fail due to gas limit)
    }): Token[] {
        const from_index_number = from_index ? Number(from_index) : 0;

        assert(!isNaN(from_index_number), "The from_index argument must be a valid integer");
        assert(from_index_number >= 0, "The from_index argument must be a non-negative integer");
        assert(this.token_count > from_index_number, "The from_index argument must be less then all count, all count is " + this.token_count);
        if(!limit) {
            limit = this.token_count - from_index_number;
        }
        assert(limit > 0,"The limit argument must be a positive integer");
      
        const max_length = from_index_number + limit;
        const tokens: Token[] = [];
        for(let x=0;x<this.token_count;x++) {
            const token_id = this.token_indices.get(x.toString());
            const token_owner_key = `${account_id}:${token_id}`;
            const balance = this.token_balances.get(token_owner_key);
            if(!!balance && balance > BigInt(0)) {
                tokens.push(this.tokens.get(token_id));

                if(tokens.length === max_length) {
                    break;
                }
            }
        }
        return tokens;
    }

    @view({})
    mt_tokens_base_metadata_all({ from_index, limit }: {
        from_index: string | null,
        limit: number | null
    }): MTBaseTokenMetadata[] {
        const from_index_number = from_index ? Number(from_index) : 0;

        assert(!isNaN(from_index_number), "The from_index argument must be a valid integer");
        assert(from_index_number >= 0, "The from_index argument must be a non-negative integer");
        assert(this.token_count > from_index_number, "The from_index argument must be less then all count, all count is " + this.token_count);
        if(!limit) {
            limit = this.token_count - from_index_number;
        }
        assert(limit > 0,"The limit argument must be a positive integer");
        
        const baseTokenMetadatas: MTBaseTokenMetadata[] = [];
        for(let x=0;x<limit;x++) {
            const index = from_index_number + x;
            const token_id = this.token_indices.get(index.toString());
            if(!token_id) {
                break;
            }
            baseTokenMetadatas.push(this.token_base_metadatas.get(token_id));
        }
        return baseTokenMetadatas;
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
        const all_token_metadatas: MTTokenMetadataAll[] = token_ids.map(token_id => {
            const base = this.token_base_metadatas.get(token_id);
            const token = this.tokens.get(token_id).token_metadata;
            return {
                base,
                token
            }
        })
        
        return all_token_metadatas;
    }

    @view({})
    mt_metadata_token_by_token_id({ token_ids }: {
        token_ids: string[]
    }): MTTokenMetadata[] {
        const token_metadatas: MTTokenMetadata[] = token_ids.map(token_id => {
            const token = this.tokens.get(token_id).token_metadata;
            return token
        })
        
        return token_metadatas;
    }

    @view({})
    mt_metadata_base_by_token_id({ token_ids }: {
        token_ids: string[]
    }): MTBaseTokenMetadata[] {
        const base_token_metadatas: MTBaseTokenMetadata[] = token_ids.map(token_id => {
            const base = this.token_base_metadatas.get(token_id);
            return base
        })
        
        return base_token_metadatas;
    }

    @view({})
    mt_metadata_base_by_metadata_id({ base_metadata_ids }: {
        base_metadata_ids: string[]
    }): MTBaseTokenMetadata[] {
        return this.mt_metadata_base_by_token_id({ token_ids: base_metadata_ids });
    }

    @view({})
    is_minter({ account_id }: {
        account_id: AccountId
    }): boolean {
        return this.minters.get(account_id, { defaultValue: false });
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
}
