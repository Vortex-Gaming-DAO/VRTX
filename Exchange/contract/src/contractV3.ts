import { NearBindgen, NearPromise, AccountId, LookupMap, IntoStorageKey, near, initialize, call, view, assert, migrate, validateAccountId, bytes } from "near-sdk-js";
import { NearEvent } from "near-contract-standards/lib/event";

const FIVE_TGAS = BigInt("50000000000000");
const NO_DEPOSIT = BigInt(0);
const DEPOSIT_1YOCTO = BigInt(1);
const NO_ARGS = JSON.stringify({});

class StorageKey {}

class StorageKeyOracle extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "ORACLE_";
    }
}

class StorageKeyFeeOwner extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "FEE_OWNER_";
    }
}

class StorageKeyDistributor extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "DISTRIBUTOR_";
    }
}

class StorageKeyDistributeAmount extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "DISTRIBUTE_AMOUNT_";
    }
}

class StorageKeyDistributeTime extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "DISTRIBUTE_TIME_";
    }
}

class StorageKeyDistributeRate extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "DISTRIBUTE_RATE_";
    }
}

class StorageKeyExchangeRatio extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "EXCHANGE_RATIO_";
    }
}

class StorageKeyExchangeFeeRatio extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "EXCHANGE_FEE_RATIO_";
    }
}

class StorageKeyMinimumExchangeableAmount extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "MINIMUM_EXCHANGEABLE_AMOUNT_";
    }
}

class StorageKeyExchangeGuardRate extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "EXCHANGE_GUARD_RATE_";
    }
}

class StorageKeySignatures extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "SIGNATURE_";
    }
}

class StorageKeyIntervalDistributeTime extends StorageKey implements IntoStorageKey {
    into_storage_key(): string {
        return "INTERVAL_DISTRIBUTE_TIME_";
    }
}

//#region Events
export class ExchangeEvent extends NearEvent {
    version;
    event_kind;
    constructor(version, event_kind) {
        super();
        this.version = version;
        this.event_kind = event_kind;
    }
}

class CustomEventV1 extends NearEvent {
        standard: string
        version: string
        event: string
        data: any
    constructor(event: string, data: any) {
        super()
        this.standard = "VRTX-Exchange"
        this.version = "1.0.0"
        this.event = event
        this.data = data
    }
}

//#endregion

@NearBindgen({ requireInit: true })
export class Exchange {
    private owner_id: AccountId;
    private oracles: LookupMap<boolean>;
    private restrict_to_oracle: boolean;
    private fee_owners:  LookupMap<AccountId>;
    private distributors: LookupMap<AccountId>;
    private distribute_amounts: LookupMap<bigint>;
    private distribute_times: LookupMap<bigint>;
    private distribute_rates: LookupMap<bigint>;
    private exchange_ratios: LookupMap<bigint>;
    private exchange_fee_ratios: LookupMap<bigint>;
    private minimum_exchangeable_amounts: LookupMap<bigint>;
    private exchage_guard_rates: LookupMap<bigint>;
    private signatures: LookupMap<boolean>;
    private interval_distribute_times: LookupMap<bigint>;

    constructor() {
        this.owner_id = "";
        this.oracles = new LookupMap("");
        this.restrict_to_oracle = false;
        this.fee_owners = new LookupMap("");
        this.distributors = new LookupMap("");
        this.distribute_amounts = new LookupMap("");
        this.distribute_times = new LookupMap("");
        this.distribute_rates = new LookupMap("");
        this.exchange_ratios = new LookupMap("");
        this.exchange_fee_ratios = new LookupMap("");
        this.minimum_exchangeable_amounts = new LookupMap("");
        this.exchage_guard_rates = new LookupMap("");
        this.signatures = new LookupMap("");
        this.interval_distribute_times = new LookupMap("");
    }
   
