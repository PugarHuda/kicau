# Kicau contracts

Foundry · Solidity 0.8.28 (via_ir) · OpenZeppelin v5.4.0. Single contract: `src/Kicau.sol` (ERC-721 species NFTs + registered birds, contests, attestations, Kicau Value, verified runs, leaderboards, weekly prize pool). API overview: [../README.md](../README.md#contract-api).

| Network | Address |
|---|---|
| Monad testnet (10143) | `0x947929841Ba8154BB6E9BDeb35137d159c6A0F58` |
| Monad mainnet (143) | `0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61` |

Both verified on MonadVision and Monadscan.

```bash
forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.4.0   # lib/ is not committed
forge build
forge test                                   # 60 tests incl. fuzz + reentrancy
cast wallet import deployer --interactive    # encrypted keystore, no private key in files
BASE_URI=https://<your-host>/metadata/ forge script script/Deploy.s.sol --rpc-url monad_testnet --account deployer --broadcast
```

Optional deploy env: `TREASURY`, `CONSERVATION` (default: deployer). RPC aliases `monad_testnet` / `monad` are in `foundry.toml`.
