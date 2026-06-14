// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console2} from "forge-std/Script.sol";
import {EventManager} from "../src/EventManager.sol";

/// @notice Creates one event on a deployed EventManager. Event content comes from env so no
///         values are hard-coded into the contract.
///
/// Required env:
///   DEPLOYER_PRIVATE_KEY, EVENT_MANAGER, EVENT_LABEL, EVENT_TITLE, EVENT_LOCATION, EVENT_CAPACITY
contract CreateEvent is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        EventManager mgr = EventManager(vm.envAddress("EVENT_MANAGER"));
        string memory label = vm.envString("EVENT_LABEL");
        uint256 capacity = vm.envUint("EVENT_CAPACITY");

        string[] memory keys = new string[](3);
        string[] memory vals = new string[](3);
        keys[0] = "xyz.junto.title";
        vals[0] = vm.envString("EVENT_TITLE");
        keys[1] = "xyz.junto.location";
        vals[1] = vm.envString("EVENT_LOCATION");
        keys[2] = "xyz.junto.capacity";
        vals[2] = vm.envString("EVENT_CAPACITY");

        vm.startBroadcast(pk);
        bytes32 eventNode = mgr.createEvent(label, capacity, keys, vals);
        vm.stopBroadcast();

        console2.log("Event created. Label:", label);
        console2.log("Event node:");
        console2.logBytes32(eventNode);
    }
}