    @initialize({ requireInit: true })
    init({ owner_id, restrict_to_oracle }: {
        owner_id: AccountId;
        restrict_to_oracle: boolean;
    }): void {
        this.owner_id = owner_id;
        this.oracles = new LookupMap(new StorageKeyOracle().into_storage_key());
        this.oracles.set(owner_id, true);
        this.restrict_to_oracle = restrict_to_oracle;
        this.fee_owners = new LookupMap(new StorageKeyFeeOwner().into_storage_key());
        this.distributors = new LookupMap(new StorageKeyDistributor().into_storage_key());
        this.distribute_amounts = new LookupMap(new StorageKeyDistributeAmount().into_storage_key());
        this.distribute_times = new LookupMap(new StorageKeyDistributeTime().into_storage_key());
        this.distribute_rates = new LookupMap(new StorageKeyDistributeRate().into_storage_key());
        this.exchange_ratios = new LookupMap(new StorageKeyExchangeRatio().into_storage_key());
        this.exchange_fee_ratios = new LookupMap(new StorageKeyExchangeFeeRatio().into_storage_key());
        this.minimum_exchangeable_amounts = new LookupMap(new StorageKeyMinimumExchangeableAmount().into_storage_key());
        this.exchage_guard_rates = new LookupMap(new StorageKeyExchangeGuardRate().into_storage_key());
        this.signatures = new LookupMap(new StorageKeySignatures().into_storage_key());
    }

    // @migrate({})
    // migrateState() {
    //     const sender_id = near.predecessorAccountId();
    //     let state = JSON.parse(near.storageRead("STATE"));
    //     assert(sender_id === state.owner_id, "Sender is not the contract's owner");
    // }

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

    /* */

