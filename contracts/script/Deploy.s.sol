// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console2} from "forge-std/Script.sol";
import {EventManager, INameWrapper} from "../src/EventManager.sol";

/// @notice Deploys EventManager on Sepolia and approves it as an operator on the parent name,
///         so it can create event subnames. Run with the parent name's owner key.
///
/// Required env:
///   DEPLOYER_PRIVATE_KEY  - owner of the wrapped parent name
///   PARENT_NODE           - namehash of the parent name (e.g. namehash("junto-xyz.eth"))
/// Optional env (default to Sepolia ENS deployments):
///   NAME_WRAPPER, PUBLIC_RESOLVER
contract Deploy is Script {
    // ENS Sepolia deployments (protocol addresses, not app data).
    address constant SEPOLIA_NAME_WRAPPER = 0x0635513f179D50A207757E05759CbD106d7dFcE8;
    address constant SEPOLIA_PUBLIC_RESOLVER = 0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        bytes32 parentNode = vm.envBytes32("PARENT_NODE");
        address wrapper = vm.envOr("NAME_WRAPPER", SEPOLIA_NAME_WRAPPER);
        address resolver = vm.envOr("PUBLIC_RESOLVER", SEPOLIA_PUBLIC_RESOLVER);

        vm.startBroadcast(pk);

        EventManager mgr = new EventManager(INameWrapper(wrapper), resolver, parentNode);
        // Authorize the manager to create subnodes under the parent.
        INameWrapper(wrapper).setApprovalForAll(address(mgr), true);

        vm.stopBroadcast();

        console2.log("EventManager deployed at:", address(mgr));
        console2.log("Parent node:");
        console2.logBytes32(parentNode);
    }
}
