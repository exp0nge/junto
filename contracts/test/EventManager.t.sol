// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {EventManager, INameWrapper, IResolver} from "../src/EventManager.sol";

/// @dev Minimal NameWrapper stand-in: computes subnode namehashes, tracks ERC1155 ownership,
///      and supports the approval/transfer surface EventManager touches.
contract MockNameWrapper is INameWrapper {
    mapping(uint256 => address) public ownerOf;

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address,
        uint64,
        uint32,
        uint64
    ) external returns (bytes32 node) {
        node = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
        ownerOf[uint256(node)] = owner;
    }

    function setApprovalForAll(address, bool) external {}

    function safeTransferFrom(address from, address to, uint256 id, uint256, bytes calldata) external {
        require(ownerOf[id] == from, "not owner");
        ownerOf[id] = to;
    }
}

contract MockResolver is IResolver {
    mapping(bytes32 => mapping(string => string)) public text;
    mapping(bytes32 => address) public addr;
    mapping(bytes32 => bytes) public abiData;

    function setText(bytes32 node, string calldata key, string calldata value) external {
        text[node][key] = value;
    }

    function setAddr(bytes32 node, address a) external {
        addr[node] = a;
    }

    function setABI(bytes32 node, uint256, bytes calldata data) external {
        abiData[node] = data;
    }
}

contract EventManagerTest is Test {
    MockNameWrapper wrapper;
    MockResolver resolver;
    EventManager mgr;

    bytes32 constant PARENT = keccak256("junto.eth-mock");
    address host = makeAddr("host");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        wrapper = new MockNameWrapper();
        resolver = new MockResolver();
        mgr = new EventManager(INameWrapper(address(wrapper)), address(resolver), PARENT);
    }

    function _node(bytes32 parent, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(parent, keccak256(bytes(label))));
    }

    function _createSampleEvent(uint256 capacity) internal returns (bytes32 eventNode) {
        string[] memory keys = new string[](2);
        string[] memory vals = new string[](2);
        keys[0] = "xyz.junto.title";
        vals[0] = "ETHGlobal NY Kickoff";
        keys[1] = "xyz.junto.location";
        vals[1] = "New York";
        vm.prank(host);
        eventNode = mgr.createEvent("ethny", capacity, keys, vals);
    }

    function test_CreateEvent_WritesRecordsAndState() public {
        bytes32 eventNode = _createSampleEvent(2);
        assertEq(eventNode, _node(PARENT, "ethny"));

        (address h, uint256 cap, uint256 count, bool exists) = mgr.events(eventNode);
        assertEq(h, host);
        assertEq(cap, 2);
        assertEq(count, 0);
        assertTrue(exists);

        // event node is held by the contract so it can mint tickets under it later
        assertEq(wrapper.ownerOf(uint256(eventNode)), address(mgr));
        assertEq(resolver.text(eventNode, "xyz.junto.title"), "ETHGlobal NY Kickoff");
        assertEq(resolver.text(eventNode, "xyz.junto.location"), "New York");

        // Iter 2 self-discovery records: name resolves to the manager + carries the rsvp ABI.
        assertEq(resolver.addr(eventNode), address(mgr));
        assertGt(resolver.abiData(eventNode).length, 0);
    }

    function test_RevokeEvent_OwnerBlocksRsvp() public {
        bytes32 eventNode = _createSampleEvent(0);
        // deployer of mgr is this test contract -> it is owner
        mgr.revokeEvent(eventNode);
        assertEq(resolver.text(eventNode, "xyz.junto.status"), "revoked");
        vm.prank(alice);
        vm.expectRevert(EventManager.EventNotFound.selector);
        mgr.rsvp(eventNode, "alice");
    }

    function test_RevokeEvent_OnlyOwner() public {
        bytes32 eventNode = _createSampleEvent(0);
        vm.prank(alice);
        vm.expectRevert(EventManager.NotOwner.selector);
        mgr.revokeEvent(eventNode);
    }

    function test_Rsvp_RevertsOnDuplicateLabel() public {
        bytes32 eventNode = _createSampleEvent(0);
        vm.prank(alice);
        mgr.rsvp(eventNode, "alice");
        vm.prank(bob);
        vm.expectRevert(EventManager.AlreadyRSVPed.selector);
        mgr.rsvp(eventNode, "alice");
    }

    function test_Rsvp_MintsTicketToAttendeeWithStatus() public {
        bytes32 eventNode = _createSampleEvent(2);

        vm.prank(alice);
        bytes32 ticketNode = mgr.rsvp(eventNode, "alice");

        assertEq(ticketNode, _node(eventNode, "alice"));
        // ticket ends up owned by the attendee, not the contract
        assertEq(wrapper.ownerOf(uint256(ticketNode)), alice);
        assertEq(resolver.text(ticketNode, "xyz.junto.status"), "going");

        (,, uint256 count,) = mgr.events(eventNode);
        assertEq(count, 1);
    }

    function test_Rsvp_RevertsWhenFull() public {
        bytes32 eventNode = _createSampleEvent(1);

        vm.prank(alice);
        mgr.rsvp(eventNode, "alice");

        vm.prank(bob);
        vm.expectRevert(EventManager.EventFull.selector);
        mgr.rsvp(eventNode, "bob");
    }

    function test_Rsvp_RevertsForUnknownEvent() public {
        vm.prank(alice);
        vm.expectRevert(EventManager.EventNotFound.selector);
        mgr.rsvp(keccak256("nope"), "alice");
    }

    function test_CreateEvent_RevertsOnLengthMismatch() public {
        string[] memory keys = new string[](1);
        string[] memory vals = new string[](0);
        keys[0] = "xyz.junto.title";
        vm.prank(host);
        vm.expectRevert(EventManager.LengthMismatch.selector);
        mgr.createEvent("ethny", 10, keys, vals);
    }

    function test_CapacityZeroMeansUncapped() public {
        bytes32 eventNode = _createSampleEvent(0);
        for (uint256 i = 0; i < 5; i++) {
            address a = makeAddr(string(abi.encodePacked("attendee", i)));
            vm.prank(a);
            mgr.rsvp(eventNode, string(abi.encodePacked("a", i)));
        }
        (,, uint256 count,) = mgr.events(eventNode);
        assertEq(count, 5);
    }
}