    @call({})
    set_fee_owner({ ft_contract_id, account_id }: {
        ft_contract_id: AccountId,
        account_id: AccountId
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(validateAccountId(ft_contract_id), "FT Contract ID is invalid");
        assert(validateAccountId(account_id), "Account ID is invalid");

        this.fee_owners.set(ft_contract_id, account_id);
        new CustomEventV1("SetFeeOwner", {ft_contract_id, account_id}).emit();
    }

    @view({})
    get_fee_owner({ ft_contract_id }: {
        ft_contract_id: AccountId
    }): AccountId {
        return this.fee_owners.get(ft_contract_id);
    }

    @call({})
    set_distributor({ ft_contract_id, account_id }: {
        ft_contract_id: AccountId,
        account_id: AccountId
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(validateAccountId(ft_contract_id), "FT Contract ID is invalid");
        assert(validateAccountId(account_id), "Account ID is invalid");

        this.distributors.set(ft_contract_id, account_id);
        new CustomEventV1("SetDistributor", {ft_contract_id, account_id}).emit();
    }

    @view({})
    get_distributor({ ft_contract_id }: {
        ft_contract_id: AccountId
    }): AccountId {
        return this.distributors.get(ft_contract_id);
    }

    @call({})
    set_distribute_rate({ ft_contract_id, rate, initial_amount, interval_time }: {
        ft_contract_id: AccountId,
        rate: string | number, /* bigint */
        initial_amount: string | number, /* bigint */
        interval_time: string | number /* bitint */
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(validateAccountId(ft_contract_id), "FT Contract ID is invalid");
        
        this.distribute_amounts.set(ft_contract_id, (BigInt(initial_amount) === BigInt(0)) ? this._get_distribute_amount(ft_contract_id) : BigInt(initial_amount));
        this.interval_distribute_times.set(ft_contract_id, BigInt(interval_time));
        this.distribute_times.set(ft_contract_id, this._get_interval_count(ft_contract_id));
        this.distribute_rates.set(ft_contract_id, BigInt(rate));

        new CustomEventV1("SetDistributorRate", {ft_contract_id, rate, initial_amount, interval_time}).emit();
    }

    @view({})
    get_distribute_rate({ ft_contract_id }: {
        ft_contract_id: AccountId
    }): bigint /* bigint */ {
        return this._get_distribute_rate(ft_contract_id);
    }

    @call({})
    set_exchange_ratio({ ft_contract_id, ratio }: {
        ft_contract_id: AccountId,
        ratio: string | number
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(validateAccountId(ft_contract_id), "FT Contract ID is invalid");
        assert(this.valid_bigint({ value: ratio }), `Ratio '${ratio}' is not a valid number`);
        // exchange_ratio가 1000이 되어야 교환비는 1이 됨.
        assert(BigInt(ratio) >= 0 && BigInt(ratio) < 10000, `Ratio '${ratio}' is not a valid number`);
        
        this.exchange_ratios.set(ft_contract_id, BigInt(ratio));

        new CustomEventV1("SetExchangeRatio", {ft_contract_id, ratio}).emit();
    }

    @view({})
    get_exchange_ratio({ ft_contract_id }: {
        ft_contract_id: AccountId
    }): bigint {
        return this._get_exchange_ratio(ft_contract_id);
    }

    @call({})
    set_exchange_fee_ratio({ ft_contract_id, ratio }: {
        ft_contract_id: AccountId,
        ratio: string | number
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(validateAccountId(ft_contract_id), "FT Contract ID is invalid");
        assert(this.valid_bigint({ value: ratio }), `Ratio '${ratio}' is not a valid number`);
        // exchange_fee_ratio가 10이 되어야 수수료는 1%가 됨.
        assert(BigInt(ratio) >= 0 && BigInt(ratio) < 1000, `Ratio '${ratio}' is not a valid number`);

        this.exchange_fee_ratios.set(ft_contract_id, BigInt(ratio));
        new CustomEventV1("SetExchangeFeeRatio", {ft_contract_id, ratio}).emit();
    }

    @view({})
    get_exchange_fee_ratio({ ft_contract_id }: {
        ft_contract_id: AccountId
    }): bigint {
        return this._get_exchange_fee_ratio(ft_contract_id);
    }

    @call({})
    set_minimum_exchangeable_amount({ ft_contract_id, amount }: {
        ft_contract_id: AccountId,
        amount: string | number /* bigint */
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(validateAccountId(ft_contract_id), "FT Contract ID is invalid");
        assert(this.valid_bigint({ value: amount }), `Amount '${amount}' is not a valid number`);
        assert(BigInt(amount) >= 0, `amount must be positive`);

        this.minimum_exchangeable_amounts.set(ft_contract_id, BigInt(amount));
        new CustomEventV1("SetMinimumExchangeableAmount", {ft_contract_id, amount}).emit();
    }

    @view({})
    get_minimum_exchangeable_amount({ ft_contract_id }: {
        ft_contract_id: AccountId
    }): bigint {
        return this._get_minimum_exchangeable_amount(ft_contract_id);
    }

    // exchage_guard_rates는 사용되지 않음
    @call({})
    set_exchange_guard_rate({ ft_contract_id, rate }: {
        ft_contract_id: AccountId,
        rate: string | number /* bigint */
    }): void {
        const sender_id = near.predecessorAccountId();
        assert(sender_id === this.owner_id, "Sender is not the contract's owner");
        assert(this.valid_bigint({ value: rate }), `rate '${rate}' is not a valid number`);
        assert(BigInt(rate) >= 0 && BigInt(rate) < 1000, `rate '${rate}' is not a valid number`);

        this.exchage_guard_rates.set(ft_contract_id, BigInt(rate));
        new CustomEventV1("SetExchangeGuardRate", {ft_contract_id, rate}).emit();
    }

    @view({})
    get_exchange_guard_rate({ ft_contract_id }: {
        ft_contract_id: AccountId
    }): bigint {
        return this._get_exchange_guard_rate(ft_contract_id);
    }

    @view({})
    get_exchange_params({ ft_contract_id }: {
        ft_contract_id: AccountId
    }): {
        exchangeable_amount: bigint,
        exchange_ratio: bigint,
        exchange_fee_ratio: bigint,
        minimum_exchangeable_amount: bigint,
        exchange_guard_rate: bigint
    } {
        return {
            // 현재 교환 가능한 $VRTX 총 수량
            exchangeable_amount: this._get_distribute_amount(ft_contract_id),
            // VOR - $VRTX 교환 비율
            exchange_ratio: this._get_exchange_ratio(ft_contract_id),
            // 수수료 비율
            exchange_fee_ratio: this._get_exchange_fee_ratio(ft_contract_id),
            // 최소 교환 수량
            minimum_exchangeable_amount: this._get_minimum_exchangeable_amount(ft_contract_id), 
            // 
            exchange_guard_rate: this._get_exchange_guard_rate(ft_contract_id)
        }
    }

    @view({})
    get_all_params({ ft_contract_id }: {
        ft_contract_id: AccountId
    }) {
        return {
            owner_id: this.owner_id,
            fee_owner: this.get_fee_owner({ft_contract_id}),
            distributor: this.get_distributor({ft_contract_id}),
            distribute_rate: this._get_distribute_rate(ft_contract_id),
            interval_distribute_time: this._get_interval_distribute_time(ft_contract_id),
            distribute_time: this._get_interval_count(ft_contract_id),
            // 현재 교환 가능한 $VRTX 총 수량
            distribute_amount: this._get_distribute_amount(ft_contract_id),
            // VOR - $VRTX 교환 비율
            exchange_ratio: this._get_exchange_ratio(ft_contract_id),
            // 수수료 비율
            exchange_fee_ratio: this._get_exchange_fee_ratio(ft_contract_id),
            // 최소 교환 수량
            minimum_exchangeable_amount: this._get_minimum_exchangeable_amount(ft_contract_id), 
            // 
            exchange_guard_rate: this._get_exchange_guard_rate(ft_contract_id)
        }
    }

    @view({})
    get_signature_used({ signature_id }: {
        signature_id: string
    }): boolean {
        return this.signatures.get(signature_id, { defaultValue: false });
    }

    /* */

    @call({ payableFunction: true })
    exchange_token({ ft_contract_id, amount, recipient, signature_id }: {
        ft_contract_id: AccountId,
        amount: number,
        recipient: AccountId,
        signature_id: string
    }): NearPromise {
        let initial_storage_usage = near.storageUsage();
        const sender_id = near.signerAccountId();
        assert(this.oracles.get(sender_id), "Sender is not a oracle");
        assert(validateAccountId(ft_contract_id), "FT Contract ID is invalid");
        assert(validateAccountId(recipient), "Recipient ID is invalid");
        assert(this.valid_bigint({ value: amount }), `Amount '${amount}' is not a valid number`);
        assert(BigInt(amount) > 0, `amount must be positive`);

        const signature_hash = this.toHexString({byteArray: near.sha256(bytes(recipient + ":" +  signature_id))});
        assert(!this.signatures.get(signature_hash, { defaultValue: false }), "Signature is reused");
        this.signatures.set(signature_hash, true);

        // 교환 VRTX양 = 교환하고자 하는 VOR 포인트 * 교환비 (가중치 빠져있음)
        const exchange_amount = BigInt(amount) * this._get_exchange_ratio(ft_contract_id) / BigInt(1000);
        // 교환 가능한 양
        const exchangeable_amount = this._get_distribute_amount(ft_contract_id);

        // 교환 가능한 양이 최소 교환 가능양보다 커야 통과
        // assert(exchangeable_amount >= this._get_minimum_exchangeable_amount(ft_contract_id), "Not enough exchangeable amount");
        // 교환 가능한 양이 교환 VRTX양보다 커야 통과
        assert(exchangeable_amount >= BigInt(exchange_amount), "Exceeded exchangeable amount");
        // 교환 VRTX양 * 방어양이 교환 가능한 양보다 작아야 통과
        // assert(exchange_amount * this._get_exchange_guard_rate(ft_contract_id) / BigInt(1000) <= exchangeable_amount, "Too much exchange amount");

        // 교환 가능 토큰 체크
        const distributor = this.distributors.get(ft_contract_id, { defaultValue: "" });

        // 교환 가능 토큰이어야 통과
        assert(distributor !== "", "Token is not exchangeable");
       
        // 수수료 받는 지갑
        const fee_owner = this.fee_owners.get(ft_contract_id, { defaultValue: this.owner_id });
        // 수수료 VRTX양
        const exchange_fee = exchange_amount * this._get_exchange_fee_ratio(ft_contract_id) / BigInt(1000);

        const promise = NearPromise.new(ft_contract_id)
                            .functionCall(
                                "ft_transfer", 
                                JSON.stringify({ receiver_id: recipient, amount: (exchange_amount - exchange_fee).toString() }), 
                                DEPOSIT_1YOCTO, 
                                FIVE_TGAS
                            )
                            .then(NearPromise.new(ft_contract_id).functionCall(
                                "ft_transfer", 
                                JSON.stringify({ receiver_id: fee_owner, amount: exchange_fee.toString() }), 
                                DEPOSIT_1YOCTO, 
                                FIVE_TGAS
                            ))
                            .then(NearPromise.new(near.currentAccountId()).functionCall(
                                "ft_transfer_callback", 
                                JSON.stringify({ ft_contract_id, amount: (exchange_amount - exchange_fee).toString(), fee: exchange_fee.toString(), recipient }), 
                                NO_DEPOSIT, 
                                FIVE_TGAS
                            ));

        // 교환 가능한 양 재설정
        this.distribute_amounts.set(ft_contract_id, exchangeable_amount - BigInt(exchange_amount));
        // 타이머 재설정
        this.distribute_times.set(ft_contract_id, this._get_interval_count(ft_contract_id));
        
        // storage 사용량 확인
        let storage_used = near.storageUsage() - initial_storage_usage;
        let required_cost = near.storageByteCost() * storage_used;
        assert(required_cost <= near.attachedDeposit(), `Must attach ${required_cost} yoctoNEAR to cover storage`);

        return promise.asReturn();
    }

    @call({privateFunction: true})
    ft_transfer_callback({ ft_contract_id, amount, fee, recipient }: {
        ft_contract_id: AccountId,
        amount: string,
        fee: string,
        recipient: AccountId
    }): boolean {
        new CustomEventV1("ExchangeToken", {ft_contract_id, amount, fee, recipient}).emit();
        try {
            near.promiseResult(0);
        } catch {
            return false;          
        }

        return true;
    }

    @view({})
    get_exchange_amount({ ft_contract_id, amount }: {
        ft_contract_id: AccountId,
        amount: number
    }): bigint {
        const exchange_amount = BigInt(amount) * this._get_exchange_ratio(ft_contract_id) / BigInt(1000);
        const exchange_fee = exchange_amount * this._get_exchange_fee_ratio(ft_contract_id) / BigInt(1000);

        return exchange_amount - exchange_fee;
    }

    @view({})
    get_exchangeable_amount({ token_id }: {
        token_id: AccountId
    }): bigint {
        return this._get_distribute_amount(token_id);
    }

    /* private functions */

    _get_distribute_amount(ft_contract_id: AccountId): bigint {
        // 교환 가능한 양 + (인상 양 * (현재 시간 - 마지막 시간))
        return this._get_distribute_amout(ft_contract_id) + this._get_distribute_rate(ft_contract_id) * (this._get_interval_count(ft_contract_id) - this._get_distribute_time(ft_contract_id));
    }

    _get_distribute_amout(ft_contract_id: AccountId): bigint {
        return this.distribute_amounts.get(ft_contract_id, { defaultValue: BigInt(0) });
    }

    _get_distribute_rate(ft_contract_id: AccountId): bigint {
        return this.distribute_rates.get(ft_contract_id, { defaultValue: BigInt(0) });
    }

    _get_distribute_time(ft_contract_id: AccountId): bigint {
        return this.distribute_times.get(ft_contract_id, { defaultValue: BigInt(0) });
    }

    _get_exchange_ratio(ft_contract_id: AccountId): bigint {
        return this.exchange_ratios.get(ft_contract_id, { defaultValue: BigInt(0) });
    }

    _get_exchange_fee_ratio(ft_contract_id: AccountId): bigint {
        return this.exchange_fee_ratios.get(ft_contract_id, { defaultValue: BigInt(0) });
    }

    _get_minimum_exchangeable_amount(ft_contract_id: AccountId): bigint {
        return this.minimum_exchangeable_amounts.get(ft_contract_id, { defaultValue: BigInt(0) });
    }

    _get_exchange_guard_rate(ft_contract_id: AccountId): bigint {
        return this.exchage_guard_rates.get(ft_contract_id, { defaultValue: BigInt(1_000) });
    }

    _get_block_timestamp_in_sec(): bigint {
        return near.blockTimestamp() / BigInt(1_000_000_000);
    }

    _get_interval_distribute_time(ft_contract_id: AccountId): bigint {
        return this.interval_distribute_times.get(ft_contract_id, { defaultValue: BigInt(1) })
    }

    _get_interval_count(ft_contract_id: AccountId): bigint {
        return this._get_block_timestamp_in_sec() / this._get_interval_distribute_time(ft_contract_id);
    }

    valid_bigint({ value }: { value: string | number }): boolean {
        try {
            BigInt(value);
            return true;
        } catch {
            return false;
        }
    }

    toHexString({ byteArray }: { byteArray: Uint8Array }): string {
        return Array.from(byteArray)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }
}
