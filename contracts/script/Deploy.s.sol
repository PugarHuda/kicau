// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Kicau} from "../src/Kicau.sol";

/// forge script script/Deploy.s.sol --rpc-url monad_testnet --account deployer --broadcast
/// Env: TREASURY, CONSERVATION (default: deployer), BASE_URI (default: empty, set later)
contract Deploy is Script {
    function run() external returns (Kicau kicau) {
        vm.startBroadcast();
        address deployer = msg.sender;
        kicau = new Kicau(
            vm.envOr("TREASURY", deployer), vm.envOr("CONSERVATION", deployer), vm.envOr("BASE_URI", string(""))
        );
        vm.stopBroadcast();
        console.log("Kicau deployed at", address(kicau));
    }
}
