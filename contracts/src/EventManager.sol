// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Minimal slice of the ENS NameWrapper interface we depend on.
interface INameWrapper {
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32 node);

    function setApprovalForAll(address operator, bool approved) external;

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;
}

/// @notice Minimal slice of the ENS PublicResolver text interface.
interface ITextResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
}

/// @title EventManager
/// @notice Luma/Meetup-on-ENS. Each event is a subname under `parentNode`; each RSVP is a
///         ticket subname minted under the event node. All event metadata lives in ENS
///         resolver text records — no off-chain database. Iteration 1 is intentionally
///         paymentless and fuse-free to validate the mint -> resolve loop end to end.
contract EventManager {
    INameWrapper public immutable wrapper;
    address public immutable resolver;
    bytes32 public immutable parentNode;

    struct Event {
        address host;
        uint256 capacity;
        uint256 rsvpCount;
        bool exists;
    }

    /// @dev eventNode (namehash of `<label>.<parent>`) => event data.
    mapping(bytes32 => Event) public events;

    event EventCreated(bytes32 indexed eventNode, address indexed host, string label, uint256 capacity);
    event RSVP(bytes32 indexed eventNode, bytes32 indexed ticketNode, address indexed attendee, string label);

    error EventNotFound();
    error EventFull();
    error LengthMismatch();

    constructor(INameWrapper _wrapper, address _resolver, bytes32 _parentNode) {
        wrapper = _wrapper;
        resolver = _resolver;
        parentNode = _parentNode;
    }

    /// @notice Create an event as an ENS subname and write its metadata into resolver records.
    /// @dev The deployer must `setApprovalForAll(this, true)` on the NameWrapper for the parent
    ///      so this contract can create subnodes. The event node is owned by this contract so it
    ///      can both write the records and later create ticket subnodes under it.
    function createEvent(
        string calldata label,
        uint256 capacity,
        string[] calldata keys,
        string[] calldata values
    ) external returns (bytes32 eventNode) {
        if (keys.length != values.length) revert LengthMismatch();

        eventNode = wrapper.setSubnodeRecord(parentNode, label, address(this), resolver, 0, 0, 0);

        for (uint256 i = 0; i < keys.length; i++) {
            ITextResolver(resolver).setText(eventNode, keys[i], values[i]);
        }

        events[eventNode] = Event({host: msg.sender, capacity: capacity, rsvpCount: 0, exists: true});

        emit EventCreated(eventNode, msg.sender, label, capacity);
    }

    /// @notice RSVP to an event: mints a ticket subname owned by the attendee with a status record.
    /// @dev Mint to this contract first (so we can write the status record), then transfer the
    ///      ticket to the attendee. capacity == 0 means uncapped.
    function rsvp(bytes32 eventNode, string calldata attendeeLabel) external returns (bytes32 ticketNode) {
        Event storage e = events[eventNode];
        if (!e.exists) revert EventNotFound();
        if (e.capacity != 0 && e.rsvpCount >= e.capacity) revert EventFull();

        ticketNode = wrapper.setSubnodeRecord(eventNode, attendeeLabel, address(this), resolver, 0, 0, 0);
        ITextResolver(resolver).setText(ticketNode, "xyz.junto.status", "going");
        wrapper.safeTransferFrom(address(this), msg.sender, uint256(ticketNode), 1, "");

        e.rsvpCount += 1;

        emit RSVP(eventNode, ticketNode, msg.sender, attendeeLabel);
    }

    /// @notice ERC1155 receiver hook so the NameWrapper can mint tickets to this contract.
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }
}
