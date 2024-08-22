/*!
Fungible Token implementation with JSON serialization.
NOTES:
  - The maximum balance value is limited by U128 (2**128 - 1).
  - JSON calls should pass U128 as a base-10 string. E.g. "100".
  - The contract optimizes the inner trie structure by hashing account IDs. It will prevent some
    abuse of deep tries. Shouldn't be an issue, once NEAR clients implement full hashing of keys.
  - The contract tracks the change in storage before and after the call. If the storage increases,
    the contract requires the caller of the contract to attach enough deposit to the function call
    to cover the storage cost.
    This is done to prevent a denial of service attack on the contract by taking all available storage.
    If the storage decreases, the contract will issue a refund for the cost of the released storage.
    The unused tokens from the attached deposit are also refunded, so it's safe to
    attach more deposit than required.
  - To prevent the deployed contract from being modified or deleted, it should not have any access
    keys on its account.
*/
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::FungibleToken;
use near_contract_standards::fungible_token::core::FungibleTokenCore;
use near_contract_standards::fungible_token::resolver::FungibleTokenResolver;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LazyOption, LookupMap};
use near_sdk::json_types::U128;
use near_sdk::{env, log, near_bindgen, AccountId, Balance, PanicOnDefault, PromiseOrValue};
use near_sdk::assert_one_yocto;
use serde::Serialize;

#[derive(Serialize)]
pub struct LogData {
    event: String,
    details: String,
}

impl LogData {
    fn to_json_string(&self) -> String {
        #[allow(clippy::redundant_closure)]
        serde_json::to_string(self).ok().unwrap_or_else(|| env::abort())
    }
}

fn emit_event(event_name: &str, details: &str) {
    let log_data = LogData {
        event: event_name.to_string(),
        details: details.to_string(),
    };
    env::log_str(&log_data.to_json_string());
}

// fn emit_event(event_name: &str, details: &str) {
//     let log_message = format!("{{\"event\": \"{}\", \"details\": \"{}\"}}", event_name, details);
//     env::log_str(&log_message);
// }

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    token: FungibleToken,
    metadata: LazyOption<FungibleTokenMetadata>,
    owner_id: AccountId,
    frozen: LookupMap<AccountId, bool>,
    use_mint: bool,
    use_freeze: bool,
    use_update_metadata: bool
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Config {
    use_mint: bool,
    use_freeze: bool,
    use_update_metadata: bool,
}

const DATA_IMAGE_SVG_NEAR_ICON: &str = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 288 288'%3E%3Cg id='l' data-name='l'%3E%3Cpath d='M187.58,79.81l-30.1,44.69a3.2,3.2,0,0,0,4.75,4.2L191.86,103a1.2,1.2,0,0,1,2,.91v80.46a1.2,1.2,0,0,1-2.12.77L102.18,77.93A15.35,15.35,0,0,0,90.47,72.5H87.34A15.34,15.34,0,0,0,72,87.84V201.16A15.34,15.34,0,0,0,87.34,216.5h0a15.35,15.35,0,0,0,13.08-7.31l30.1-44.69a3.2,3.2,0,0,0-4.75-4.2L96.14,186a1.2,1.2,0,0,1-2-.91V104.61a1.2,1.2,0,0,1,2.12-.77l89.55,107.23a15.35,15.35,0,0,0,11.71,5.43h3.13A15.34,15.34,0,0,0,216,201.16V87.84A15.34,15.34,0,0,0,200.66,72.5h0A15.35,15.35,0,0,0,187.58,79.81Z'/%3E%3C/g%3E%3C/svg%3E";

#[near_bindgen]
impl Contract {
    /// Initializes the contract with the given total supply owned by the given `owner_id` with
    /// default metadata (for example purposes only).
    #[init]
    pub fn new_default_meta(owner_id: AccountId, total_supply: U128) -> Self {
        Self::new(
            owner_id,
            total_supply,
            FungibleTokenMetadata {
                spec: FT_METADATA_SPEC.to_string(),
                name: "Example NEAR fungible token".to_string(),
                symbol: "EXAMPLE".to_string(),
                icon: Some(DATA_IMAGE_SVG_NEAR_ICON.to_string()),
                reference: None,
                reference_hash: None,
                decimals: 24
            },
            false,
            false,
            false,
        )
    }

    /// Initializes the contract with the given total supply owned by the given `owner_id` with
    /// the given fungible token metadata.
    #[init]
    pub fn new(
        owner_id: AccountId,
        total_supply: U128,
        metadata: FungibleTokenMetadata,
        use_mint: bool,
        use_freeze: bool,
        use_update_metadata: bool
    ) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        metadata.assert_valid();
        let mut this = Self {
            token: FungibleToken::new(b"a".to_vec()),
            metadata: LazyOption::new(b"m".to_vec(), Some(&metadata)),
            owner_id: owner_id.clone(),
            frozen: LookupMap::new(b"f".to_vec()),
            use_mint,
            use_freeze,
            use_update_metadata
        };
        this.token.internal_register_account(&owner_id);
        this.token.internal_deposit(&owner_id, total_supply.into());
        near_contract_standards::fungible_token::events::FtMint {
            owner_id: &owner_id,
            amount: &total_supply,
            memo: Some("Initial tokens supply is minted"),
        }
        .emit();
        this
    }

    fn on_account_closed(&mut self, account_id: AccountId, balance: Balance) {
        log!("Closed @{} with {}", account_id, balance);
    }

    fn on_tokens_burned(&mut self, account_id: AccountId, amount: Balance) {
        log!("Account @{} burned {}", account_id, amount);
    }

    fn only_owner(&self) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only the contract owner can call");
    }

    #[payable]
    pub fn update_use_mint(&mut self, use_mint: bool) {
        self.only_owner();
        assert_one_yocto();
        self.use_mint = use_mint;
        emit_event("update_use_mint", &use_mint.to_string());
    }

    #[payable]
    pub fn update_use_freeze(&mut self, use_freeze: bool) {
        self.only_owner();
        assert_one_yocto();
        self.use_freeze = use_freeze;
        emit_event("update_use_freeze", &use_freeze.to_string());
    }

    #[payable]
    pub fn update_use_update_metadata(&mut self, use_update_metadata: bool) {
        self.only_owner();
        assert_one_yocto();
        self.use_update_metadata = use_update_metadata;
        emit_event("update_use_update_metadata", &use_update_metadata.to_string());
    }

    pub fn get_use_mint(&self) -> bool {
        self.use_mint
    }

    pub fn get_use_freeze(&self) -> bool {
        self.use_freeze
    }

    pub fn get_use_update_metadata(&self) -> bool {
        self.use_update_metadata
    }

    // 추가 민팅 기능을 추가합니다.
    #[payable]
    pub fn mint(&mut self, amount: U128) {
        assert!(self.use_mint, "Can not mint more");
        // 계약의 소유자만이 민팅을 할 수 있습니다.
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only the contract owner can mint tokens");
        assert_one_yocto();
        self.token.internal_deposit(&self.owner_id, amount.into());
        near_contract_standards::fungible_token::events::FtMint {
            owner_id: &self.owner_id,
            amount: &amount,
            memo: Some("Minting tokens"),
        }
        .emit();
    }

    // 프리징 기능을 추가합니다.
    #[payable]
    pub fn freeze_account(&mut self, account_id: AccountId) {
        assert!(self.use_freeze, "Can not freeze");
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only the contract owner can freeze accounts");
        assert_one_yocto();
        self.frozen.insert(&account_id, &true);
    }

    #[payable]
    pub fn unfreeze_account(&mut self, account_id: AccountId) {
        assert!(self.use_freeze, "Can not unfreeze");
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only the contract owner can unfreeze accounts");
        assert_one_yocto();
        self.frozen.insert(&account_id, &false);
    }

    // 계정이 프리즈 상태인지 확인합니다.
    pub fn is_frozen(&self, account_id: &AccountId) -> bool {
        assert!(self.use_freeze, "Can not access");
        self.frozen.get(account_id).unwrap_or(false)
    }
    
    // 메타데이터 업데이트 기능을 추가합니다.
    #[payable]
    pub fn update_metadata(&mut self, metadata: FungibleTokenMetadata) {
        assert!(self.use_update_metadata, "Can not update metadata");
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only the contract owner can update metadata");
        assert_one_yocto();
        metadata.assert_valid();
        self.metadata = LazyOption::new(b"m".to_vec(), Some(&metadata));
    }
}

near_contract_standards::impl_fungible_token_storage!(Contract, token, on_account_closed);

#[near_bindgen]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().unwrap()
    }
}

#[near_bindgen]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
    ) {
        let sender_id = env::predecessor_account_id();
        
        // 계정이 프리즈 상태인지 확인
        if self.use_freeze {
            assert!(!self.is_frozen(&sender_id), "Sender account is frozen");
            assert!(!self.is_frozen(&receiver_id), "Receiver account is frozen");
        }

        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        let sender_id = env::predecessor_account_id();

        // 계정이 프리즈 상태인지 확인
        if self.use_freeze {
            assert!(!self.is_frozen(&sender_id), "Sender account is frozen");
            assert!(!self.is_frozen(&receiver_id), "Receiver account is frozen");
        }

        // 기본 구현 호출
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near_bindgen]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let (used_amount, burned_amount) =
            self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned_amount > 0 {
           self.on_tokens_burned(sender_id, burned_amount)
        }
        used_amount.into()
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, Balance, ONE_YOCTO};

    use super::*;

    const TOTAL_SUPPLY: Balance = 1_000_000_000_000_000;

    fn get_context(predecessor_account_id: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id);
        builder
    }

    #[test]
    fn test_new() {
        let mut context = get_context(accounts(1));
        testing_env!(context.build());
        let contract = Contract::new_default_meta(accounts(1).into(), TOTAL_SUPPLY.into());
        testing_env!(context.is_view(true).build());
        assert_eq!(contract.ft_total_supply().0, TOTAL_SUPPLY);
        assert_eq!(contract.ft_balance_of(accounts(1)).0, TOTAL_SUPPLY);
    }

    #[test]
    #[should_panic(expected = "The contract is not initialized")]
    fn test_default() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        let _contract = Contract::default();
    }

    #[test]
    fn test_transfer() {
        let mut context = get_context(accounts(2));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(2).into(), TOTAL_SUPPLY.into());
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(contract.storage_balance_bounds().min.into())
            .predecessor_account_id(accounts(1))
            .build());
        // Paying for account registration, aka storage deposit
        contract.storage_deposit(None, None);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(1)
            .predecessor_account_id(accounts(2))
            .build());
        let transfer_amount = TOTAL_SUPPLY / 3;
        contract.ft_transfer(accounts(1), transfer_amount.into(), None);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .is_view(true)
            .attached_deposit(0)
            .build());
        assert_eq!(contract.ft_balance_of(accounts(2)).0, (TOTAL_SUPPLY - transfer_amount));
        assert_eq!(contract.ft_balance_of(accounts(1)).0, transfer_amount);

        

    }

    #[test]
    #[should_panic(expected = "Can not mint more")]
    fn use_mint_fail() {
        let context = get_context(accounts(1));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(1).into(), TOTAL_SUPPLY.into());

        contract.mint(TOTAL_SUPPLY.into());
    }

    #[test]
    fn use_mint() {
        let mut context = get_context(accounts(1));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(1).into(), TOTAL_SUPPLY.into());

        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .attached_deposit(ONE_YOCTO)
            .build());
        contract.update_use_mint(true);
        assert_eq!(contract.get_use_mint(), true);

        contract.mint(TOTAL_SUPPLY.into());
        assert_eq!(contract.ft_balance_of(accounts(1)).0, (TOTAL_SUPPLY * 2).into());
        assert_eq!(contract.ft_total_supply().0, (TOTAL_SUPPLY * 2).into());
    }

    #[test]
    #[should_panic(expected = "Receiver account is frozen")]
    fn use_freeze_fail() {
        let mut context = get_context(accounts(2));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(2).into(), TOTAL_SUPPLY.into());
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(contract.storage_balance_bounds().min.into())
            .predecessor_account_id(accounts(2))
            .build());
        // Paying for account registration, aka storage deposit
        contract.storage_deposit(None, None);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .is_view(false)
            .attached_deposit(ONE_YOCTO)
            .build());
        contract.update_use_freeze(true);
        assert_eq!(contract.get_use_freeze(), true);
        contract.freeze_account(accounts(1));

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(1)
            .predecessor_account_id(accounts(2))
            .build());
        let transfer_amount = TOTAL_SUPPLY / 3;
        contract.ft_transfer(accounts(1), transfer_amount.into(), None);
    }

    #[test]
    #[should_panic(expected = "Sender account is frozen")]
    fn use_freeze_fail2() {
        let mut context = get_context(accounts(2));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(2).into(), TOTAL_SUPPLY.into());
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(contract.storage_balance_bounds().min.into())
            .predecessor_account_id(accounts(2))
            .build());
        // Paying for account registration, aka storage deposit
        contract.storage_deposit(None, None);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .is_view(false)
            .attached_deposit(ONE_YOCTO)
            .build());
        contract.update_use_freeze(true);
        assert_eq!(contract.get_use_freeze(), true);
        contract.freeze_account(accounts(2));

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(1)
            .predecessor_account_id(accounts(2))
            .build());
        let transfer_amount = TOTAL_SUPPLY / 3;
        contract.ft_transfer(accounts(1), transfer_amount.into(), None);
    }

    #[test]
    fn use_freeze() {
        let mut context = get_context(accounts(2));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(2).into(), TOTAL_SUPPLY.into());
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(contract.storage_balance_bounds().min.into())
            .predecessor_account_id(accounts(1))
            .build());
        // Paying for account registration, aka storage deposit
        contract.storage_deposit(None, None);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .is_view(false)
            .attached_deposit(ONE_YOCTO)
            .predecessor_account_id(accounts(2))
            .build());
        contract.update_use_freeze(true);
        assert_eq!(contract.get_use_freeze(), true);
        contract.freeze_account(accounts(1));
        contract.update_use_freeze(false);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(1)
            .predecessor_account_id(accounts(2))
            .build());
        let transfer_amount = TOTAL_SUPPLY / 3;
        contract.ft_transfer(accounts(1), transfer_amount.into(), None);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .is_view(true)
            .attached_deposit(0)
            .build());
        assert_eq!(contract.ft_balance_of(accounts(2)).0, (TOTAL_SUPPLY - transfer_amount));
        assert_eq!(contract.ft_balance_of(accounts(1)).0, transfer_amount);
    }

    #[test]
    #[should_panic(expected = "Can not update metadata")]
    fn use_update_metadata_fail() {
        let mut context = get_context(accounts(2));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(2).into(), TOTAL_SUPPLY.into());
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(contract.storage_balance_bounds().min.into())
            .predecessor_account_id(accounts(2))
            .build());
        let metadata = contract.ft_metadata();
        println!("metadata.name: {}", metadata.name);
        println!("metadata.symbol: {}", metadata.symbol);
        println!("metadata.decimals: {}", metadata.decimals);
        
        let f: FungibleTokenMetadata = FungibleTokenMetadata {
            spec: metadata.spec,
            name: "Ha".to_string(),
            symbol: "HHH".to_string(),
            decimals: 1,
            icon: Some("this is icon".to_string()),
            reference: metadata.reference,
            reference_hash: metadata.reference_hash
        };
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(ONE_YOCTO)
            .predecessor_account_id(accounts(2))
            .build());
        contract.update_metadata(f);
    }

    #[test]
    #[should_panic(expected = "Only the contract owner can update metadata")]
    fn use_update_metadata_fail2() {
        let mut context = get_context(accounts(2));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(2).into(), TOTAL_SUPPLY.into());
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(contract.storage_balance_bounds().min.into())
            .predecessor_account_id(accounts(2))
            .build());
        let metadata = contract.ft_metadata();
        println!("metadata.name: {}", metadata.name);
        println!("metadata.symbol: {}", metadata.symbol);
        println!("metadata.decimals: {}", metadata.decimals);
        
        let f: FungibleTokenMetadata = FungibleTokenMetadata {
            spec: metadata.spec,
            name: "Ha".to_string(),
            symbol: "HHH".to_string(),
            decimals: 1,
            icon: Some("this is icon".to_string()),
            reference: metadata.reference,
            reference_hash: metadata.reference_hash
        };
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(ONE_YOCTO)
            .predecessor_account_id(accounts(2))
            .build());
        contract.update_use_update_metadata(true);

        testing_env!(context
            .storage_usage(env::storage_usage())
            .account_balance(env::account_balance())
            .attached_deposit(0)
            .predecessor_account_id(accounts(1))
            .build());
        contract.update_metadata(f);
    }

    #[test]
    fn use_update_metadata() {
        let mut context = get_context(accounts(2));
        testing_env!(context.build());
        let mut contract = Contract::new_default_meta(accounts(2).into(), TOTAL_SUPPLY.into());
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(contract.storage_balance_bounds().min.into())
            .predecessor_account_id(accounts(2))
            .build());
        let metadata = contract.ft_metadata();
        println!("metadata.name: {}", metadata.name);
        println!("metadata.symbol: {}", metadata.symbol);
        println!("metadata.decimals: {}", metadata.decimals);
        
        let f: FungibleTokenMetadata = FungibleTokenMetadata {
            spec: metadata.spec,
            name: "Ha".to_string(),
            symbol: "HHH".to_string(),
            decimals: 1,
            icon: Some("this is icon".to_string()),
            reference: metadata.reference,
            reference_hash: metadata.reference_hash
        };

        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(ONE_YOCTO)
            .predecessor_account_id(accounts(2))
            .build());

        contract.update_use_update_metadata(true);
        contract.update_metadata(f);
    }
}
